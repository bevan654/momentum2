/**
 * Map an imported exercise to a catalog exercise for a specific user.
 *
 * What it does:
 *   1. Renames all `exercises` rows (in that user's workouts) from oldName → newName
 *   2. Updates `activity_feed` exercise_names arrays
 *   3. Updates the `user_exercises` entry with catalog data (category, muscles, etc.)
 *      — or deletes it if the exercise exists in the global catalog
 *
 * Usage:
 *   node scripts/map-exercise.js <userId> <oldName> <catalogName>
 *
 * Examples:
 *   node scripts/map-exercise.js abc-123 "Iso-Lateral Shoulder Press" "Machine Shoulder Press"
 *   node scripts/map-exercise.js abc-123 "Sled Leg Press" "Leg Press"
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const [, , userId, oldName, catalogName] = process.argv;

if (!userId || !oldName || !catalogName) {
  console.error("Usage: node scripts/map-exercise.js <userId> <oldName> <catalogName>");
  console.error('Example: node scripts/map-exercise.js abc-123 "Sled Leg Press" "Leg Press"');
  process.exit(1);
}

async function main() {
  console.log(`\nMapping exercise for user: ${userId}`);
  console.log(`  "${oldName}" → "${catalogName}"\n`);

  // 1. Look up the catalog exercise to get its data
  const { data: catalogEntry, error: catErr } = await supabase
    .from("exercises_catalog")
    .select("*")
    .eq("name", catalogName)
    .single();

  if (catErr || !catalogEntry) {
    console.error(`Catalog exercise "${catalogName}" not found.`);

    // Show similar names to help
    const { data: all } = await supabase
      .from("exercises_catalog")
      .select("name")
      .ilike("name", `%${catalogName.split(" ")[0]}%`);

    if (all && all.length > 0) {
      console.log("\nDid you mean one of these?");
      all.forEach((e) => console.log(`  - ${e.name}`));
    }
    process.exit(1);
  }

  console.log("Catalog match found:");
  console.log(`  Category: ${catalogEntry.category}`);
  console.log(`  Primary muscles: ${catalogEntry.primary_muscles}`);
  console.log(`  Secondary muscles: ${catalogEntry.secondary_muscles}`);
  console.log(`  Exercise type: ${catalogEntry.exercise_type || "weighted"}\n`);

  // 2. Get all workout IDs for this user
  const { data: workouts, error: wErr } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", userId);

  if (wErr) {
    console.error("Failed to fetch workouts:", wErr.message);
    process.exit(1);
  }

  if (!workouts || workouts.length === 0) {
    console.log("No workouts found for this user.");
    process.exit(0);
  }

  const workoutIds = workouts.map((w) => w.id);

  // 3. Rename exercise entries in the exercises table
  const { data: updated, error: updateErr } = await supabase
    .from("exercises")
    .update({
      name: catalogName,
      exercise_type: catalogEntry.exercise_type || "weighted",
    })
    .eq("name", oldName)
    .in("workout_id", workoutIds)
    .select("id");

  if (updateErr) {
    console.error("Failed to update exercises:", updateErr.message);
    process.exit(1);
  }

  const count = updated ? updated.length : 0;
  console.log(`Updated ${count} exercise entries in workouts.`);

  // 4. Update activity_feed exercise_names arrays
  const { data: feeds, error: feedErr } = await supabase
    .from("activity_feed")
    .select("id, exercise_names")
    .eq("user_id", userId);

  if (!feedErr && feeds) {
    let feedUpdated = 0;
    for (const feed of feeds) {
      const names = feed.exercise_names || [];
      const idx = names.indexOf(oldName);
      if (idx !== -1) {
        names[idx] = catalogName;
        await supabase
          .from("activity_feed")
          .update({ exercise_names: names })
          .eq("id", feed.id);
        feedUpdated++;
      }
    }
    console.log(`Updated ${feedUpdated} activity feed entries.`);
  }

  // 5. Update or delete the user_exercise
  const { data: userEx, error: ueErr } = await supabase
    .from("user_exercises")
    .select("id")
    .eq("user_id", userId)
    .eq("name", oldName)
    .single();

  if (userEx) {
    // Since the catalog exercise exists, delete the user_exercise (catalog takes priority)
    const { error: delErr } = await supabase
      .from("user_exercises")
      .delete()
      .eq("id", userEx.id);

    if (delErr) {
      console.error("Failed to delete user_exercise:", delErr.message);
    } else {
      console.log(`Deleted user_exercise "${oldName}" (catalog entry exists).`);
    }
  }

  console.log("\nDone!\n");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
