/**
 * Admin script to import Liftoff CSV or Strong TSV workout data for a given user.
 *
 * Mirrors the in-app import flow (useImportStore + importService):
 *   1. Reads the file from disk
 *   2. Auto-detects format (Liftoff CSV / Strong TSV)
 *   3. Parses workouts
 *   4. Resolves exercise aliases from the DB
 *   5. Creates user_exercises for any unknowns
 *   6. Inserts workouts → exercises → sets → activity_feed
 *
 * Usage:
 *   node scripts/admin_import_workouts.js <email_or_uid> <file_path>
 *
 * Examples:
 *   node scripts/admin_import_workouts.js user@example.com ./export.csv
 *   node scripts/admin_import_workouts.js abc-123-uid ./strong_export.tsv
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 */

const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 5;

// ── Arg parsing ───────────────────────────────────────────

const [, , emailOrUid, filePath] = process.argv;

if (!emailOrUid || !filePath) {
  console.error("Usage: node scripts/admin_import_workouts.js <email_or_uid> <file_path>");
  console.error('Example: node scripts/admin_import_workouts.js user@example.com ./export.csv');
  process.exit(1);
}

// ── Format detection ──────────────────────────────────────

function detectFormat(content) {
  const firstLine = content.split("\n")[0] || "";
  if (firstLine.includes("ex_name") && firstLine.includes("posted_when")) return "liftoff";
  if (firstLine.includes("Exercise Name") && firstLine.includes("Set Order")) return "strong";
  throw new Error("Unrecognized file format. Supported: Liftoff CSV, Strong TSV.");
}

// ── Liftoff CSV parser ────────────────────────────────────

function parseDuration(raw) {
  let total = 0;
  const hours = raw.match(/(\d+)\s*hours?/i);
  const minutes = raw.match(/(\d+)\s*minutes?/i);
  const seconds = raw.match(/(\d+)\s*seconds?/i);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);
  return total;
}

function parseLiftoffCSV(content) {
  const { data, errors } = Papa.parse(content, { header: true, skipEmptyLines: true });
  if (errors.length > 0 && data.length === 0) {
    throw new Error("Failed to parse CSV: " + errors[0].message);
  }

  const workoutGroups = new Map();
  for (const row of data) {
    const key = row.posted_when;
    if (!key) continue;
    if (!workoutGroups.has(key)) workoutGroups.set(key, []);
    workoutGroups.get(key).push(row);
  }

  const workouts = [];
  for (const [postedWhen, rows] of workoutGroups) {
    const duration = parseDuration(rows[0].session_length || "");

    const exerciseMap = new Map();
    for (const row of rows) {
      const name = row.ex_name;
      if (!name) continue;
      if (!exerciseMap.has(name)) exerciseMap.set(name, []);
      exerciseMap.get(name).push(row);
    }

    const exercises = [];
    for (const [name, setRows] of exerciseMap) {
      setRows.sort((a, b) => parseInt(a.ex_index, 10) - parseInt(b.ex_index, 10));
      const sets = setRows.map((row, i) => ({
        set_number: i + 1,
        kg: Math.round((parseFloat(row.first_input) || 0) * 10) / 10,
        reps: parseInt(row.second_input, 10) || 0,
        set_type: row.set_type === "failure" ? "failure" : "working",
      }));
      exercises.push({ name, exercise_type: "weighted", sets });
    }

    workouts.push({ created_at: postedWhen, duration, exercises });
  }
  return workouts;
}

// ── Strong TSV parser ─────────────────────────────────────

function parseStrongDuration(raw) {
  let total = 0;
  const hours = raw.match(/(\d+)\s*h/i);
  const minutes = raw.match(/(\d+)\s*m(?!s)/i);
  const seconds = raw.match(/(\d+)\s*s/i);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);
  return total;
}

