/**
 * activity_feed.exercise_details: the per-exercise snapshot a feed card draws from. Built
 * the same way when a workout is posted and when a saved workout is edited. Pure.
 */

type DetailSet = { kg: string | number; reps: string | number };

export interface FeedExerciseDetail {
  name: string;
  sets_count: number;
  best_kg: number;
  best_reps: number;
  total_volume: number;
  /** For the card's muscle map: bodyweight reps count there (utils/muscleLoad.ts) */
  total_reps: number;
  exercise_type: string;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

type CatalogLookup = Readonly<
  Record<string, { category?: string | null; primary_muscles?: string[]; secondary_muscles?: string[] } | undefined>
>;

function num(v: string | number, int: boolean): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  return (int ? parseInt(v, 10) : parseFloat(v)) || 0;
}

/**
 * The best set: the heaviest, with reps breaking ties, so bodyweight exercises (all 0 kg) get
 * their best reps. Assisted exercises store the assistance as negative kg, so the least
 * assistance is the best. { kg: 0, reps: 0 } when there are no sets.
 */
export function bestSet(sets: readonly DetailSet[]): { kg: number; reps: number } {
  let best: { kg: number; reps: number } | null = null;
  for (const s of sets) {
    const kg = num(s.kg, false);
    const reps = num(s.reps, true);
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) best = { kg, reps };
  }
  return best ?? { kg: 0, reps: 0 };
}

/** Exercise details for the feed, from sets that have a weight or reps entered. */
export function buildFeedExerciseDetails(
  exercises: readonly { name: string; exercise_type?: string | null; sets: readonly DetailSet[] }[],
  catalogMap: CatalogLookup,
): FeedExerciseDetail[] {
  return exercises.map((ex) => {
    const sets = ex.sets.filter((s) => String(s.kg).trim() !== '' || String(s.reps).trim() !== '');
    let volume = 0;
    let totalReps = 0;
    for (const s of sets) {
      const kg = num(s.kg, false);
      const reps = num(s.reps, true);
      volume += kg * reps;
      totalReps += reps;
    }
    const best = bestSet(sets);
    const cat = catalogMap[ex.name];
    return {
      name: ex.name,
      sets_count: sets.length,
      best_kg: best.kg,
      best_reps: best.reps,
      total_volume: Math.round(volume),
      total_reps: totalReps,
      exercise_type: ex.exercise_type || 'weighted',
      category: cat?.category || null,
      primary_muscles: cat?.primary_muscles || [],
      secondary_muscles: cat?.secondary_muscles || [],
    };
  });
}
