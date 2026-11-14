import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../../theme/responsive';
import type { WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import { toSlug } from '../../../utils/muscleVolume';
import { toLocalDateString } from '../../../utils/localDate';
import { toDateKey, SLUG_GROUP, PART_GROUPS } from './historyConstants';

/** Last 56 days as a 4 × 14 dot grid. Tap a trained day to open that workout, a rest day to see its date. */
function TrainingCalendar({ workouts, catalogMap, debugParts, onSelectWorkout }: {
  workouts: WorkoutWithDetails[];
  catalogMap: Record<string, any>;
  debugParts: string[];
  onSelectWorkout: (w: WorkoutWithDetails) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const todayStr = useMemo(() => toLocalDateString(), []);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // ── Training Calendar (4 rows × 14 days = last 56 days) ──
  const COLS_PER_ROW = 14;
  const NUM_ROWS = 4;
  const TOTAL_DAYS = COLS_PER_ROW * NUM_ROWS;

  const calendarGrid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (TOTAL_DAYS - 1));
    const startKey = toDateKey(start.toISOString());

    const rows: string[][] = [];
    const d = new Date(start);
    for (let r = 0; r < NUM_ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS_PER_ROW; c++) {
        row.push(toDateKey(d.toISOString()));
        d.setDate(d.getDate() + 1);
      }
      rows.push(row);
    }

    const padding = sw(32) * 2;
    const available = SCREEN_WIDTH - padding;
    const gap = sw(2);
    const dotSize = Math.floor((available - gap * (COLS_PER_ROW - 1)) / COLS_PER_ROW);
    return { rows, dotSize, gap, startKey };
  }, []);

  const trainedDaysMap = useMemo(() => {
    const days = new Map<string, WorkoutWithDetails>();
    const allTargetGroups = new Set<string>();
    for (const part of debugParts) {
      const groups = PART_GROUPS[part];
      if (groups) for (const g of groups) allTargetGroups.add(g);
    }

    for (const w of workouts) {
      const dateKey = toDateKey(w.created_at);

      if (allTargetGroups.size === 0) {
        if (!days.has(dateKey)) days.set(dateKey, w);
        continue;
      }

      let matched = false;
      for (const ex of w.exercises) {
        let primary = ex.primary_muscles || [];
        if (primary.length === 0) {
          const cat = catalogMap[ex.name];
          if (cat) { primary = cat.primary_muscles || []; }
        }
        for (const raw of primary) {
          const slug = toSlug(raw);
          if (slug) {
            const group = SLUG_GROUP[slug];
            if (group && allTargetGroups.has(group)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
      if (matched && !days.has(dateKey)) days.set(dateKey, w);
    }

    return days;
  }, [workouts, catalogMap, debugParts]);

  return (
    <>
      {/* ── Training Calendar (last 56 days) ── */}
      <View style={styles.calendarHeadingRow}>
        <Text style={styles.calendarHeading}>
          {selectedCalDate
            ? (() => {
                const [y, m, d] = selectedCalDate.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                return `${days[date.getDay()]}, ${months[date.getMonth()]} ${d}${trainedDaysMap.has(selectedCalDate) ? ' — trained' : ' — rest day'}`;
              })()
            : `${debugParts.length > 0 ? `${debugParts.join(', ')} training` : 'All training'} — 8 weeks`}
        </Text>
      </View>
      <View style={styles.calendarSection}>
        <View style={[styles.calendarHeatmap, { gap: calendarGrid.gap }]}>
          {calendarGrid.rows.map((row, ri) => (
            <View key={ri} style={[styles.calendarRow, { gap: calendarGrid.gap }]}>
              {row.map((dateStr, ci) => (
                <TouchableOpacity
                  key={ci}
                  activeOpacity={0.7}
                  onPress={() => {
                    const w = trainedDaysMap.get(dateStr);
                    if (w) {
                      onSelectWorkout(w);
                    } else {
                      setSelectedCalDate(selectedCalDate === dateStr ? null : dateStr);
                    }
                  }}
                  style={[
                    styles.calDot,
                    { width: calendarGrid.dotSize, height: calendarGrid.dotSize },
                    trainedDaysMap.has(dateStr) && styles.calDotTrained,
                    dateStr === todayStr && selectedCalDate !== dateStr && styles.calDotToday,
                    selectedCalDate === dateStr && styles.calDotSelected,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

export default React.memo(TrainingCalendar);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  calendarHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sw(6),
    gap: sw(8),
  },
  calendarHeading: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  calendarSection: {
    alignItems: 'center',
    marginBottom: sw(6),
  },
  calendarHeatmap: {
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  calDot: {
    borderRadius: sw(2),
    backgroundColor: colors.surface,
  },
  calDotTrained: {
    backgroundColor: colors.accent,
  },
  calDotToday: {
    backgroundColor: colors.cardBorder,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
  },
  calDotSelected: {
    backgroundColor: '#3B82F6',
  },
});
