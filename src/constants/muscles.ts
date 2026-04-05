/**
 * Single source of truth for all muscle definitions, aliases, groupings, and colors.
 *
 * 17 canonical muscles → 11 body graph groups → 8 strength groups → 7 UI categories.
 *
 * Every file that needs muscle data should import from here.
 * The body graph SVG (musclePathData.ts) is NOT touched — its MuscleGroup type
 * is structurally identical to BodyGraphGroup defined here.
 */

// ─── Types ────────��───────────────────────────────────────────

/** The 17 canonical muscle identifiers stored in the exercise catalog. */
export type CanonicalMuscle =
  | 'chest'
  | 'lats'
  | 'upper-back'
  | 'lower-back'
  | 'traps'
  | 'shoulders'
  | 'rear-delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'adductors'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

/** 11 body-graph groups — mirrors MuscleGroup in musclePathData.ts (do NOT diverge). */
export type BodyGraphGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

/** 8 coarse groups used for strength ranking / scoring. */
export type StrengthGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'calves';

/** 7 UI categories shown in pickers, filters, and radar charts. */
export type UICategory =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Core'
  | 'Cardio';

// ─── Core Data ────────────────────────────────────────────────

export const CANONICAL_MUSCLES: CanonicalMuscle[] = [
  'chest',
  'lats',
  'upper-back',
  'lower-back',
  'traps',
  'shoulders',
  'rear-delts',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'adductors',
  'hamstrings',
  'glutes',
  'calves',
];

