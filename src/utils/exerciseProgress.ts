/**
 * Per-exercise progress math shared by the active workout sheet:
 * session volume for the inline progress chart, the progressive-overload
 * target and pace line, and the per-set suggestion engine.
 *
 * Pure functions only — no React, no I/O.
 */

export type ExerciseType = 'weighted' | 'bodyweight' | 'duration' | 'weighted+bodyweight';

/** A completed past session of one exercise (working/drop/failure sets only — no warmups). */
export interface ExerciseSession {
  date: string;
  sets: { kg: number; reps: number }[];
}

/** Volume growth per session the target-pace line assumes (compounding). */
const OVERLOAD_PACE_PER_SESSION = 0.015;

function isSimpleType(type: ExerciseType): boolean {
  return type === 'bodyweight' || type === 'duration';
}

/** Legend label for the volume bars. */
export function volumeLabel(type: ExerciseType): string {
  if (type === 'duration') return 'Total time';
  if (type === 'bodyweight') return 'Total reps';
  return 'Volume';
}

/**
 * Volume of one session: kg × reps for loaded exercises, total reps for
 * bodyweight, total seconds for timed. Returns 0 for no sets.
 */
export function sessionVolume(sets: { kg: number; reps: number }[], type: ExerciseType): number {
  if (isSimpleType(type)) return sets.reduce((sum, s) => sum + s.reps, 0);
  return sets.reduce((sum, s) => sum + s.kg * s.reps, 0);
}

/** Target-pace volume `n` sessions after a session with volume `base`. */
export function paceTarget(base: number, n: number, rate = OVERLOAD_PACE_PER_SESSION): number {
  return base * Math.pow(1 + rate, n);
}

/** Today's completed, non-warmup sets from the active workout, parsed to numbers. */
export function completedSetsToday(
  sets: { kg: string; reps: string; completed: boolean; set_type: string }[],
): { kg: number; reps: number }[] {
  const out: { kg: number; reps: number }[] = [];
  for (const s of sets) {
    if (!s.completed || s.set_type === 'warmup') continue;
    const kg = parseFloat(s.kg) || 0;
    const reps = parseInt(s.reps, 10) || 0;
    if (reps > 0) out.push({ kg, reps });
  }
  return out;
}

/** Round for display/comparison so float noise (e.g. e1RM) doesn't decide "beaten". */
function roundMetric(v: number): number {
  return Math.round(v * 10) / 10;
}

/** True when today's value strictly beats the target. */
export function beatsTarget(today: number, target: number): boolean {
  return target > 0 && roundMetric(today) > roundMetric(target);
}

function formatSeconds(total: number): string {
  const s = Math.round(total);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

function formatNumber(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (v >= 1000) return Math.round(v).toLocaleString();
  // Two decimals so plate increments like 8.75 kg aren't rounded to 8.8
  return String(Math.round(v * 100) / 100);
}

/** Human-readable volume, with its unit unless `withUnit` is false. */
export function formatVolume(v: number, type: ExerciseType, withUnit = true): string {
  if (type === 'duration') return formatSeconds(v);
  const n = formatNumber(v);
  if (!withUnit) return n;
  return type === 'bodyweight' ? `${n} reps` : `${n} kg`;
}

/* ─── Per-set suggestion engine ──────────────────────────── */

/**
 * Suggest kg/reps for each uncompleted set so that total volume beats the
 * previous session. Completed sets get null. Bodyweight/duration exercises
 * aim to beat total reps/seconds.
 */
export function suggestSets(
  sets: { kg: string; reps: string; completed: boolean }[],
  prevSets: { kg: number; reps: number }[] | undefined,
  exerciseType: ExerciseType,
): ({ kg: number; reps: number } | null)[] {
  if (!prevSets || prevSets.length === 0) return sets.map(() => null);

  const isSimple = isSimpleType(exerciseType);

  const prevTotal = prevSets.reduce((sum, s) => sum + (isSimple ? s.reps : s.kg * s.reps), 0);
  if (prevTotal <= 0) return sets.map(() => null);

  let completedVol = 0;
  let lastKg = 0;
  let lastReps = 0;
  for (const s of sets) {
    if (s.completed) {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps, 10) || 0;
      completedVol += isSimple ? reps : kg * reps;
      if (kg > 0 || isSimple) { lastKg = kg; lastReps = reps; }
    }
  }

  const results: ({ kg: number; reps: number } | null)[] = [];
  let runningVol = completedVol;
  let uncompleted = sets.filter((s) => !s.completed).length;

  for (let i = 0; i < sets.length; i++) {
    if (sets[i].completed) { results.push(null); continue; }

    const prev = prevSets[Math.min(i, prevSets.length - 1)];
    const volLeft = Math.max(prevTotal - runningVol + 1, 0);

    if (volLeft <= 0 || uncompleted <= 0) {
      results.push(prev ? { kg: prev.kg, reps: prev.reps } : null);
      uncompleted--;
      continue;
    }

    if (isSimple) {
      const perSet = Math.ceil(volLeft / uncompleted);
      const reps = Math.max(perSet, (prev?.reps || 0) + 1);
      results.push({ kg: 0, reps });
      runningVol += reps;
    } else {
      const baseKg = lastKg > 0 ? lastKg : (prev?.kg || 0);
      const baseReps = lastKg > 0 ? lastReps : (prev?.reps || 0);
      if (baseKg <= 0) { results.push(null); uncompleted--; continue; }

      const e1rm = baseKg * (1 + baseReps / 30);
      const volPerSet = Math.ceil(volLeft / uncompleted);
      const needed = Math.max(Math.ceil(volPerSet / baseKg), 1);
      const maxPossible = Math.max(Math.round(30 * (e1rm / baseKg - 1)), 1);

      let suggestReps = Math.min(needed, maxPossible);
      // Never suggest fewer reps than prev — aim to beat each set
      if (prev && baseKg <= prev.kg) {
        suggestReps = Math.max(suggestReps, prev.reps + 1);
      }

      results.push({ kg: baseKg, reps: suggestReps });
      runningVol += baseKg * suggestReps;
    }
    uncompleted--;
  }

  return results;
}
