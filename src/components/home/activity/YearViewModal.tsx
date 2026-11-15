import React, { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost } from '../../ui/Portal';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import type { WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import WorkoutSummaryModal from '../../workout-sheet/WorkoutSummaryModal';
import { DAY_LABELS, MONTH_NAMES, type MonthData, buildMonthCells } from './activityCalendarUtils';

/* ─── Year View Modal ────────────────────────────────── */

const YearMonthBlock = React.memo(function YearMonthBlock({
  month,
  workoutMap,
  todayKey,
  onDayPress,
  isCurrent,
}: {
  month: MonthData;
  workoutMap: Map<string, WorkoutWithDetails>;
  todayKey: string;
  onDayPress: (key: string) => void;
  isCurrent: boolean;
}) {
  const colors = useColors();
  const ys = useMemo(() => yearStyles(colors), [colors]);

  const workoutCount = useMemo(() => {
    let count = 0;
    for (const cell of month.cells) {
      if (cell && workoutMap.has(cell.key)) count++;
    }
    return count;
  }, [month.cells, workoutMap]);

  return (
    <View style={ys.monthBlock}>
      <View style={ys.monthHeader}>
        <Text style={[ys.monthTitle, isCurrent && ys.currentMonthTitle]}>{month.name}</Text>
        {workoutCount > 0 && (
          <Text style={ys.monthCount}>{workoutCount} session{workoutCount !== 1 ? 's' : ''}</Text>
        )}
      </View>
      <View style={ys.weekRow}>
        {DAY_LABELS.map((l, li) => (
          <View key={li} style={ys.weekCell}>
            <Text style={ys.weekLabel}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={ys.grid}>
        {month.cells.map((cell, ci) => {
          if (!cell) return <View key={`e-${ci}`} style={ys.dayCell} />;
          const { day, key } = cell;
          const workout = workoutMap.get(key);
          const isToday = key === todayKey;
          const isFuture = key > todayKey;
          return (
            <TouchableOpacity
              key={key}
              style={ys.dayCell}
              onPress={() => onDayPress(key)}
              activeOpacity={workout ? 0.6 : 1}
              disabled={!workout}
            >
              <View style={[
                ys.dayCellInner,
                workout && ys.workoutCellInner,
                isToday && ys.todayCellInner,
                isFuture && ys.futureCellInner,
              ]}>
                <Text style={[
                  ys.dayText,
                  workout && ys.workoutDayText,
                  isToday && ys.todayText,
                  isFuture && ys.futureText,
                ]}>{day}</Text>
                {workout && <View style={ys.workoutDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export function YearViewModal({
  visible,
  onClose,
  workoutMap,
  todayKey,
}: {
  visible: boolean;
  onClose: () => void;
  workoutMap: Map<string, WorkoutWithDetails>;
  todayKey: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const ys = useMemo(() => yearStyles(colors), [colors]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [ready, setReady] = useState(false);
  const listRef = useRef<FlatList>(null);

  const today = new Date();
  const year = today.getFullYear();
  const currentMonthIndex = today.getMonth();

  const months = useMemo(() => {
    const result: MonthData[] = [];
    for (let m = 0; m <= 11; m++) {
      const { cells, rows } = buildMonthCells(year, m);
      result.push({ name: MONTH_NAMES[m], cells, rows });
    }
    return result;
  }, [year]);

  const handleShow = useCallback(() => {
    if (!ready) requestAnimationFrame(() => setReady(true));
  }, [ready]);

  const handleDayPress = useCallback((key: string) => {
    const w = workoutMap.get(key);
    if (w) setSelectedWorkout(w);
  }, [workoutMap]);

  const renderMonth = useCallback(({ item, index }: { item: MonthData; index: number }) => (
    <YearMonthBlock
      month={item}
      workoutMap={workoutMap}
      todayKey={todayKey}
      onDayPress={handleDayPress}
      isCurrent={index === currentMonthIndex}
    />
  ), [workoutMap, todayKey, handleDayPress, currentMonthIndex]);

  const keyExtractor = useCallback((_: any, i: number) => String(i), []);

  const totalWorkouts = useMemo(() => {
    let count = 0;
    for (const [key] of workoutMap) {
      if (key.startsWith(String(year))) count++;
    }
    return count;
  }, [workoutMap, year]);

  return (
    <Modal visible={visible} animationType="slide" onShow={handleShow} statusBarTranslucent>
      <GestureHandlerRootView style={ys.hostRoot}>
      <PortalHost>
      <View style={[ys.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={ys.header}>
          <View>
            <Text style={ys.headerTitle}>{year}</Text>
            <Text style={ys.headerSubtitle}>{totalWorkouts} workout{totalWorkouts !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={ys.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={ms(18)} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={listRef}
          data={ready ? months : []}
          renderItem={renderMonth}
          keyExtractor={keyExtractor}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={ys.scrollContent}
        />

        {selectedWorkout && (
          <WorkoutSummaryModal
            mode="historical"
            data={selectedWorkout}
            onDismiss={() => setSelectedWorkout(null)}
          />
        )}
      </View>
      </PortalHost>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ─── Year View Styles ───────────────────────────────── */

const yearStyles = (colors: ThemeColors) => StyleSheet.create({
  hostRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(20),
    paddingTop: sw(8),
    paddingBottom: sw(12),
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: ms(28),
    lineHeight: ms(34),
    fontFamily: Fonts.bold,
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  closeButton: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(16),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(40),
  },
  monthBlock: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(12),
    marginBottom: sw(10),
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: sw(8),
  },
  monthTitle: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  currentMonthTitle: {
    color: colors.textPrimary,
  },
  monthCount: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: sw(4),
  },
  weekCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    padding: 1,
  },
  dayCellInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sw(6),
    paddingVertical: sw(4),
  },
  workoutCellInner: {
    backgroundColor: colors.accent + '18',
  },
  todayCellInner: {
    borderWidth: 1,
    borderColor: colors.accent + '50',
  },
  futureCellInner: {
    opacity: 0.2,
  },
  dayText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  workoutDayText: {
    color: colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  todayText: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  futureText: {
    color: colors.textTertiary + '60',
  },
  workoutDot: {
    width: sw(4),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.accent,
    marginTop: sw(2),
  },
});
