import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { MAIN_MUSCLE_GROUPS } from './pickerData';
import { UI_CATEGORY_COLORS } from '../../../constants/muscles';

/** "All" plus one chip per main muscle group; tapping the active chip clears it. */
function MuscleFilterChips({ selectedMuscle, setSelectedMuscle }: {
  selectedMuscle: string | null;
  setSelectedMuscle: (group: string | null) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
      style={styles.chipScroll}
    >
      <TouchableOpacity
        style={[styles.chip, !selectedMuscle && styles.chipActive]}
        onPress={() => setSelectedMuscle(null)}
        activeOpacity={0.7}
      >
        <Text style={[styles.chipText, !selectedMuscle && styles.chipTextActive]}>
          All
        </Text>
      </TouchableOpacity>
      {MAIN_MUSCLE_GROUPS.map((group) => {
        const active = selectedMuscle === group;
        const gColor = (UI_CATEGORY_COLORS as Record<string, string>)[group] || colors.textTertiary;
        return (
          <TouchableOpacity
            key={group}
            style={[styles.chip, active && { backgroundColor: gColor + '25', borderColor: gColor }]}
            onPress={() => setSelectedMuscle(active ? null : group)}
            activeOpacity={0.7}
          >
            <View style={[styles.chipDot, { backgroundColor: gColor }]} />
            <Text style={[styles.chipText, active && { color: gColor }]}>
              {group}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default React.memo(MuscleFilterChips);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chipScroll: {
      maxHeight: sw(32),
      minHeight: sw(32),
      marginHorizontal: sw(16),
      marginBottom: sw(4),
    },
    chipRow: {
      gap: sw(6),
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: sw(5),
      paddingHorizontal: sw(10),
      paddingVertical: sw(4),
      borderRadius: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    chipDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: 0,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
    },
    chipTextActive: {
      color: colors.accent,
    },
  });
