import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import { getLastLabel } from './historyConstants';

/**
 * Recovery tab body-part filter: Whole / Chest / Back / Core / Arms / Legs, with Arms and Legs
 * expanding to their sub-parts. Each chip shows when that part was last trained.
 * Not memoised on purpose: the "5h ago" labels are computed at render and should refresh
 * whenever the screen re-renders, as before.
 */
export default function RecoveryFilterChips({
  debugParts, setDebugParts, expandedSection, setExpandedSection, lastTrainedMap, latestWorkoutDate,
}: {
  debugParts: string[];
  setDebugParts: React.Dispatch<React.SetStateAction<string[]>>;
  expandedSection: string | null;
  setExpandedSection: React.Dispatch<React.SetStateAction<string | null>>;
  lastTrainedMap: Record<string, Date | null>;
  latestWorkoutDate: string | undefined;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.filterContainer}>
      {/* Main row: Whole, Chest, Back, Core + section toggles */}
      <View style={styles.filterMainRow}>
        <TouchableOpacity
          onPress={() => { setDebugParts([]); setExpandedSection(null); }}
          style={[styles.filterChip, debugParts.length === 0 && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, debugParts.length === 0 && styles.filterChipTextActive]}>Whole</Text>
          <Text style={[styles.filterChipSub, debugParts.length === 0 && styles.filterChipSubActive]}>{getLastLabel(
            latestWorkoutDate ? new Date(latestWorkoutDate) : null
          )}</Text>
        </TouchableOpacity>
        {['Chest', 'Back', 'Core'].map((part) => (
          <TouchableOpacity
            key={part}
            onPress={() => {
              setExpandedSection(null);
              setDebugParts((prev) =>
                prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
              );
            }}
            style={[styles.filterChip, debugParts.includes(part) && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, debugParts.includes(part) && styles.filterChipTextActive]}>{part}</Text>
            <Text style={[styles.filterChipSub, debugParts.includes(part) && styles.filterChipSubActive]}>{getLastLabel(lastTrainedMap[part])}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => {
            if (expandedSection === 'Arms') {
              setExpandedSection(null);
              setDebugParts((prev) => prev.filter((p) => !['Arms', 'Shoulders', 'Biceps', 'Triceps'].includes(p)));
            } else {
              setExpandedSection('Arms');
              setDebugParts((prev) => {
                const without = prev.filter((p) => !['Arms', 'Shoulders', 'Biceps', 'Triceps'].includes(p));
                return [...without, 'Shoulders', 'Biceps', 'Triceps'];
              });
            }
          }}
          style={[styles.filterChip, debugParts.some((p) => ['Arms', 'Shoulders', 'Biceps', 'Triceps'].includes(p)) && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, debugParts.some((p) => ['Arms', 'Shoulders', 'Biceps', 'Triceps'].includes(p)) && styles.filterChipTextActive]}>Arms</Text>
          <Text style={[styles.filterChipSub, debugParts.some((p) => ['Arms', 'Shoulders', 'Biceps', 'Triceps'].includes(p)) && styles.filterChipSubActive]}>{getLastLabel(
            ['Shoulders', 'Biceps', 'Triceps'].reduce<Date | null>((best, k) => {
              const d = lastTrainedMap[k];
              return d && (!best || d > best) ? d : best;
            }, null)
          )}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (expandedSection === 'Legs') {
              setExpandedSection(null);
              setDebugParts((prev) => prev.filter((p) => !['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(p)));
            } else {
              setExpandedSection('Legs');
              setDebugParts((prev) => {
                const without = prev.filter((p) => !['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(p));
                return [...without, 'Quads', 'Hamstrings', 'Glutes', 'Calves'];
              });
            }
          }}
          style={[styles.filterChip, debugParts.some((p) => ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(p)) && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, debugParts.some((p) => ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(p)) && styles.filterChipTextActive]}>Legs</Text>
          <Text style={[styles.filterChipSub, debugParts.some((p) => ['Legs', 'Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(p)) && styles.filterChipSubActive]}>{getLastLabel(
            ['Quads', 'Hamstrings', 'Glutes', 'Calves'].reduce<Date | null>((best, k) => {
              const d = lastTrainedMap[k];
              return d && (!best || d > best) ? d : best;
            }, null)
          )}</Text>
        </TouchableOpacity>
      </View>
      {/* Expanded sub-parts */}
      {expandedSection === 'Arms' && (
        <View style={styles.filterExpandedRow}>
          {['Shoulders', 'Biceps', 'Triceps'].map((label) => {
            const isActive = debugParts.includes(label);
            const lastLabel = getLastLabel(lastTrainedMap[label]);
            return (
              <TouchableOpacity key={label} onPress={() => setDebugParts((prev) => prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label])} style={[styles.filterChip, isActive && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
                <Text style={[styles.filterChipSub, isActive && styles.filterChipSubActive]}>{lastLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {expandedSection === 'Legs' && (
        <View style={styles.filterExpandedRow}>
          {['Quads', 'Hamstrings', 'Glutes', 'Calves'].map((label) => {
            const isActive = debugParts.includes(label);
            const lastLabel = getLastLabel(lastTrainedMap[label]);
            return (
              <TouchableOpacity key={label} onPress={() => setDebugParts((prev) => prev.includes(label) ? prev.filter((p) => p !== label) : [...prev, label])} style={[styles.filterChip, isActive && styles.filterChipActive]}>
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
                <Text style={[styles.filterChipSub, isActive && styles.filterChipSubActive]}>{lastLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  filterContainer: {
    gap: sw(4),
    marginBottom: sw(2),
    paddingHorizontal: sw(8),
  },
  filterMainRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: sw(4),
  },
  filterExpandedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(4),
  },
  filterChip: {
    paddingHorizontal: sw(8),
    paddingVertical: sw(4),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.accent,
  },
  filterChipText: {
    color: colors.textPrimary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.semiBold,
  },
  filterChipTextActive: {
    color: colors.textOnAccent,
  },
  filterChipSub: {
    color: colors.textTertiary,
    fontSize: ms(7),
    lineHeight: ms(10),
    fontFamily: Fonts.medium,
  },
  filterChipSubActive: {
    color: colors.textOnAccent + 'BB',
  },
});
