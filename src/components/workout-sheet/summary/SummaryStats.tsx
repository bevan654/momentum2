import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { formatHoursMinutes } from '../../../utils/formatDuration';
import { formatVolume } from './summaryFormat';

interface Props {
  editing: boolean;
  /** Edit mode: the edited duration (tap opens the picker), exercise and set counts. */
  editDuration: number;
  editExerciseCount: number;
  editSetCount: number;
  onEditDuration: () => void;
  /** View mode. */
  duration: number;
  volume: number;
  topSet: { kg: number; reps: number } | null;
  totalExercises: number;
  totalSets: number;
}

/** The workout summary's stats row: duration, volume, top set, exercises, sets (or the edit-mode version). */
function SummaryStats({
  editing, editDuration, editExerciseCount, editSetCount, onEditDuration,
  duration, volume, topSet, totalExercises, totalSets,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (editing) {
    return (
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem} onPress={onEditDuration} activeOpacity={0.7}>
          <Text style={styles.statValue}>{formatHoursMinutes(editDuration)}</Text>
          <Text style={styles.durationEditHint}>tap to edit</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{editExerciseCount}</Text>
          <Text style={styles.statLabel}>Exercises</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{editSetCount}</Text>
          <Text style={styles.statLabel}>Sets</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatHoursMinutes(duration)}</Text>
        <Text style={styles.statLabel}>Duration</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatVolume(volume)}</Text>
        <Text style={styles.statLabel}>Volume</Text>
      </View>
      {topSet && (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{topSet.kg}×{topSet.reps}</Text>
            <Text style={styles.statLabel}>Top Set</Text>
          </View>
        </>
      )}
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalExercises}</Text>
        <Text style={styles.statLabel}>Exercises</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalSets}</Text>
        <Text style={styles.statLabel}>Sets</Text>
      </View>
    </View>
  );
}

export default React.memo(SummaryStats);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(6),
    marginBottom: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(1),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(20),
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    lineHeight: ms(13),
    letterSpacing: 0.3,
  },
  durationEditHint: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
});
