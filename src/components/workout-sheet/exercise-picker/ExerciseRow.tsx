import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { getMuscleColor } from '../../../constants/muscles';
import { titleCase } from './pickerData';

/* ─── Muscle color (derived from muscles.ts) ─────────── */

function muscleColor(muscle: string): string {
  return getMuscleColor(muscle);
}

/** Styles for ExerciseRow. Built once by the picker and passed to every row (the list can hold thousands). */
export type RowStyles = ReturnType<typeof createRowStyles>;

/* ── Memoized row component ───────────────────────────── */

interface ExerciseRowProps {
  name: string;
  category: string;
  exercise_type: string;
  primary_muscles?: string[];
  onSelect: (name: string, category: string, exerciseType: string) => void;
  styles: RowStyles;
}

const ExerciseRow = memo(function ExerciseRow({
  name,
  category,
  exercise_type,
  primary_muscles,
  onSelect,
  styles,
}: ExerciseRowProps) {
  const subtitle = primary_muscles && primary_muscles.length > 0
    ? primary_muscles.map(titleCase).join(', ')
    : titleCase(category || '');
  return (
    <TouchableOpacity
      style={styles.exerciseRow}
      onPress={() => onSelect(name, category, exercise_type)}
      activeOpacity={0.6}
    >
      <View
        style={[
          styles.catDot,
          { backgroundColor: muscleColor(primary_muscles?.[0] || category || '') },
        ]}
      />
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>{titleCase(name)}</Text>
        <Text style={styles.exerciseCat}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
});

export default ExerciseRow;

export const createRowStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(10),
      paddingHorizontal: sw(4),
      gap: sw(10),
    },
    catDot: {
      width: sw(8),
      height: sw(8),
      borderRadius: 0,
    },
    exerciseInfo: {
      flex: 1,
      gap: sw(1),
    },
    exerciseName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(19),
    },
    exerciseCat: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
    },
  });
