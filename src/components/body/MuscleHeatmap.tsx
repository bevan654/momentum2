import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, InteractionManager } from 'react-native';
import type { PressedRegion } from 'momentum-muscle-map';
import { sw } from '../../theme/responsive';
import { useRegionWeightLookup } from '../../hooks/useRegionWeightLookup';
import { heatValues, partsOf, regionVolume, type VolumeExercise } from '../../utils/muscleVolume';
import { regionLabel } from '../../constants/muscleMapLabels';
import MuscleMapPair from './MuscleMapPair';
import LevelToggle from './LevelToggle';
import RegionChip from './RegionChip';
import { useMuscleMapColors, useMuscleMapLevel } from './useBodyMap';

const BODY_HEIGHT = sw(190);

function formatKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}k kg` : `${Math.round(kg)} kg`;
}

interface Props {
  exercises: readonly VolumeExercise[];
}

/**
 * One workout's muscle heat, front and back. Tapping a region shows its weighted volume and how
 * close it got to a full session (FULL_HEAT_VOLUME).
 */
function MuscleHeatmap({ exercises }: Props) {
  const lookup = useRegionWeightLookup();
  const volume = useMemo(() => regionVolume(exercises, lookup), [exercises, lookup]);
  const values = useMemo(() => heatValues(volume), [volume]);
  const colors = useMuscleMapColors();
  const [level, setLevel] = useMuscleMapLevel();
  const [selected, setSelected] = useState<PressedRegion | null>(null);

  // Mount the maps after the summary's opening animation
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  useEffect(() => setSelected(null), [level, values]);

  const onRegionPress = useCallback((region: PressedRegion) => {
    setSelected((prev) => (!region.isMuscle || prev?.id === region.id ? null : region));
  }, []);

  const detail = useMemo(() => {
    if (!selected) return null;
    let kg = 0;
    let heat = 0;
    for (const part of partsOf(selected.level, selected.key)) {
      kg = Math.max(kg, volume[part] ?? 0);
      heat = Math.max(heat, values[part] ?? 0);
    }
    return kg > 0 ? `${formatKg(kg)} · ${Math.round(heat * 100)}% of a full session` : 'Not trained';
  }, [selected, volume, values]);

  return (
    <View style={styles.container}>
      {ready ? (
        <MuscleMapPair values={values} level={level} colors={colors} height={BODY_HEIGHT} captions onRegionPress={onRegionPress} />
      ) : (
        <View style={styles.placeholder} />
      )}
      <LevelToggle level={level} onChange={setLevel} />
      {selected && detail && <RegionChip label={regionLabel(selected.key)} detail={detail} />}
    </View>
  );
}

export default React.memo(MuscleHeatmap);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: sw(8),
    marginVertical: sw(4),
  },
  placeholder: {
    height: BODY_HEIGHT + sw(16),
  },
});
