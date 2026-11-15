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
/** Arms and Legs expand into these parts (selecting the section selects all of them). */
const SECTIONS: Record<'Arms' | 'Legs', string[]> = {
  Arms: ['Shoulders', 'Biceps', 'Triceps'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves'],
};
const MAIN_PARTS = ['Chest', 'Back', 'Core'];

function FilterChip({ label, sub, active, onPress, styles }: {
  label: string;
  sub: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      <Text style={[styles.filterChipSub, active && styles.filterChipSubActive]}>{sub}</Text>
    </TouchableOpacity>
  );
}

/** The most recent of some parts' last-trained dates. */
function latestOf(parts: string[], lastTrainedMap: Record<string, Date | null>): Date | null {
  return parts.reduce<Date | null>((best, k) => {
    const d = lastTrainedMap[k];
    return d && (!best || d > best) ? d : best;
  }, null);
}

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

  const togglePart = (part: string) =>
    setDebugParts((prev) => (prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]));

  const toggleSection = (section: 'Arms' | 'Legs') => {
    // Clears the section's own name as well as its parts (as the old per-section code did)
    const members = [section, ...SECTIONS[section]];
    if (expandedSection === section) {
      setExpandedSection(null);
      setDebugParts((prev) => prev.filter((p) => !members.includes(p)));
    } else {
      setExpandedSection(section);
      setDebugParts((prev) => [...prev.filter((p) => !members.includes(p)), ...SECTIONS[section]]);
    }
  };

  const sectionActive = (section: 'Arms' | 'Legs') =>
    debugParts.some((p) => p === section || SECTIONS[section].includes(p));

  const expanded = expandedSection === 'Arms' || expandedSection === 'Legs' ? SECTIONS[expandedSection] : null;

  return (
    <View style={styles.filterContainer}>
      {/* Main row: Whole, Chest, Back, Core + section toggles */}
      <View style={styles.filterMainRow}>
        <FilterChip
          label="Whole"
          sub={getLastLabel(latestWorkoutDate ? new Date(latestWorkoutDate) : null)}
          active={debugParts.length === 0}
          onPress={() => { setDebugParts([]); setExpandedSection(null); }}
          styles={styles}
        />
        {MAIN_PARTS.map((part) => (
          <FilterChip
            key={part}
            label={part}
            sub={getLastLabel(lastTrainedMap[part])}
            active={debugParts.includes(part)}
            onPress={() => { setExpandedSection(null); togglePart(part); }}
            styles={styles}
          />
        ))}
        {(['Arms', 'Legs'] as const).map((section) => (
          <FilterChip
            key={section}
            label={section}
            sub={getLastLabel(latestOf(SECTIONS[section], lastTrainedMap))}
            active={sectionActive(section)}
            onPress={() => toggleSection(section)}
            styles={styles}
          />
        ))}
      </View>
      {/* Expanded sub-parts */}
      {expanded && (
        <View style={styles.filterExpandedRow}>
          {expanded.map((label) => (
            <FilterChip
              key={label}
              label={label}
              sub={getLastLabel(lastTrainedMap[label])}
              active={debugParts.includes(label)}
              onPress={() => togglePart(label)}
              styles={styles}
            />
          ))}
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
