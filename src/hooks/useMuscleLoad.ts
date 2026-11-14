import { useMemo } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { makeMuscleLoad, ownBodyweightKg, type MuscleLoad } from '../utils/muscleLoad';

/** The signed-in user's bodyweight for effective load (latest weight entry, starting weight, default). */
export function useOwnBodyweightKg(): number {
  const latest = useWeightStore((s) => s.current);
  const starting = useAuthStore((s) => s.profile?.starting_weight);
  return ownBodyweightKg(latest, starting);
}

/**
 * Effective-load context for muscle heat, Training Balance and recovery: the catalog's exercise
 * types and a bodyweight, the signed-in user's unless `bodyweightKg` is given (other users' feed
 * cards pass DEFAULT_BODYWEIGHT_KG).
 */
export function useMuscleLoad(bodyweightKg?: number): MuscleLoad {
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const own = useOwnBodyweightKg();
  const kg = bodyweightKg ?? own;
  return useMemo(() => makeMuscleLoad(catalogMap, kg), [catalogMap, kg]);
}
