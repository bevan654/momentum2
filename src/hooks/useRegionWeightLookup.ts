import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useRegionTargetsStore } from '../stores/useRegionTargetsStore';
import { makeRegionWeightLookup, type RegionWeightLookup } from '../utils/muscleVolume';

/**
 * Body-map region weights for exercises, from exercise_region_targets with the legacy-muscle
 * fallback. A new function whenever the catalog or the targets change, so memoised map values
 * recompute when the targets arrive.
 */
export function useRegionWeightLookup(): RegionWeightLookup {
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const targets = useRegionTargetsStore((s) => s.byCatalogId);
  useEffect(() => {
    useRegionTargetsStore.getState().load();
  }, []);
  return useMemo(() => makeRegionWeightLookup(catalogMap, targets), [catalogMap, targets]);
}
