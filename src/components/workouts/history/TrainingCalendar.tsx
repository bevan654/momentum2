import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../../theme/responsive';
import type { WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import { toLocalDateString } from '../../../utils/localDate';
import { formatWeekdayMonthDay } from '../../../utils/dateLabels';
import { toDateKey, groupsForParts, workoutHitsGroups } from './historyConstants';

/** Last 56 days as a 4 × 14 dot grid. Tap a trained day to open that workout, a rest day to see its date. */
function TrainingCalendar({ workouts, catalogMap, bodyParts, onSelectWorkout }: {
  workouts: WorkoutWithDetails[];
  catalogMap: Record<string, any>;
  bodyParts: string[];
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
    const allTargetGroups = groupsForParts(bodyParts);

    for (const w of workouts) {
      const dateKey = toDateKey(w.created_at);

      if (allTargetGroups.size === 0) {
        if (!days.has(dateKey)) days.set(dateKey, w);
        continue;
      }

      if (workoutHitsGroups(w, allTargetGroups, catalogMap) && !days.has(dateKey)) days.set(dateKey, w);
    }

    return days;
  }, [workouts, catalogMap, bodyParts]);

  return (
    <>
      {/* ── Training Calendar (last 56 days) ── */}
      <View style={styles.calendarHeadingRow}>
        <Text style={styles.calendarHeading}>
          {selectedCalDate
            ? (() => {
                const [y, m, d] = selectedCalDate.split('-').map(Number);
                const date = new Date(y, m - 1, d);
                return `${formatWeekdayMonthDay(date)}${trainedDaysMap.has(selectedCalDate) ? ' — trained' : ' — rest day'}`;
              })()
            : `${bodyParts.length > 0 ? `${bodyParts.join(', ')} training` : 'All training'} — 8 weeks`}
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
    backgroundColor: colors.accentBlue,
  },
});