function parseStrongTSV(content) {
  const { data, errors } = Papa.parse(content, { header: true, delimiter: "\t", skipEmptyLines: true });
  if (errors.length > 0 && data.length === 0) {
    throw new Error("Failed to parse TSV: " + errors[0].message);
  }

  const workoutGroups = new Map();
  for (const row of data) {
    const key = row.Date;
    if (!key) continue;
    if (!workoutGroups.has(key)) workoutGroups.set(key, []);
    workoutGroups.get(key).push(row);
  }

  const workouts = [];
  for (const [date, rows] of workoutGroups) {
    const duration = parseStrongDuration(rows[0].Duration || "");

    const exerciseMap = new Map();
    for (const row of rows) {
      const name = row["Exercise Name"];
      if (!name) continue;
      if (!exerciseMap.has(name)) exerciseMap.set(name, []);
      exerciseMap.get(name).push(row);
    }

    const exercises = [];
    for (const [name, setRows] of exerciseMap) {
      setRows.sort((a, b) => parseInt(a["Set Order"], 10) - parseInt(b["Set Order"], 10));
      const sets = setRows.map((row) => ({
        set_number: parseInt(row["Set Order"], 10) || 1,
        kg: Math.round((parseFloat(row.Weight) || 0) * 10) / 10,
        reps: parseInt(row.Reps, 10) || 0,
        set_type: "working",
      }));
      exercises.push({ name, exercise_type: "weighted", sets });
    }

    workouts.push({ created_at: date, duration, exercises });
  }
  return workouts;
}

// ── Alias resolution ──────────────────────────────────────

function resolveAliases(workouts, aliasMap) {
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const canonical = aliasMap[ex.name];
      if (canonical) ex.name = canonical;
    }
  }
}

// ── Unknown exercise detection ────────────────────────────

function findUnknownExercises(workouts, catalogNames) {
  const seen = new Set();
  const unknown = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!seen.has(ex.name)) {
        seen.add(ex.name);
        if (!catalogNames.has(ex.name)) unknown.push(ex.name);
      }
    }
  }
  return unknown;
}

// ── Insert workout (mirrors useImportStore.insertWorkout) ─

