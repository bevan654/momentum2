/**
 * Configuration of the deep body map (momentum-muscle-map). Region slugs are that library's
 * public API (its src/data/hierarchy.ts); they are unsided here, and the library applies an
 * unsided value to both sides.
 *
 * The product decisions live in this file: how much volume counts as "fully trained", and when a
 * region counts as fatigued.
 */
import type { CanonicalMuscle } from './muscles';

/** Region-id set of the map the app renders. exercise_region_targets rows are keyed by it. */
export const MUSCLE_MAP_ID = 'momentum-muscle-map@0.1';

/** Legacy weights when an exercise has no exercise_region_targets rows. */
export const PRIMARY_WEIGHT = 1;
export const SECONDARY_WEIGHT = 0.5;

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

/** Regions a canonical muscle name doesn't light on its own; only a finer name below does. */
export const NAMED_ONLY_REGIONS: ReadonlySet<string> = new Set([
  'sternocleidomastoid',
  'levator_scapulae',
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
 * PRODUCT DECISION — recovery map. As before: a region is fatigued by a workout in the last
 * RECOVERY_WINDOW_DAYS days that trained it as a primary muscle, and recovers over its group's
 * RECOVERY_HOURS (constants/muscles.ts).
 */
export const RECOVERY_WINDOW_DAYS = 7;
/** Smallest region weight that counts as a primary muscle (legacy primary = 1, secondary = 0.5). */
export const RECOVERY_PRIMARY_WEIGHT = 0.75;
/** Recovery % below which a region is fatigued, and below which it is still recovering. */
export const RECOVERY_FATIGUED_BELOW = 40;
export const RECOVERY_READY_FROM = 70;
