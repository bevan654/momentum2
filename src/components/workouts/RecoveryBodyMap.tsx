import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { PressedRegion } from 'momentum-muscle-map';
import { useColors } from '../../theme/useColors';
import { sw } from '../../theme/responsive';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useRegionWeightLookup } from '../../hooks/useRegionWeightLookup';
import {
  partsOf,
  recoveryStatus,
  recoveryValues,
  regionBodyGroup,
  regionRecovery,
  type RecoveryStatus,
} from '../../utils/muscleVolume';
import { regionLabel } from '../../constants/muscleMapLabels';
import MuscleMapPair from '../body/MuscleMapPair';
import LevelToggle from '../body/LevelToggle';
import RegionChip from '../body/RegionChip';
import { useMuscleMapColors, useMuscleMapLevel } from '../body/useBodyMap';

const BODY_HEIGHT = sw(240);

const STATUS_LABELS: Record<RecoveryStatus, string> = {
  fatigued: 'Fatigued',
  recovering: 'Recovering',
  ready: 'Ready',
};

interface Props {
  /** Body-graph groups to show (chest, back, biceps, ...). Empty shows every region. */
  groups: ReadonlySet<string>;
}

/**
 * Fatigue by region: a region trained as a primary muscle this week glows until it has
 * recovered. Tapping a region shows its recovery.
 */
function RecoveryBodyMap({ groups }: Props) {
  const colors = useColors();
  const workouts = useWorkoutStore((s) => s.workouts);
  const lookup = useRegionWeightLookup();
  const recovery = useMemo(() => regionRecovery(workouts, lookup), [workouts, lookup]);
  const values = useMemo(
    () => recoveryValues(recovery, groups.size > 0 ? (region) => groups.has(regionBodyGroup(region) ?? '') : undefined),
    [recovery, groups],
  );
  const mapColors = useMuscleMapColors(colors.accentRed);
  const [level, setLevel] = useMuscleMapLevel();
  const [selected, setSelected] = useState<PressedRegion | null>(null);

  useEffect(() => setSelected(null), [level, values]);

  const onRegionPress = useCallback((region: PressedRegion) => {
    setSelected((prev) => (!region.isMuscle || prev?.id === region.id ? null : region));
  }, []);

  const detail = useMemo(() => {
    if (!selected) return null;
    // A muscle or group is as fatigued as its most fatigued part
    let percent = 100;
    for (const part of partsOf(selected.level, selected.key)) percent = Math.min(percent, recovery[part]?.percent ?? 100);
    const status = recoveryStatus(percent);
    const color = status === 'fatigued' ? colors.accentRed : status === 'recovering' ? colors.accentOrange : colors.accentGreen;
    return { text: `${STATUS_LABELS[status]} · ${percent}%`, color };
  }, [selected, recovery, colors]);

  return (
    <View style={styles.container}>
      <MuscleMapPair values={values} level={level} colors={mapColors} height={BODY_HEIGHT} onRegionPress={onRegionPress} />
      <LevelToggle level={level} onChange={setLevel} />
      {selected && detail && <RegionChip label={regionLabel(selected.key)} detail={detail.text} color={detail.color} />}
    </View>
  );
}

export default React.memo(RecoveryBodyMap);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: sw(8),
    marginBottom: sw(10),
  },
});