async function insertWorkout(w, userId) {
  const totalSets = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);

  const { data: workout, error: workoutErr } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      duration: w.duration,
      total_exercises: w.exercises.length,
      total_sets: totalSets,
      created_at: w.created_at,
    })
    .select("id")
    .single();

  if (workoutErr || !workout) {
    console.error(`  Failed to insert workout (${w.created_at}):`, workoutErr?.message);
    return;
  }

  let totalVolume = 0;
  const exerciseNames = [];

  for (let i = 0; i < w.exercises.length; i++) {
    const ex = w.exercises[i];
    exerciseNames.push(ex.name);

    const { data: exData, error: exErr } = await supabase
      .from("exercises")
      .insert({
        workout_id: workout.id,
        name: ex.name,
        exercise_order: i + 1,
        exercise_type: ex.exercise_type,
      })
      .select("id")
      .single();

    if (exErr || !exData) continue;

    const setRows = ex.sets.map((s) => {
      totalVolume += s.kg * s.reps;
      return {
        exercise_id: exData.id,
        set_number: s.set_number,
        kg: s.kg,
        reps: s.reps,
        completed: true,
        set_type: s.set_type,
        parent_set_number: null,
      };
    });

    if (setRows.length > 0) {
      await supabase.from("sets").insert(setRows);
    }
  }

  // Activity feed entry
  try {
    await supabase.from("activity_feed").insert({
      user_id: userId,
      workout_id: workout.id,
      duration: w.duration,
      total_volume: Math.round(totalVolume),
      exercise_names: exerciseNames,
      total_exercises: w.exercises.length,
      total_sets: totalSets,
      created_at: w.created_at,
    });
  } catch {}
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  // 1. Resolve user ID
  let userId = emailOrUid;
  if (emailOrUid.includes("@")) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Failed to list users:", error.message);
      process.exit(1);
    }
    const user = users.find((u) => u.email === emailOrUid);
    if (!user) {
      console.error(`No user found with email "${emailOrUid}"`);
      process.exit(1);
    }
    userId = user.id;
    console.log(`Found user: ${emailOrUid} (${userId})`);
  } else {
    console.log(`Using UID: ${userId}`);
  }

  // 2. Read file
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, "utf-8");
  if (!content.trim()) {
    console.error("File is empty.");
    process.exit(1);
  }

  // 3. Detect format & parse
  let source;
  try {
    source = detectFormat(content);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  console.log(`Detected format: ${source}`);

  let workouts;
  try {
    workouts = source === "liftoff" ? parseLiftoffCSV(content) : parseStrongTSV(content);
  } catch (e) {
    console.error("Parse error:", e.message);
    process.exit(1);
  }

  if (workouts.length === 0) {
    console.error("No workouts found in the file.");
    process.exit(1);
  }

  console.log(`Parsed ${workouts.length} workouts\n`);

  // 4. Load catalog + aliases from DB
  console.log("Loading exercise catalog & aliases...");

  const [catalogRes, userExRes, aliasRes] = await Promise.all([
    supabase.from("exercises_catalog").select("name"),
    supabase.from("user_exercises").select("name").eq("user_id", userId),
    supabase.from("exercise_aliases").select("alias, canonical_name"),
  ]);

  const catalogNames = new Set();
  if (catalogRes.data) catalogRes.data.forEach((e) => catalogNames.add(e.name));
  if (userExRes.data) userExRes.data.forEach((e) => catalogNames.add(e.name));

  const aliasMap = {};
  if (aliasRes.data) {
    for (const row of aliasRes.data) {
      aliasMap[row.alias] = row.canonical_name;
    }
  }

  console.log(`  Catalog: ${catalogNames.size} exercises, ${Object.keys(aliasMap).length} aliases`);

  // 5. Resolve aliases
  resolveAliases(workouts, aliasMap);

  // 6. Create user_exercises for unknowns
  const unknowns = findUnknownExercises(workouts, catalogNames);

  if (unknowns.length > 0) {
    console.log(`\nCreating ${unknowns.length} unknown exercises as user_exercises:`);
    let created = 0;
    for (const name of unknowns) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error } = await supabase.from("user_exercises").insert({
        user_id: userId,
        name,
        slug,
        category: "Custom",
        exercise_type: "weighted",
        primary_muscles: [],
        secondary_muscles: [],
        equipment: [],
      });

      if (error) {
        if (error.code === "23505") {
          console.log(`  - "${name}" (already exists, skipped)`);
        } else {
          console.log(`  - "${name}" FAILED: ${error.message}`);
        }
      } else {
        console.log(`  - "${name}" ✓`);
        created++;
      }
    }
    console.log(`Created ${created}/${unknowns.length} user exercises\n`);
  } else {
    console.log("All exercises resolved to catalog entries.\n");
  }

  // 7. Import workouts in batches
  console.log(`Importing ${workouts.length} workouts (batch size ${BATCH_SIZE})...`);

  for (let i = 0; i < workouts.length; i += BATCH_SIZE) {
    const batch = workouts.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((w) => insertWorkout(w, userId)));

    const done = Math.min(i + BATCH_SIZE, workouts.length);
    console.log(`  ${done}/${workouts.length}`);
  }

  // 8. Summary
  const totalExercises = workouts.reduce((n, w) => n + w.exercises.length, 0);
  const totalSets = workouts.reduce((n, w) => n + w.exercises.reduce((m, ex) => m + ex.sets.length, 0), 0);

  console.log(`\nDone!`);
  console.log(`  Workouts:  ${workouts.length}`);
  console.log(`  Exercises: ${totalExercises}`);
  console.log(`  Sets:      ${totalSets}`);
  if (unknowns.length > 0) {
    console.log(`  New exercises created: ${unknowns.length}`);
    console.log(`\nTip: Use map-exercise.js to map custom exercises to catalog entries:`);
    console.log(`  node scripts/map-exercise.js ${userId} "Custom Name" "Catalog Name"`);
  }
}

main().catch((err) => {
  console.error("\nUnexpected error:", err);
  process.exit(1);
});
