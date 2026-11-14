/**
 * Configuration of the deep body map (momentum-muscle-map). Region slugs are that library's
 * public API (its src/data/hierarchy.ts); they are unsided here, and the library applies an
 * unsided value to both sides.
 *
 * The product decisions live in this file: how much volume counts as "fully trained", how far a
 * region worked only as a secondary muscle can light up, and when a region counts as fatigued.
 */
import type { CanonicalMuscle } from './muscles';

/** Region-id set of the map the app renders. exercise_region_targets rows are keyed by it. */
export const MUSCLE_MAP_ID = 'momentum-muscle-map@0.1';

/** Legacy weights when an exercise has no exercise_region_targets rows. */
export const PRIMARY_WEIGHT = 1;
export const SECONDARY_WEIGHT = 0.5;

/**
 * Smallest region weight at which an exercise works a region as a primary muscle (legacy primary
 * = 1, secondary = 0.5). Decides which regions count as trained directly, for heat and recovery.
 */
export const PRIMARY_WORK_WEIGHT = 0.75;

/**
 * Every muscle region (part slug) of the map → the legacy canonical muscle it belongs to. Gives a
 * region its full-heat volume and recovery time, and decides which regions a legacy muscle name
 * lights (see NAMED_ONLY_REGIONS).
 */
export const REGION_OWNER: Record<string, CanonicalMuscle> = {
  sternocleidomastoid: 'traps',
  levator_scapulae: 'traps',
  trapezius_upper: 'traps',
  trapezius_mid: 'upper-back',
  trapezius_lower: 'upper-back',
  rhomboids: 'upper-back',
  deltoid_anterior: 'shoulders',
  deltoid_lateral: 'shoulders',
  deltoid_posterior: 'rear-delts',
  infraspinatus: 'rear-delts',
  teres_minor: 'rear-delts',
  teres_major: 'lats',
  pectoralis_major_clavicular: 'chest',
  pectoralis_major_sternal: 'chest',
  pectoralis_major_abdominal: 'chest',
  serratus_anterior_1: 'abs',
  serratus_anterior_2: 'abs',
  serratus_anterior_3: 'abs',
  latissimus_dorsi_upper: 'lats',
  latissimus_dorsi_lower: 'lats',
  erector_spinae_iliocostalis: 'lower-back',
  erector_spinae_longissimus: 'lower-back',
  rectus_abdominis_upper: 'abs',
  rectus_abdominis_mid: 'abs',
  rectus_abdominis_lower: 'abs',
  external_oblique: 'obliques',
  internal_oblique: 'obliques',
  biceps_brachii_long_head: 'biceps',
  biceps_brachii_short_head: 'biceps',
  brachialis: 'biceps',
  triceps_brachii_long_head: 'triceps',
  triceps_brachii_lateral_head: 'triceps',
  triceps_brachii_medial_head: 'triceps',
  anconeus: 'triceps',
  brachioradialis: 'forearms',
  pronator_teres: 'forearms',
  flexor_carpi_radialis: 'forearms',
  wrist_flexor_group: 'forearms',
  extensor_carpi_radialis: 'forearms',
  extensor_digitorum: 'forearms',
  extensor_carpi_ulnaris: 'forearms',
  gluteus_maximus_upper: 'glutes',
  gluteus_maximus_lower: 'glutes',
  gluteus_medius: 'glutes',
  tensor_fasciae_latae: 'quads',
  rectus_femoris: 'quads',
  vastus_lateralis: 'quads',
  vastus_medialis: 'quads',
  sartorius: 'quads',
  adductor_longus: 'adductors',
  adductor_magnus: 'adductors',
  pectineus: 'adductors',
  gracilis: 'adductors',
  biceps_femoris_long_head: 'hamstrings',
  biceps_femoris_short_head: 'hamstrings',
  semitendinosus: 'hamstrings',
  semimembranosus: 'hamstrings',
  gastrocnemius_medial: 'calves',
  gastrocnemius_lateral: 'calves',
  soleus: 'calves',
  tibialis_anterior: 'calves',
  peroneus_longus: 'calves',
};

