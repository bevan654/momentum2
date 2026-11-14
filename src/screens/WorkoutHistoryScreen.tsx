import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import Overlay from '../components/ui/Overlay';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import type { WorkoutWithDetails } from '../stores/useWorkoutStore';
import RecoveryBodyMap from '../components/workouts/RecoveryBodyMap';
import { useMuscleAnalysisStore } from '../stores/useMuscleAnalysisStore';
import { useOwnBodyweightKg } from '../hooks/useMuscleLoad';
import { useProgramStore } from '../stores/useProgramStore';
import { toSlug } from '../utils/muscleVolume';
import WorkoutSummaryModal from '../components/workout-sheet/WorkoutSummaryModal';
import TodayScheduled from '../components/workouts/TodayScheduled';
import type { Routine } from '../stores/useRoutineStore';
import { navigateWorkoutsStack } from '../lib/navigationBridge';
import { confirmReplaceWorkout } from '../utils/confirmReplaceWorkout';
import { SLUG_GROUP, PART_GROUPS } from '../components/workouts/history/historyConstants';
import HistoryOverlay from '../components/workouts/history/HistoryOverlay';
import RoutinePreviewOverlay from '../components/workouts/history/RoutinePreviewOverlay';
import RecoveryFilterChips from '../components/workouts/history/RecoveryFilterChips';
import TrainingCalendar from '../components/workouts/history/TrainingCalendar';

/* ─── Main screen ────────────────────────────────────── */

function WorkoutHistoryScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const workouts = useWorkoutStore((s) => s.workouts);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const loading = useWorkoutStore((s) => s.loading);
  const startEmptyWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const colors = useColors();
  const analysis = useMuscleAnalysisStore((s) => s.analysis);
  const recompute = useMuscleAnalysisStore((s) => s.recompute);
  const bodyweightKg = useOwnBodyweightKg();
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const getDurationWeeks = useProgramStore((s) => s.getDurationWeeks);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [previewRoutine, setPreviewRoutine] = useState<Routine | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const openHistory = useCallback(() => {
    setHistoryVisible(true);
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  const openPlans = useCallback(() => {
    navigateWorkoutsStack('Plans');
  }, []);

  useEffect(() => {
    if (userId) {
      fetchExerciseCatalog(userId).then(() => fetchWorkoutHistory(userId));
    }
  }, [userId]);

  // Recompute recovery data when workouts change
  useEffect(() => {
    // Also when the list empties (the last workout was deleted), so recovery doesn't keep showing it.
    // Skipped only before anything was computed, so first load doesn't flash an empty analysis.
    if (workouts.length > 0 || useMuscleAnalysisStore.getState().analysis) recompute(workouts, catalogMap, bodyweightKg);
  }, [workouts, catalogMap, bodyweightKg]);

  // Selected body part filter — must be before any early return
  const [debugParts, setDebugParts] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Body-graph groups picked in the filter (empty = whole body)
  const activeGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const part of debugParts) {
      for (const g of PART_GROUPS[part] ?? []) groups.add(g);
    }
    return groups;
  }, [debugParts]);

  // Overall recovery % — use min (not average) so platform matches the most fatigued visible muscle
  const overallRecovery = useMemo(() => {
    if (!analysis?.groups) return 100;
    if (debugParts.length > 0) {
      const allKeys: string[] = [];
      for (const part of debugParts) {
        const groups = PART_GROUPS[part];
        if (groups) allKeys.push(...groups);
      }
      if (allKeys.length > 0) {
        const vals = allKeys.map((k) => {
          const g = analysis.groups[k as keyof typeof analysis.groups] as { recoveryPercent?: number } | undefined;
          return g?.recoveryPercent ?? 100;
        });
        return Math.min(...vals);
      }
    }
    const groups = Object.values(analysis.groups) as { recoveryPercent?: number }[];
    if (groups.length === 0) return 100;
    return Math.min(...groups.map((g) => g.recoveryPercent ?? 100));
  }, [analysis, debugParts]);


  // Last trained date per body part (primary muscles only — secondary don't count)
  const lastTrainedMap = useMemo(() => {
    const map: Record<string, Date | null> = {};
    for (const label of Object.keys(PART_GROUPS)) map[label] = null;

    for (const w of workouts) {
      const wDate = new Date(w.created_at);
      const hitParts = new Set<string>();
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
            if (group) {
              for (const [label, groups] of Object.entries(PART_GROUPS)) {
                if (groups.includes(group)) hitParts.add(label);
              }
            }
          }
        }
      }
      for (const label of hitParts) {
        if (!map[label] || wDate > map[label]!) map[label] = wDate;
      }
    }
    return map;
  }, [workouts, catalogMap]);

  if (loading && workouts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: sw(16) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Recovery header ── */}
        <Text style={styles.recoveryTitle}>Recovery Overview — {Math.round(overallRecovery)}%</Text>
        <RecoveryFilterChips
          debugParts={debugParts}
          setDebugParts={setDebugParts}
          expandedSection={expandedSection}
          setExpandedSection={setExpandedSection}
          lastTrainedMap={lastTrainedMap}
          latestWorkoutDate={workouts[0]?.created_at}
        />
        <RecoveryBodyMap groups={activeGroups} />

        {/* ── Training Calendar (last 56 days) ── */}
        <TrainingCalendar
          workouts={workouts}
          catalogMap={catalogMap}
          debugParts={debugParts}
          onSelectWorkout={setSelectedWorkout}
        />

        {/* ── Active Program + Today's Workout ─────── */}
        <View style={styles.programSection}>
          <TodayScheduled
            onPreview={setPreviewRoutine}
            onOpenPlans={openPlans}
            programHeader={activeProgram ? (
              <TouchableOpacity style={styles.programCardRow} activeOpacity={0.7} onPress={openPlans}>
                <View style={styles.programCardLeft}>
                  <Text style={styles.programCardLabel}>ACTIVE PROGRAM</Text>
                  <View style={styles.programCardHeader}>
                    <Ionicons name="barbell-outline" size={ms(13)} color={colors.accent} />
                    <Text style={styles.programCardName} numberOfLines={1}>{activeProgram.name}</Text>
                  </View>
                </View>
                <View style={styles.programCardRight}>
                  <Text style={styles.programCardWeek}>
                    Week {getCurrentWeek()}{getDurationWeeks(activeProgram) > 0 ? `/${getDurationWeeks(activeProgram)}` : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ) : undefined}
          />
        </View>

      </ScrollView>

      {/* ── Action Bar ── */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={() => openHistory()}>
          <Ionicons name="calendar-outline" size={ms(16)} color={colors.textPrimary} />
          <Text style={styles.actionBtnLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtnAccent} activeOpacity={0.7} onPress={() => confirmReplaceWorkout(startEmptyWorkout)}>
          <Ionicons name="add" size={ms(18)} color={colors.textOnAccent} />
          <Text style={styles.actionBtnAccentLabel}>Start Empty</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={openPlans}>
          <Ionicons name="clipboard-outline" size={ms(16)} color={colors.textPrimary} />
          <Text style={styles.actionBtnLabel}>Plans</Text>
        </TouchableOpacity>
      </View>

      {/* ── History Overlay ──────────────────────── */}
      <Overlay
        visible={historyVisible}
        animationType="none"
        onRequestClose={closeHistory}
      >
        <HistoryOverlay
          workouts={workouts}
          catalogMap={catalogMap}
          debugPart={debugParts}
          onClose={closeHistory}
          onSelectWorkout={(w) => {
            setHistoryVisible(false);
            setSelectedWorkout(w);
          }}
        />
      </Overlay>

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

      <Overlay
        visible={!!previewRoutine}
        animationType="none"
        onRequestClose={() => setPreviewRoutine(null)}
      >
        {previewRoutine && (
          <RoutinePreviewOverlay
            routine={previewRoutine}
            colors={colors}
            prevMap={prevMap}
            onDismiss={() => setPreviewRoutine(null)}
          />
        )}
      </Overlay>


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
    flex: 1,
    paddingHorizontal: sw(10),
    paddingTop: sw(14),
    paddingBottom: sw(4),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recoveryTitle: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: sw(8),
  },
  programSection: {
    marginTop: sw(16),
    marginHorizontal: sw(6),
    gap: sw(6),
  },
  programCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  programCardLeft: {
    flex: 1,
    gap: sw(3),
  },
  programCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  programCardLabel: {
    color: colors.accentGreen,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  programCardName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    flexShrink: 1,
  },
  programCardWeek: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    paddingHorizontal: sw(10),
    paddingTop: sw(6),
    paddingBottom: sw(6),
    backgroundColor: colors.background,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingVertical: sw(12),
    backgroundColor: colors.surface,
  },
  actionBtnLabel: {
    color: colors.textPrimary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  actionBtnAccent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(12),
    backgroundColor: colors.accent,
  },
  actionBtnAccentLabel: {
    color: colors.textOnAccent,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
});
