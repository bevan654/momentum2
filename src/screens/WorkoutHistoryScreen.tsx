import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import DateNavigator from '../components/food/DateNavigator';
import type { WorkoutWithDetails, ExerciseWithSets } from '../stores/useWorkoutStore';
import MiniBodyMap from '../components/body/MiniBodyMap';
import RankBadge from '../components/workouts/RankBadge';
import { computeWorkoutRank } from '../utils/strengthScore';
import WorkoutSummaryModal from '../components/workout-sheet/WorkoutSummaryModal';
import ActivityChart from '../components/workouts/ActivityChart';

type WorkoutsStackParamList = {
  WorkoutHistory: undefined;
  StartWorkout: undefined;
  CreateRoutine: undefined;
};

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${vol}`;
}

/* ─── Main screen ────────────────────────────────────── */

function WorkoutHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id);
  const workouts = useWorkoutStore((s) => s.workouts);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const loading = useWorkoutStore((s) => s.loading);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const bodyweight = useWeightStore((s) => s.current) ?? 70;
  const selectedDate = useFoodLogStore((s) => s.selectedDate);
  const setDate = useFoodLogStore((s) => s.setDate);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchExerciseCatalog(userId).then(() => fetchWorkoutHistory(userId));
      }
    }, [userId])
  );

  const dayWorkouts = useMemo(() => {
    return workouts.filter((w) => toDateKey(w.created_at) === selectedDate);
  }, [workouts, selectedDate]);

  const dayStats = useMemo(() => {
    if (dayWorkouts.length === 0) return null;

    let duration = 0;
    let sets = 0;
    let reps = 0;
    let volume = 0;
    let prs = 0;
    const allExercises: ExerciseWithSets[] = [];
    const muscleSet = new Set<string>();

    for (const w of dayWorkouts) {
      duration += w.duration;
      sets += w.completedSets;
      reps += w.totalReps;
      volume += w.totalVolume;
      prs += w.prCount;
      for (const ex of w.exercises) {
        allExercises.push(ex);
        for (const m of ex.primary_muscles) muscleSet.add(m);
      }
    }

    return { duration, sets, reps, volume, prs, allExercises, muscleGroups: Array.from(muscleSet) };
  }, [dayWorkouts]);

  const dayRank = useMemo(() => {
    if (!dayStats || dayStats.allExercises.length === 0) return null;
    return computeWorkoutRank({
      exercises: dayStats.allExercises.map((ex) => ({
        name: ex.name,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed })),
      })),
      bodyweight,
      catalog: catalogMap,
    });
  }, [dayStats, bodyweight, catalogMap]);

  const analysis = useMemo(() => {
    if (!dayStats) return null;
    const durationMin = dayStats.duration / 60;
    const caloriesBurnt = Math.round(durationMin * (bodyweight * 5) / 60);
    return { caloriesBurnt };
  }, [dayStats, bodyweight]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isToday = selectedDate === todayStr;
  const isFuture = selectedDate > todayStr;

  const dateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (isToday) return 'Today';
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }, [selectedDate, isToday]);

  if (loading && workouts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const hasWorkout = !!dayStats;
  const activeMin = dayStats ? Math.round(dayStats.duration / 60) : 0;
  const caloriesBurnt = analysis?.caloriesBurnt ?? 0;

  return (
    <View style={styles.container}>
      <DateNavigator selectedDate={selectedDate} onDateSelect={setDate} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Row: History ────────────── */}
        <View style={styles.topRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <TouchableOpacity
            style={styles.historyPill}
            onPress={() => setShowHistory(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={ms(13)} color={colors.textSecondary} />
            <Text style={styles.historyPillText}>History</Text>
            <Ionicons name="chevron-forward" size={ms(11)} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── Hero Card ──────────────────────────── */}
        <View style={[styles.heroCard, colors.cardShadow]}>
          <View style={styles.heroInner}>
            <View style={styles.heroLeft}>
              {hasWorkout ? (
                <>
                  <Text style={styles.sectionLabel}>TOTAL VOLUME</Text>
                  <View style={styles.heroVolumeRow}>
                    <Text style={styles.heroVolume}>{formatVolume(dayStats.volume)}</Text>
                    <Text style={styles.heroKgUnit}>kg</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.detailsPill}
                    onPress={() => setSelectedWorkout(dayWorkouts[0])}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="list-outline" size={ms(13)} color={colors.accent} />
                    <Text style={styles.detailsPillText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={ms(11)} color={colors.accent + '80'} />
                  </TouchableOpacity>

                  <View style={styles.badgeRow}>
                    {dayStats.prs > 0 && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prEmoji}>{'\u{1F3C6}'}</Text>
                        <Text style={styles.prText}>{dayStats.prs} PR{dayStats.prs > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                    {dayRank && <RankBadge rank={dayRank.rank} />}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>
                    {isFuture ? 'UPCOMING' : isToday ? 'TODAY' : 'REST DAY'}
                  </Text>
                  <Text style={styles.emptyHeroSubtitle}>
                    {isFuture
                      ? 'No workout scheduled'
                      : isToday
                        ? 'Ready to train?'
                        : 'Recovery is part of the process'}
                  </Text>
                  {(isToday || isFuture) && (
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => navigation.navigate('StartWorkout')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="barbell-outline" size={ms(14)} color={colors.textOnAccent} />
                      <Text style={styles.startButtonText}>Start Workout</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>

            <View style={styles.bodyMapRow}>
              <MiniBodyMap exercises={hasWorkout ? dayStats.allExercises : []} scale={0.22} side="front" />
              <MiniBodyMap exercises={hasWorkout ? dayStats.allExercises : []} scale={0.22} side="back" />
            </View>
          </View>
        </View>

        {/* ── Calories Burnt Card (locked) ────────── */}
        <View style={styles.lockedCardWrap}>
          <View style={[styles.calorieCard, colors.cardShadow]}>
            <View style={styles.calorieHeader}>
              <View style={styles.calorieHeaderLeft}>
                <Ionicons name="flame" size={ms(18)} color={colors.accentRed} />
                <Text style={styles.calorieTotalNumber}>{caloriesBurnt || 247}</Text>
                <Text style={styles.calorieTotalUnit}>kcal</Text>
              </View>
              <Text style={styles.calorieCardLabel}>CALORIES BURNT</Text>
            </View>

            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIconWrap, { backgroundColor: colors.accentGreen + '15' }]}>
                  <Ionicons name="walk-outline" size={ms(14)} color={colors.accentGreen} />
                </View>
                <Text style={styles.breakdownValue}>120</Text>
                <Text style={styles.breakdownLabel}>Walking</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIconWrap, { backgroundColor: colors.accentBlue + '15' }]}>
                  <Ionicons name="speedometer-outline" size={ms(14)} color={colors.accentBlue} />
                </View>
                <Text style={styles.breakdownValue}>85</Text>
                <Text style={styles.breakdownLabel}>Running</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIconWrap, { backgroundColor: colors.accentOrange + '15' }]}>
                  <Ionicons name="barbell-outline" size={ms(14)} color={colors.accentOrange} />
                </View>
                <Text style={styles.breakdownValue}>{(caloriesBurnt || 247) - 205}</Text>
                <Text style={styles.breakdownLabel}>Gym</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIconWrap, { backgroundColor: colors.accentPink + '15' }]}>
                  <Ionicons name="body-outline" size={ms(14)} color={colors.accentPink} />
                </View>
                <Text style={styles.breakdownValue}>42</Text>
                <Text style={styles.breakdownLabel}>Other</Text>
              </View>
            </View>
          </View>
          <View style={styles.blurOverlay} />
          <TouchableOpacity
            style={styles.connectButton}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'Smartwatch integration is on the way.')}
          >
            <Ionicons name="watch-outline" size={ms(14)} color={colors.textOnAccent} />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>

        {/* ── Steps & Calories Chart (locked) ────── */}
        <View style={styles.lockedCardWrap}>
          <ActivityChart activeMinutes={activeMin} />
          <View style={styles.blurOverlay} />
          <TouchableOpacity
            style={styles.connectButton}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'Smartwatch integration is on the way.')}
          >
            <Ionicons name="watch-outline" size={ms(14)} color={colors.textOnAccent} />
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── History Modal ──────────────────────── */}
      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.historyModal}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Workout History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={ms(22)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
            {workouts.length === 0 ? (
              <Text style={styles.historyEmpty}>No workouts yet</Text>
            ) : (
              workouts.map((w) => {
                const d = new Date(w.created_at);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const dateStr = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
                const durationMin = Math.round(w.duration / 60);
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.historyRow}
                    activeOpacity={0.6}
                    onPress={() => {
                      setShowHistory(false);
                      setTimeout(() => setSelectedWorkout(w), 300);
                    }}
                  >
                    <View style={styles.historyRowLeft}>
                      <Text style={styles.historyDate}>{dateStr}</Text>
                      <Text style={styles.historyMeta}>
                        {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                        {'  ·  '}{durationMin} min
                      </Text>
                    </View>
                    <View style={styles.historyRowRight}>
                      <Text style={styles.historyVolume}>{formatVolume(w.totalVolume)}</Text>
                      <Text style={styles.historyVolUnit}>kg</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {selectedWorkout && (
        <WorkoutSummaryModal
          mode="historical"
          data={selectedWorkout}
          onDismiss={() => setSelectedWorkout(null)}
          onDelete={async () => {
            const id = selectedWorkout.id;
            setSelectedWorkout(null);
            await deleteWorkout(id);
          }}
        />
      )}
    </View>
  );
}

export default React.memo(WorkoutHistoryScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingTop: sw(4),
    paddingBottom: sw(12),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Section Label (reused) ─────────────────────────── */
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: sw(4),
  },

  /* ── Top Row: Date + History ─────────────────────────── */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(6),
  },
  dateLabel: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.bold,
  },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  historyPillText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },

  /* ── Hero Card ──────────────────────────────────────── */
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: sw(18),
    padding: sw(14),
    marginBottom: sw(8),
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    paddingRight: sw(4),
  },
  bodyMapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sw(2),
  },
  heroVolumeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(4),
    marginTop: sw(2),
  },
  heroVolume: {
    color: colors.textPrimary,
    fontSize: ms(28),
    lineHeight: ms(33),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  heroKgUnit: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  badgeRow: {
    marginTop: sw(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange + '20',
    paddingHorizontal: sw(11),
    paddingVertical: sw(4),
    borderRadius: sw(99),
    gap: sw(4),
  },
  prEmoji: {
    fontSize: ms(11),
    lineHeight: ms(15),
  },
  prText: {
    color: colors.accentOrange,
    fontSize: ms(11),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(15),
  },

  /* ── Calories Burnt Card ──────────────────────────────── */
  calorieCard: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(12),
  },
  calorieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(10),
  },
  calorieHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  calorieTotalNumber: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  calorieTotalUnit: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  calorieCardLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownItem: {
    alignItems: 'center',
    gap: sw(3),
    flex: 1,
  },
  breakdownIconWrap: {
    width: sw(30),
    height: sw(30),
    borderRadius: sw(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownValue: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  breakdownLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.medium,
  },

  /* ── Locked / Coming Soon Overlay ─────────────────────── */
  lockedCardWrap: {
    position: 'relative',
    marginBottom: sw(8),
    overflow: 'hidden',
    borderRadius: sw(16),
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.card + 'CC',
    borderRadius: sw(16),
  },
  connectButton: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: sw(-16),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: sw(18),
    paddingVertical: sw(8),
    borderRadius: sw(99),
    gap: sw(6),
  },
  connectButtonText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },

  /* ── View Details Pill ────────────────────────────────── */
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    borderRadius: sw(99),
    gap: sw(4),
    marginTop: sw(8),
    marginBottom: sw(6),
  },
  detailsPillText: {
    color: colors.accent,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
  },

  /* ── Empty Hero State ─────────────────────────────────── */
  emptyHeroSubtitle: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: sw(18),
    paddingVertical: sw(8),
    borderRadius: sw(99),
    gap: sw(6),
    marginTop: sw(12),
  },
  startButtonText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },

  /* ── History Modal ──────────────────────────────────── */
  historyModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(20),
    paddingTop: sw(20),
    paddingBottom: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  historyTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  historyList: {
    padding: sw(16),
    gap: sw(2),
  },
  historyEmpty: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginTop: sw(40),
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    marginBottom: sw(8),
  },
  historyRowLeft: {
    flex: 1,
    gap: sw(2),
  },
  historyDate: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  historyMeta: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  historyRowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(3),
    marginRight: sw(8),
  },
  historyVolume: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  historyVolUnit: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
});