/**
 * Regions a canonical muscle name doesn't light on its own; only a finer name below does.
 * teres_major recovers with the lats, but the map draws it in its shoulders group, so lighting it
 * from 'lats' would light the shoulders on every lat day at group level (feed cards, share images).
 */
export const NAMED_ONLY_REGIONS: ReadonlySet<string> = new Set([
  'sternocleidomastoid',
  'levator_scapulae',
  'teres_major',
  'serratus_anterior_1',
  'serratus_anterior_2',
  'serratus_anterior_3',
  'tensor_fasciae_latae',
  'sartorius',
  'tibialis_anterior',
  'peroneus_longus',
]);

/**
 * Legacy muscle names (lowercase, spaces) that are finer than their canonical muscle. Any other
 * name goes through toCanonical() and lights that muscle's regions.
 */
export const LEGACY_NAME_REGIONS: Record<string, readonly string[]> = {
  neck: ['sternocleidomastoid', 'levator_scapulae'],
  'upper chest': ['pectoralis_major_clavicular'],
  'front delts': ['deltoid_anterior'],
  'anterior deltoid': ['deltoid_anterior'],
  'side delts': ['deltoid_lateral'],
  'lateral deltoid': ['deltoid_lateral'],
  rhomboids: ['rhomboids'],
  'teres major': ['teres_major'],
  brachialis: ['brachialis'],
  anconeus: ['anconeus'],
  'serratus anterior': ['serratus_anterior_1', 'serratus_anterior_2', 'serratus_anterior_3'],
  serratus: ['serratus_anterior_1', 'serratus_anterior_2', 'serratus_anterior_3'],
  'hip flexors': ['rectus_femoris', 'tensor_fasciae_latae', 'sartorius'],
  'tensor fasciae latae': ['tensor_fasciae_latae'],
  gracilis: ['gracilis'],
  abductors: ['gluteus_medius', 'tensor_fasciae_latae'],
  abductor: ['gluteus_medius', 'tensor_fasciae_latae'],
  'hip abductors': ['gluteus_medius', 'tensor_fasciae_latae'],
  tibialis: ['tibialis_anterior'],
  soleus: ['soleus'],
  gastrocnemius: ['gastrocnemius_medial', 'gastrocnemius_lateral'],
  'gluteus maximus': ['gluteus_maximus_upper', 'gluteus_maximus_lower'],
};

/**
 * PRODUCT DECISION — what counts as "fully trained" in one workout.
 *
 * Weighted volume (kg × reps × the exercise's weight for the region) at which a region shows full
 * heat on per-workout maps (workout summary, feed cards, share images), by the canonical muscle
 * that owns the region. These are the old body map's per-session targets, unchanged, so a heat
 * level means about what it meant before.
 */
