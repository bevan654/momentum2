import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms, SCREEN_HEIGHT } from '../../../theme/responsive';
import type { WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import {
  groupsForParts, workoutHitsGroups,
  TIME_FILTERS, TIME_LABELS, TIME_MS, BODY_FILTERS, PLAN_FILTERS, SHEET_HEIGHT,
  type TimeFilter, type PlanFilter,
} from './historyConstants';
import { useSwipeDismissSheet } from './useSwipeDismissSheet';

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${vol}`;
}

/* ─── History row with glass glow ────────────────────── */

const HistoryRow = React.memo(({ workout, dateStr, durationMin, styles, colors, onPress }: {
  workout: WorkoutWithDetails;
  dateStr: string;
  durationMin: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: (workout: WorkoutWithDetails) => void;
}) => {
  const title = workout.programName || dateStr;

  return (
    <TouchableOpacity
      style={styles.historyRowCard}
      activeOpacity={0.6}
      onPress={() => onPress(workout)}
    >
      <View style={styles.historyRowLeft}>
        <Text style={styles.historyRowTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyMeta}>{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}</Text>
          <View style={styles.historyDot} />
          <Text style={styles.historyMeta}>{durationMin} min</Text>
        </View>
      </View>
      <Text style={styles.historyVolume}>{formatVolume(workout.totalVolume)}</Text>
      <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const LIST_WRAP = { flex: 1 } as const;
const historyKey = (w: WorkoutWithDetails) => w.id;

const HistoryOverlay = React.memo(function HistoryOverlay({
  workouts,
  catalogMap,
  debugPart,
  onClose,
  onSelectWorkout,
}: {
  workouts: WorkoutWithDetails[];
  catalogMap: Record<string, any>;
  debugPart: string[];
  onClose: () => void;
  onSelectWorkout: (w: WorkoutWithDetails) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { dismiss, panGesture, sheetStyle, backdropStyle } = useSwipeDismissSheet(SHEET_HEIGHT, onClose);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('All');
  const [bodyFilter, setBodyFilter] = useState<string>(debugPart.length > 0 ? debugPart[0] : 'All');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('All');

  const filtered = useMemo(() => {
    const now = Date.now();
    return workouts.filter((w) => {
      // Time filter
      if (timeFilter !== 'All') {
        const age = now - new Date(w.created_at).getTime();
        if (age > TIME_MS[timeFilter]) return false;
      }
      // Plan filter
      if (planFilter === 'Program' && !w.programName) return false;
      if (planFilter === 'Quick' && w.programName) return false;
      // Body part filter
      const activeParts = bodyFilter !== 'All' ? [bodyFilter] : debugPart;
      if (activeParts.length > 0) {
        const targetGroups = groupsForParts(activeParts);
        if (targetGroups.size > 0 && !workoutHitsGroups(w, targetGroups, catalogMap)) return false;
      }
      return true;
    });
  }, [workouts, timeFilter, bodyFilter, planFilter, debugPart, catalogMap]);

  const activeFilterCount = (timeFilter !== 'All' ? 1 : 0) + (bodyFilter !== 'All' ? 1 : 0) + (planFilter !== 'All' ? 1 : 0);
  const [openFilter, setOpenFilter] = useState<'time' | 'muscle' | 'type' | null>(null);

  const toggleFilter = useCallback((key: 'time' | 'muscle' | 'type') => {
    setOpenFilter((prev) => (prev === key ? null : key));
  }, []);

  const renderHistoryRow = useCallback(({ item: w }: { item: WorkoutWithDetails }) => {
    const d = new Date(w.created_at);
    const dateStr = `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const durationMin = Math.round(w.duration / 60);
    return (
      <HistoryRow
        workout={w}
        dateStr={dateStr}
        durationMin={durationMin}
        styles={styles}
        colors={colors}
        onPress={onSelectWorkout}
      />
    );
  }, [styles, colors, onSelectWorkout]);

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <View style={styles.historyBackdropWrap}>
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[styles.historyBackdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.historySheet, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.historyHandle}>
            <View style={styles.historyHandleBar} />
          </Animated.View>
        </GestureDetector>

      <View style={styles.historyHeader}>
        <View style={{ gap: sw(2) }}>
          <Text style={styles.historyTitle}>{debugPart.length > 0 ? `${debugPart.join(', ')} History` : 'Workout History'}</Text>
          <Text style={styles.historySubtitle}>{filtered.length} workout{filtered.length !== 1 ? 's' : ''}</Text>
        </View>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={() => { setTimeFilter('All'); setBodyFilter('All'); setPlanFilter('All'); setOpenFilter(null); }} activeOpacity={0.7}>
            <Text style={styles.filterClearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter categories */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
          <TouchableOpacity
            style={[styles.fCategory, openFilter === 'time' && styles.fCategoryOpen, timeFilter !== 'All' && styles.fCategoryActive]}
            onPress={() => toggleFilter('time')}
            activeOpacity={0.7}
          >
            <Text style={[styles.fCategoryText, (openFilter === 'time' || timeFilter !== 'All') && styles.fCategoryTextActive]}>
              {timeFilter !== 'All' ? TIME_LABELS[timeFilter] : 'Time'}
            </Text>
            <Ionicons name={openFilter === 'time' ? 'chevron-up' : 'chevron-down'} size={ms(10)} color={timeFilter !== 'All' || openFilter === 'time' ? colors.accent : colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fCategory, openFilter === 'muscle' && styles.fCategoryOpen, bodyFilter !== 'All' && styles.fCategoryActive]}
            onPress={() => toggleFilter('muscle')}
            activeOpacity={0.7}
          >
            <Text style={[styles.fCategoryText, (openFilter === 'muscle' || bodyFilter !== 'All') && styles.fCategoryTextActive]}>
              {bodyFilter !== 'All' ? bodyFilter : 'Muscle'}
            </Text>
            <Ionicons name={openFilter === 'muscle' ? 'chevron-up' : 'chevron-down'} size={ms(10)} color={bodyFilter !== 'All' || openFilter === 'muscle' ? colors.accent : colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fCategory, openFilter === 'type' && styles.fCategoryOpen, planFilter !== 'All' && styles.fCategoryActive]}
            onPress={() => toggleFilter('type')}
            activeOpacity={0.7}
          >
            <Text style={[styles.fCategoryText, (openFilter === 'type' || planFilter !== 'All') && styles.fCategoryTextActive]}>
              {planFilter !== 'All' ? planFilter : 'Type'}
            </Text>
            <Ionicons name={openFilter === 'type' ? 'chevron-up' : 'chevron-down'} size={ms(10)} color={planFilter !== 'All' || openFilter === 'type' ? colors.accent : colors.textTertiary} />
          </TouchableOpacity>
        </ScrollView>

        {/* Expanded options */}
        {openFilter === 'time' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            {TIME_FILTERS.map((t) => (
              <TouchableOpacity key={t} style={[styles.fChip, timeFilter === t && styles.fChipActive]} onPress={() => { setTimeFilter(t); setOpenFilter(null); }} activeOpacity={0.7}>
                <Text style={[styles.fChipText, timeFilter === t && styles.fChipTextActive]}>{TIME_LABELS[t]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {openFilter === 'muscle' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            {BODY_FILTERS.map((b) => (
              <TouchableOpacity key={b} style={[styles.fChip, bodyFilter === b && styles.fChipActive]} onPress={() => { setBodyFilter(b); setOpenFilter(null); }} activeOpacity={0.7}>
                <Text style={[styles.fChipText, bodyFilter === b && styles.fChipTextActive]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {openFilter === 'type' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
            {PLAN_FILTERS.map((p) => (
              <TouchableOpacity key={p} style={[styles.fChip, planFilter === p && styles.fChipActive]} onPress={() => { setPlanFilter(p); setOpenFilter(null); }} activeOpacity={0.7}>
                <Text style={[styles.fChipText, planFilter === p && styles.fChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Virtualised: someone with hundreds of workouts would otherwise mount every row on open */}
      <View style={LIST_WRAP}>
        <FlashList
          data={filtered}
          keyExtractor={historyKey}
          renderItem={renderHistoryRow}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyList}
          ListEmptyComponent={<Text style={styles.historyEmpty}>No workouts found</Text>}
        />
      </View>
      </Animated.View>
    </View>
    </GestureHandlerRootView>
  );
});

export default HistoryOverlay;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  historyBackdropWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'flex-end',
  },
  historyBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  historySheet: {
    height: SCREEN_HEIGHT * 0.92,
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    overflow: 'hidden',
  },
  historyHandle: {
    alignItems: 'center',
    paddingVertical: sw(10),
  },
  historyHandleBar: {
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.textTertiary + '40',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(20),
    paddingBottom: sw(12),
  },
  historyTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  historySubtitle: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  filterClearText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  filterSection: {
    paddingBottom: sw(8),
    gap: sw(6),
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: sw(6),
    paddingHorizontal: sw(20),
    justifyContent: 'center',
    flexGrow: 1,
  },
  fCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  fCategoryOpen: {
    backgroundColor: colors.surface,
  },
  fCategoryActive: {
    backgroundColor: colors.accent + '15',
  },
  fCategoryText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  fCategoryTextActive: {
    color: colors.accent,
  },
  fChip: {
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  fChipActive: {
    backgroundColor: colors.accent + '20',
  },
  fChipText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  fChipTextActive: {
    color: colors.accent,
  },
  historyList: {
    paddingHorizontal: sw(20),
  },
  historyEmpty: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: sw(40),
  },
  historyRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  historyRowLeft: {
    flex: 1,
    gap: sw(3),
  },
  historyRowTitle: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(19),
    fontFamily: Fonts.semiBold,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  historyMeta: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  historyDot: {
    width: sw(2.5),
    height: sw(2.5),
    borderRadius: sw(1.5),
    backgroundColor: colors.textTertiary,
    opacity: 0.4,
  },
  historyVolume: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
});
