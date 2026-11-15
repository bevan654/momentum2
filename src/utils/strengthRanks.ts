/**
 * Rank tiers for the strength score: the score ranges for each tier name, separately for the
 * overall score, a muscle group's score and a single exercise's score.
 */

type RankName =
  | 'Novice'
  | 'Apprentice'
  | 'Intermediate'
  | 'Advanced'
  | 'Elite'
  | 'Master'
  | 'Grandmaster'
  | 'Titan'
  | 'Mythic'
  | 'Legend';

export interface RankInfo {
  name: RankName;
  minScore: number;
  maxScore: number;
  /** 0 → 1 progress toward next rank (1.0 if Legend). */
  progress: number;
}

/* ─── Rank thresholds ────────────────────────────────── */

interface RankThreshold {
  name: RankName;
  min: number;
  max: number;
}

const OVERALL_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 3.5 },
  { name: 'Apprentice', min: 3.5, max: 7 },
  { name: 'Intermediate', min: 7, max: 14 },
  { name: 'Advanced', min: 14, max: 24.5 },
  { name: 'Elite', min: 24.5, max: 35 },
  { name: 'Master', min: 35, max: 45.5 },
  { name: 'Grandmaster', min: 45.5, max: 59.5 },
  { name: 'Titan', min: 59.5, max: 77 },
  { name: 'Mythic', min: 77, max: 98 },
  { name: 'Legend', min: 98, max: Infinity },
];

const MUSCLE_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 0.5 },
  { name: 'Apprentice', min: 0.5, max: 1.0 },
  { name: 'Intermediate', min: 1.0, max: 2.0 },
  { name: 'Advanced', min: 2.0, max: 3.5 },
  { name: 'Elite', min: 3.5, max: 5.0 },
  { name: 'Master', min: 5.0, max: 6.5 },
  { name: 'Grandmaster', min: 6.5, max: 8.5 },
  { name: 'Titan', min: 8.5, max: 11 },
  { name: 'Mythic', min: 11, max: 14 },
  { name: 'Legend', min: 14, max: Infinity },
];

const EXERCISE_THRESHOLDS: RankThreshold[] = [
  { name: 'Novice', min: 0, max: 0.2 },
  { name: 'Apprentice', min: 0.2, max: 0.4 },
  { name: 'Intermediate', min: 0.4, max: 0.7 },
  { name: 'Advanced', min: 0.7, max: 1.0 },
  { name: 'Elite', min: 1.0, max: 1.3 },
  { name: 'Master', min: 1.3, max: 1.6 },
  { name: 'Grandmaster', min: 1.6, max: 2.0 },
  { name: 'Titan', min: 2.0, max: 2.5 },
  { name: 'Mythic', min: 2.5, max: 3.0 },
  { name: 'Legend', min: 3.0, max: Infinity },
];

/* ═══════════════════════════════════════════════════════
   Rank lookup (tier and progress through it)
   ═══════════════════════════════════════════════════════ */

function lookupRank(score: number, thresholds: RankThreshold[]): RankInfo {
  for (const t of thresholds) {
    if (score < t.max) {
      const range = t.max === Infinity ? 1 : t.max - t.min;
      const progress = t.max === Infinity ? 1 : (score - t.min) / range;
      return { name: t.name, minScore: t.min, maxScore: t.max, progress };
    }
  }
  const last = thresholds[thresholds.length - 1];
  return { name: last.name, minScore: last.min, maxScore: last.max, progress: 1 };
}

export function getOverallRank(score: number): RankInfo {
  return lookupRank(score, OVERALL_THRESHOLDS);
}

export function getMuscleRank(score: number): RankInfo {
  return lookupRank(score, MUSCLE_THRESHOLDS);
}

export function getExerciseRank(score: number): RankInfo {
  return lookupRank(score, EXERCISE_THRESHOLDS);
}