export const FULL_HEAT_VOLUME: Record<CanonicalMuscle, number> = {
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

/**
 * PRODUCT DECISION — bodyweight reps count toward muscle heat, Training Balance and recovery.
 *
 * A rep of a bodyweight exercise (exercise type bodyweight or weighted+bodyweight) loads the
 * muscles with bodyweight × the exercise's fraction (BODYWEIGHT_FRACTIONS) + any added kg; an
 * assisted one with bodyweight × fraction − the assistance (src/utils/muscleLoad.ts). Only these
 * maps use it: workout and feed totals, leaderboards, PRs and strength score stay kg × reps.
 *
 * Bodyweight is the user's latest weight entry, else their profile's starting weight, else
 * DEFAULT_BODYWEIGHT_KG. Other users' feed cards always use DEFAULT_BODYWEIGHT_KG: the app doesn't
 * have their bodyweight, and the card shouldn't reveal it.
 */
export const DEFAULT_BODYWEIGHT_KG = 75;

/** Fraction of bodyweight a rep lifts when no BODYWEIGHT_FRACTIONS row matches the name. */
export const DEFAULT_BODYWEIGHT_FRACTION = 0.7;

/**
 * How much of the body a rep of a bodyweight exercise lifts, by name keywords. Names are matched
 * lowercase with anything but letters and digits turned into spaces ("Pull-Ups" → "pull ups"),
 * and the first matching row wins, so specific rows come before general ones. Holds and
 * locomotion count 0: their reps are usually seconds or distance.
 */
export const BODYWEIGHT_FRACTIONS: readonly { match: RegExp; fraction: number }[] = [
  { match: /\bhandstand\b/, fraction: 0.9 },
  { match: /\b(pull ?ups?|chin ?ups?|muscle ?ups?|rope climbs?)\b/, fraction: 1 },
  // Inverted, ring and suspension rows: the feet stay on the floor
  { match: /\brows?\b/, fraction: 0.6 },
  { match: /\b(bench|chair|crab|reverse plank) dips?\b/, fraction: 0.5 },
  { match: /\bdips?\b/, fraction: 1 },
  { match: /\b(knee|incline|wall)\b.*\b(push|press) ?ups?\b/, fraction: 0.45 },
  { match: /\bdecline\b.*\b(push|press) ?ups?\b/, fraction: 0.75 },
  { match: /\b(push|press) ?ups?\b/, fraction: 0.65 },
  { match: /\b(pistol|shrimp|single leg squats?)\b/, fraction: 0.9 },
  { match: /\b(squats?|lunges?|step ?ups?|cossack)\b/, fraction: 0.8 },
  { match: /\bcalf raises?\b/, fraction: 1 },
  { match: /\b(nordic|glute ham)\b/, fraction: 0.7 },
  { match: /\b(bridges?|hip thrusts?|back extensions?|hyperextensions?|good mornings?|superman|leg curls?|hamstring curls?)\b/, fraction: 0.5 },
  { match: /\b(leg raises?|knee raises?|toes to bar|knee tucks?|leg pull ins?|pike|v ups?|jackknife|flutter kicks?|scissor kicks?|windshield wipers?|dragon flags?|copenhagen)\b/, fraction: 0.4 },
  { match: /\b(crunch(es)?|sit ?ups?|twists?|heel touch(es)?|dead bugs?|bird dogs?)\b/, fraction: 0.3 },
  { match: /\b(abduction|adduction|clamshells?|fire hydrants?|kickbacks?|side kicks?|leg lifts?)\b/, fraction: 0.2 },
  // Suspension-trainer and lean-back moves not matched above: only part of the body is lifted
  { match: /\b(trx|suspension|face pulls?|y fly|curls?|triceps? extensions?|lateral raises?)\b/, fraction: 0.4 },
  { match: /\b(plank|hang|holds?|wall sit|l sit|hollow|run|running|jog|jogging|sprints?|walk|walking|crawl|mountain climbers?|jumping jacks?)\b/, fraction: 0 },
];

/**
 * PRODUCT DECISION — secondary-only regions never look "trained hard".
 *
 * Highest value a region can show on a training map (workout summary, feed cards, share images,
 * Training Balance, a routine's Muscles Targeted) when no exercise worked it as a primary muscle
 * (weight ≥ PRIMARY_WORK_WEIGHT): e.g. triceps on a bench-only day. The map glows above 0.6
 * (momentum-muscle-map's glowOpacity), so a capped region looks worked but never glows. Regions
 * with primary work aren't capped. The old body map capped secondary-only muscles the same way.
 */
export const SECONDARY_ONLY_MAX_HEAT = 0.55;

/**
 * PRODUCT DECISION — recovery map. As before: a region is fatigued by a workout in the last
 * RECOVERY_WINDOW_DAYS days that trained it as a primary muscle (PRIMARY_WORK_WEIGHT), and
 * recovers over its group's RECOVERY_HOURS (constants/muscles.ts).
 */
export const RECOVERY_WINDOW_DAYS = 7;
/** Recovery % below which a region is fatigued, and below which it is still recovering. */
export const RECOVERY_FATIGUED_BELOW = 40;
export const RECOVERY_READY_FROM = 70;
