import Papa from 'papaparse';

// ── Types ──────────────────────────────────────────────

export interface ImportedSet {
  set_number: number;
  kg: number;
  reps: number;
  set_type: 'working' | 'warmup' | 'drop' | 'failure';
}

export interface ImportedExercise {
  name: string;
  exercise_type: string;
  sets: ImportedSet[];
}

export interface ImportedWorkout {
  created_at: string;
  duration: number; // seconds
  exercises: ImportedExercise[];
}

export type ImportSource = 'liftoff' | 'strong';

// ── Format Detection ───────────────────────────────────

export function detectFormat(content: string): ImportSource {
  const firstLine = content.split('\n')[0] || '';
  if (firstLine.includes('ex_name') && firstLine.includes('posted_when')) return 'liftoff';
  if (firstLine.includes('Exercise Name') && firstLine.includes('Set Order')) return 'strong';
  throw new Error('Unrecognized file format. Supported: Liftoff CSV, Strong TSV.');
}

// ── Liftoff CSV Parser ─────────────────────────────────

function parseLiftoffDuration(raw: string): number {
  // Format: "HH hours MM minutes SS seconds"
  let total = 0;
  const hours = raw.match(/(\d+)\s*hours?/i);
  const minutes = raw.match(/(\d+)\s*minutes?/i);
  const seconds = raw.match(/(\d+)\s*seconds?/i);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);
  return total;
}

function mapLiftoffSetType(raw: string): ImportedSet['set_type'] {
  if (raw === 'failure') return 'failure';
  return 'working';
}

export function parseLiftoffCSV(content: string): ImportedWorkout[] {
  const { data, errors } = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0 && data.length === 0) {
    throw new Error('Failed to parse CSV: ' + errors[0].message);
  }

  // Group rows by posted_when → each group = 1 workout
  const workoutGroups = new Map<string, Record<string, string>[]>();
  for (const row of data) {
    const key = row.posted_when;
    if (!key) continue;
    if (!workoutGroups.has(key)) workoutGroups.set(key, []);
    workoutGroups.get(key)!.push(row);
  }

  const workouts: ImportedWorkout[] = [];

  for (const [postedWhen, rows] of workoutGroups) {
    const duration = parseLiftoffDuration(rows[0].session_length || '');

    // Group by ex_name (preserving order)
    const exerciseMap = new Map<string, Record<string, string>[]>();
    for (const row of rows) {
      const name = row.ex_name;
      if (!name) continue;
      if (!exerciseMap.has(name)) exerciseMap.set(name, []);
      exerciseMap.get(name)!.push(row);
    }

    const exercises: ImportedExercise[] = [];
    for (const [name, setRows] of exerciseMap) {
      // Sort by ex_index
      setRows.sort((a, b) => parseInt(a.ex_index, 10) - parseInt(b.ex_index, 10));

      const sets: ImportedSet[] = setRows.map((row, i) => ({
        set_number: i + 1,
        kg: Math.round((parseFloat(row.first_input) || 0) * 10) / 10,
        reps: parseInt(row.second_input, 10) || 0,
        set_type: mapLiftoffSetType(row.set_type || 'normal'),
      }));

      exercises.push({ name, exercise_type: 'weighted', sets });
    }

    workouts.push({ created_at: postedWhen, duration, exercises });
  }

  return workouts;
}

// ── Strong TSV Parser ──────────────────────────────────

function parseStrongDuration(raw: string): number {
  // Formats: "2h 24m", "48s", "1h 5m 30s", "30m"
  let total = 0;
  const hours = raw.match(/(\d+)\s*h/i);
  const minutes = raw.match(/(\d+)\s*m(?!s)/i);
  const seconds = raw.match(/(\d+)\s*s/i);
  if (hours) total += parseInt(hours[1], 10) * 3600;
  if (minutes) total += parseInt(minutes[1], 10) * 60;
  if (seconds) total += parseInt(seconds[1], 10);
  return total;
}

export function parseStrongTSV(content: string): ImportedWorkout[] {
  const { data, errors } = Papa.parse<Record<string, string>>(content, {
    header: true,
    delimiter: '\t',
    skipEmptyLines: true,
  });

  if (errors.length > 0 && data.length === 0) {
    throw new Error('Failed to parse TSV: ' + errors[0].message);
  }

  // Group rows by Date → each group = 1 workout
  const workoutGroups = new Map<string, Record<string, string>[]>();
  for (const row of data) {
    const key = row.Date;
    if (!key) continue;
    if (!workoutGroups.has(key)) workoutGroups.set(key, []);
    workoutGroups.get(key)!.push(row);
  }

  const workouts: ImportedWorkout[] = [];

  for (const [date, rows] of workoutGroups) {
    const duration = parseStrongDuration(rows[0].Duration || '');

    // Group by Exercise Name (preserving order)
    const exerciseMap = new Map<string, Record<string, string>[]>();
    for (const row of rows) {
      const name = row['Exercise Name'];
      if (!name) continue;
      if (!exerciseMap.has(name)) exerciseMap.set(name, []);
      exerciseMap.get(name)!.push(row);
    }

    const exercises: ImportedExercise[] = [];
    for (const [name, setRows] of exerciseMap) {
      // Sort by Set Order
      setRows.sort((a, b) => parseInt(a['Set Order'], 10) - parseInt(b['Set Order'], 10));

      const sets: ImportedSet[] = setRows.map((row) => ({
        set_number: parseInt(row['Set Order'], 10) || 1,
        kg: Math.round((parseFloat(row.Weight) || 0) * 10) / 10,
        reps: parseInt(row.Reps, 10) || 0,
        set_type: 'working' as const,
      }));

      exercises.push({ name, exercise_type: 'weighted', sets });
    }

    workouts.push({ created_at: date, duration, exercises });
  }

  return workouts;
}

// ── Alias Resolution ────────────────────────────────────

export function resolveAliases(
  workouts: ImportedWorkout[],
  aliasMap: Record<string, string>,
): void {
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const canonical = aliasMap[ex.name];
      if (canonical) ex.name = canonical;
    }
  }
}

// ── Unknown Exercise Detection ─────────────────────────

export function findUnknownExercises(
  workouts: ImportedWorkout[],
  catalogMap: Record<string, unknown>,
): string[] {
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!seen.has(ex.name)) {
        seen.add(ex.name);
        if (!catalogMap[ex.name]) unknown.push(ex.name);
      }
    }
  }
  return unknown;
}