export const CANONICAL_LABELS: Record<CanonicalMuscle, string> = {
  chest: 'Chest',
  lats: 'Lats',
  'upper-back': 'Upper Back',
  'lower-back': 'Lower Back',
  traps: 'Traps',
  shoulders: 'Shoulders',
  'rear-delts': 'Rear Delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  adductors: 'Adductors',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

// ─── Group Mappings ───────���───────────────────────────────────

export const CANONICAL_TO_BODY_GROUP: Record<CanonicalMuscle, BodyGraphGroup> = {
  chest: 'chest',
  lats: 'back',
  'upper-back': 'back',
  'lower-back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  'rear-delts': 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'abs',
  quads: 'quads',
  adductors: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
};

export const CANONICAL_TO_STRENGTH_GROUP: Record<CanonicalMuscle, StrengthGroup> = {
  chest: 'chest',
  lats: 'back',
  'upper-back': 'back',
  'lower-back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  'rear-delts': 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'biceps', // forearms fold into biceps for strength scoring
  abs: 'abs',
  obliques: 'abs',
  quads: 'legs',
  adductors: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'calves',
};

export const CANONICAL_TO_UI_CATEGORY: Record<CanonicalMuscle, UICategory> = {
  chest: 'Chest',
  lats: 'Back',
  'upper-back': 'Back',
  'lower-back': 'Back',
  traps: 'Back',
  shoulders: 'Shoulders',
  'rear-delts': 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearms: 'Arms',
  abs: 'Core',
  obliques: 'Core',
  quads: 'Legs',
  adductors: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
};

// ─── Alias Table (backward compat) ───────────────────────────

export const MUSCLE_ALIASES: Record<string, CanonicalMuscle> = {
  // ── Identity (canonical names map to themselves) ──
  chest: 'chest',
  lats: 'lats',
  'upper-back': 'upper-back',
  'lower-back': 'lower-back',
  traps: 'traps',
  shoulders: 'shoulders',
  'rear-delts': 'rear-delts',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'obliques',
  quads: 'quads',
  adductors: 'adductors',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',

  // ── Chest variants ──
  'upper chest': 'chest',
  pectorals: 'chest',
  pecs: 'chest',
  'pectoralis major': 'chest',

  // ── Back variants ──
  latissimus: 'lats',
  'latissimus dorsi': 'lats',
  'upper back': 'upper-back',
  'middle back': 'upper-back',
  rhomboids: 'upper-back',
  'lower back': 'lower-back',
  'erector spinae': 'lower-back',
  trapezius: 'traps',
  trap: 'traps',

  // ── Shoulder variants ──
  shoulder: 'shoulders',
  deltoids: 'shoulders',
  deltoid: 'shoulders',
  delts: 'shoulders',
  'front delts': 'shoulders',
  'side delts': 'shoulders',
  'anterior deltoid': 'shoulders',
  'lateral deltoid': 'shoulders',
  'rear delts': 'rear-delts',
  'rear deltoids': 'rear-delts',
  'posterior deltoid': 'rear-delts',

  // ── Arm variants ──
  bicep: 'biceps',
  brachialis: 'biceps',
  tricep: 'triceps',
  anconeus: 'triceps',
  forearm: 'forearms',

  // ── Core variants ──
  core: 'abs',
  abdominals: 'abs',
  abdominal: 'abs',
  'rectus abdominis': 'abs',
  oblique: 'obliques',
  'serratus anterior': 'abs',
  serratus: 'abs',

  // ── Leg variants ──
  quadriceps: 'quads',
  quad: 'quads',
  'hip flexors': 'quads',
  'tensor fasciae latae': 'quads',
  hamstring: 'hamstrings',
  glute: 'glutes',
  gluteal: 'glutes',
  gluteus: 'glutes',
  'gluteus maximus': 'glutes',
  adductor: 'adductors',
  gracilis: 'adductors',
  abductors: 'glutes',
  abductor: 'glutes',
  'hip abductors': 'glutes',
  calf: 'calves',
  tibialis: 'calves',
  soleus: 'calves',
  gastrocnemius: 'calves',

  // ── Old slug names (from muscleVolume.ts Slug type) ──
  'rear-deltoids': 'rear-delts',
};

/**
 * Normalize any raw muscle string to a canonical muscle name.
 * Returns null for non-muscle strings (e.g. 'head', 'feet').
 */
export function toCanonical(raw: string): CanonicalMuscle | null {
  const key = raw.trim().toLowerCase().replace(/_/g, ' ');
  return MUSCLE_ALIASES[key] ?? null;
}

// ─── Category → Muscles ────���─────────────────────────────────

export const CATEGORY_MUSCLES: Record<UICategory | 'Custom', CanonicalMuscle[]> = {
  Chest: ['chest'],
  Back: ['lats', 'upper-back', 'lower-back', 'traps'],
  Shoulders: ['shoulders', 'rear-delts'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quads', 'adductors', 'hamstrings', 'glutes', 'calves'],
  Core: ['abs', 'obliques'],
  Cardio: [],
  Custom: [],
};

// ─── Colors ──────────────────────────────────────────────────

export const UI_CATEGORY_COLORS: Record<UICategory | 'Custom', string> = {
  Chest: '#EF4444',
  Back: '#3B82F6',
  Shoulders: '#F59E0B',
  Arms: '#8B5CF6',
  Legs: '#34D399',
  Core: '#F97316',
  Cardio: '#EC4899',
  Custom: '#6B7280',
};

export const MUSCLE_COLORS: Record<CanonicalMuscle, string> = {
  chest: '#EF4444',
  lats: '#3B82F6',
  'upper-back': '#3B82F6',
  'lower-back': '#3B82F6',
  traps: '#3B82F6',
  shoulders: '#F59E0B',
  'rear-delts': '#F59E0B',
  biceps: '#8B5CF6',
  triceps: '#8B5CF6',
  forearms: '#8B5CF6',
  abs: '#F97316',
  obliques: '#F97316',
  quads: '#34D399',
  adductors: '#34D399',
  hamstrings: '#34D399',
  glutes: '#34D399',
  calves: '#34D399',
};

/** Resolve any raw muscle string to a hex color. Falls back to grey. */
export function getMuscleColor(raw: string): string {
  const canonical = toCanonical(raw);
  return canonical ? MUSCLE_COLORS[canonical] : '#6B7280';
}

/** Get color for a UI category string. Falls back to grey. */
export function getUICategoryColor(category: string): string {
  return (UI_CATEGORY_COLORS as Record<string, string>)[category] ?? '#6B7280';
}

// ─── Volume & Recovery ───────────────────────────────────────

/** Target weekly volume per canonical muscle (arbitrary units). */
export const TARGET_VOLUME: Record<CanonicalMuscle, number> = {
  chest: 2000,
  lats: 2000,
  'upper-back': 2000,
  'lower-back': 1200,
  traps: 600,
  shoulders: 1200,
  'rear-delts': 800,
  biceps: 600,
  triceps: 800,
  forearms: 400,
  abs: 600,
  obliques: 600,
  quads: 2500,
  adductors: 1000,
  hamstrings: 2000,
  glutes: 2500,
  calves: 800,
};

/** Recovery hours per body-graph group (used for recovery timers). */
export const RECOVERY_HOURS: Record<BodyGraphGroup, number> = {
  chest: 72,
  back: 72,
  shoulders: 48,
  biceps: 48,
  triceps: 48,
  forearms: 36,
  abs: 36,
  quads: 72,
  hamstrings: 72,
  glutes: 72,
  calves: 48,
};

// ─── SVG Slug Bridge ─────────────────────────────────────────
// The BodyHighlighter SVG uses legacy slug names (e.g. 'deltoids', 'gluteal').
// This mapping bridges canonical → SVG slug for volume/heatmap calculations.
// Note: multiple canonicals can map to the same SVG slug (e.g. lats + upper-back → 'upper-back').

export const CANONICAL_TO_SVG_SLUG: Record<CanonicalMuscle, string> = {
  chest: 'chest',
  lats: 'upper-back',
  'upper-back': 'upper-back',
  'lower-back': 'lower-back',
  traps: 'trapezius',
  shoulders: 'deltoids',
  'rear-delts': 'rear-deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  quads: 'quadriceps',
  adductors: 'adductors',
  hamstrings: 'hamstring',
  glutes: 'gluteal',
  calves: 'calves',
};

/** SVG slug → body graph group. Derived from canonical mappings. */
export const SVG_SLUG_TO_BODY_GROUP: Record<string, BodyGraphGroup> = (() => {
  const map: Record<string, BodyGraphGroup> = {};
  for (const canonical of CANONICAL_MUSCLES) {
    const svgSlug = CANONICAL_TO_SVG_SLUG[canonical];
    const group = CANONICAL_TO_BODY_GROUP[canonical];
    if (!map[svgSlug]) map[svgSlug] = group;
  }
  return map;
})();

// ─── Display Muscles (for custom exercise modal) ─────────────

export const DISPLAY_MUSCLES: { canonical: CanonicalMuscle; label: string }[] = [
  { canonical: 'chest', label: 'Chest' },
  { canonical: 'lats', label: 'Lats' },
  { canonical: 'upper-back', label: 'Upper Back' },
  { canonical: 'lower-back', label: 'Lower Back' },
  { canonical: 'traps', label: 'Traps' },
  { canonical: 'shoulders', label: 'Shoulders' },
  { canonical: 'rear-delts', label: 'Rear Delts' },
  { canonical: 'biceps', label: 'Biceps' },
  { canonical: 'triceps', label: 'Triceps' },
  { canonical: 'forearms', label: 'Forearms' },
  { canonical: 'abs', label: 'Abs' },
  { canonical: 'obliques', label: 'Obliques' },
  { canonical: 'quads', label: 'Quads' },
  { canonical: 'adductors', label: 'Adductors' },
  { canonical: 'hamstrings', label: 'Hamstrings' },
  { canonical: 'glutes', label: 'Glutes' },
  { canonical: 'calves', label: 'Calves' },
];
