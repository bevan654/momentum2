import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import ExerciseRow, { type RowStyles } from './ExerciseRow';
import type { CatalogEntry } from './pickerData';

/** Top of the picker list: leaderboard lifts and recently used exercises, then the "All Exercises" heading. */
function ExerciseListHeader({ defaultSections, handleSelect, rowStyles }: {
  defaultSections: { visible: boolean; leaderboard: CatalogEntry[]; recent: CatalogEntry[] };
  handleSelect: (name: string, category: string, exerciseType: string) => void;
  rowStyles: RowStyles;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!defaultSections.visible) return null;
  return (
    <View>
      {defaultSections.leaderboard.length > 0 && (
        <View style={styles.exerciseSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={ms(13)} color={colors.accent} />
            <Text style={styles.sectionTitle}>Leaderboard Exercises</Text>
          </View>
          {defaultSections.leaderboard.map((entry) => (
            <ExerciseRow
              key={`leaderboard-${entry.name}`}
              name={entry.name}
              category={entry.category || ''}
              exercise_type={entry.exercise_type}
              primary_muscles={entry.primary_muscles}
              onSelect={handleSelect}
              styles={rowStyles}
            />
          ))}
        </View>
      )}

      {defaultSections.recent.length > 0 && (
        <View style={styles.exerciseSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={ms(13)} color={colors.textTertiary} />
            <Text style={styles.sectionTitle}>Recently Used</Text>
          </View>
          {defaultSections.recent.map((entry) => (
            <ExerciseRow
              key={`recent-${entry.name}`}
              name={entry.name}
              category={entry.category || ''}
              exercise_type={entry.exercise_type}
              primary_muscles={entry.primary_muscles}
              onSelect={handleSelect}
              styles={rowStyles}
            />
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Ionicons name="list-outline" size={ms(13)} color={colors.textTertiary} />
        <Text style={styles.sectionTitle}>All Exercises</Text>
      </View>
    </View>
  );
}

export default React.memo(ExerciseListHeader);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    exerciseSection: {
      paddingBottom: sw(8),
      marginBottom: sw(4),
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(4),
      paddingTop: sw(8),
      paddingBottom: sw(5),
    },
    sectionTitle: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.bold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  });
