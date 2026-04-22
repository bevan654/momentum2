import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, ActivityIndicator, ScrollView, StyleSheet, Alert, Modal, StatusBar } from 'react-native';
import { Canvas, Path as SkiaPath, Rect as SkiaRect, Oval as SkiaOval, Skia, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useThemeStore, type ThemeMode } from '../stores/useThemeStore';
import { Fonts } from '../theme/typography';
import { sw, ms, SCREEN_WIDTH, SCREEN_HEIGHT } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import type { WorkoutWithDetails, ExerciseWithSets } from '../stores/useWorkoutStore';
import MiniBodyMap from '../components/body/MiniBodyMap';
import { useMuscleAnalysisStore } from '../stores/useMuscleAnalysisStore';
import { useProgramStore } from '../stores/useProgramStore';
import { MUSCLE_SLUGS, toSlug, type Slug } from '../utils/muscleVolume';
import type { ExtendedBodyPart } from '../components/BodyHighlighter';
import RankBadge from '../components/workouts/RankBadge';
import { computeWorkoutRank } from '../utils/strengthScore';
import WorkoutSummaryModal from '../components/workout-sheet/WorkoutSummaryModal';
import ActivityChart from '../components/workouts/ActivityChart';
import TodayScheduled from '../components/workouts/TodayScheduled';
import type { Routine, RoutineExercise } from '../stores/useRoutineStore';
import { navigateWorkoutsStack } from '../lib/navigationBridge';

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${vol}`;
}


/* ─── Glass border + corner glow (all Skia, no CSS border) ── */

const GLASS_BORDER_WIDTH = 1.5;

const GlassCornerGlow = React.memo(({ width, height, radius, accentColor, borderColor }: {
  width: number;
  height: number;
  radius: number;
  accentColor: string;
  borderColor: string;
}) => {
  const bw = GLASS_BORDER_WIDTH;
  const half = bw / 2;

  const borderPath = useMemo(() => {
    const ir = Math.max(radius - half, 0);
    const rect = Skia.XYWHRect(half, half, width - bw, height - bw);
    const rrect = Skia.RRectXY(rect, ir, ir);
    const p = Skia.Path.Make();
    p.addRRect(rrect);
    return p;
  }, [width, height, radius]);

  const reach = radius * 3.5;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {/* ── Base border ── */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw} color={borderColor} />

      {/* ── Bottom-left: tight bloom ── */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw + 1}>
        <RadialGradient
          c={vec(0, height)}
          r={reach}
          colors={[accentColor, `${accentColor}90`, `${accentColor}00`]}
          positions={[0, 0.35, 1]}
        />
        <BlurMask blur={sw(1.5)} style="normal" />
      </SkiaPath>

      {/* ── Bottom-left: bright sharp core ── */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw}>
        <RadialGradient
          c={vec(0, height)}
          r={reach}
          colors={[accentColor, `${accentColor}DD`, `${accentColor}00`]}
          positions={[0, 0.4, 1]}
        />
      </SkiaPath>

      {/* ── Top: 45% from right corner — tight bloom ── */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw + 1}>
        <RadialGradient
          c={vec(width * 0.55, 0)}
          r={reach}
          colors={[accentColor, `${accentColor}90`, `${accentColor}00`]}
          positions={[0, 0.35, 1]}
        />
        <BlurMask blur={sw(1.5)} style="normal" />
      </SkiaPath>

      {/* ── Top: 45% from right corner — bright sharp core ── */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw}>
        <RadialGradient
          c={vec(width * 0.55, 0)}
          r={reach}
          colors={[accentColor, `${accentColor}DD`, `${accentColor}00`]}
          positions={[0, 0.4, 1]}
        />
      </SkiaPath>

    </Canvas>
  );
});

/* ─── Rest day gradient accent (Skia) ────────────────── */

const RestDayGlow = React.memo(({ width, height, radius, glowColor }: {
  width: number;
  height: number;
  radius: number;
  glowColor: string;
}) => {
  const clipPath = useMemo(() => {
    const rect = Skia.XYWHRect(0, 0, width, height);
    const rrect = Skia.RRectXY(rect, radius, radius);
    const p = Skia.Path.Make();
    p.addRRect(rrect);
    return p;
  }, [width, height, radius]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <SkiaPath path={clipPath} clip>
        <SkiaRect x={0} y={0} width={width} height={height}>
          <RadialGradient
            c={vec(width, 0)}
            r={width * 0.85}
            colors={[`${glowColor}2E`, `${glowColor}0F`, `${glowColor}00`]}
            positions={[0, 0.4, 1]}
          />
        </SkiaRect>
      </SkiaPath>
    </Canvas>
  );
});


/* ─── History row with glass glow ────────────────────── */

const HistoryRow = React.memo(({ workout, dateStr, durationMin, styles, colors, onPress }: {
  workout: WorkoutWithDetails;
  dateStr: string;
  durationMin: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) => {
  const title = workout.programName || dateStr;

  return (
    <TouchableOpacity
      style={styles.historyRowCard}
      activeOpacity={0.6}
      onPress={onPress}
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

/* ─── Muscle group constants (derived from muscles.ts) ── */

import {
  CANONICAL_TO_BODY_GROUP,
  CANONICAL_TO_SVG_SLUG,
  CANONICAL_MUSCLES,
} from '../constants/muscles';

const SLUG_GROUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const canonical of CANONICAL_MUSCLES) {
    const svgSlug = CANONICAL_TO_SVG_SLUG[canonical];
    const group = CANONICAL_TO_BODY_GROUP[canonical];
    if (!map[svgSlug]) map[svgSlug] = group;
  }
  return map;
})();

const PART_GROUPS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders'],
  Biceps: ['biceps'],
  Triceps: ['triceps'],
  Core: ['abdominals', 'obliques', 'abs'],
  Quads: ['quads'],
  Hamstrings: ['hamstrings'],
  Glutes: ['glutes'],
  Calves: ['calves'],
  Arms: ['shoulders', 'biceps', 'triceps'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
};

function getLastLabel(lastDate: Date | null): string {
  if (!lastDate) return 'Never';
  const elapsed = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
  if (elapsed < 24) return `${Math.round(elapsed)}h ago`;
  const days = Math.floor(elapsed / 24);
  const hours = Math.round(elapsed % 24);
  if (days < 7) return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  return `${days}d ago`;
}

/* ─── History overlay (swipe-to-dismiss) ─────────────── */

const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

const TIME_FILTERS = ['All', '7d', '30d', '90d'] as const;
type TimeFilter = typeof TIME_FILTERS[number];
const TIME_LABELS: Record<TimeFilter, string> = { All: 'All', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
const TIME_MS: Record<TimeFilter, number> = { All: 0, '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };

const BODY_FILTERS = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves'] as const;
const PLAN_FILTERS = ['All', 'Program', 'Quick'] as const;
type PlanFilter = typeof PLAN_FILTERS[number];

const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

const HistoryOverlay = React.memo(function HistoryOverlay({
  workouts,
  catalogMap,
  debugPart,
  styles,
  colors,
  onClose,
  onSelectWorkout,
}: {
  workouts: WorkoutWithDetails[];
  catalogMap: Record<string, any>;
  debugPart: string[];
  styles: any;
  colors: ThemeColors;
  onClose: () => void;
  onSelectWorkout: (w: WorkoutWithDetails) => void;
}) {
  const translateY = useSharedValue(SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
    backdropOpacity.value = 1;
  }, []);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('All');
  const [bodyFilter, setBodyFilter] = useState<string>(debugPart.length > 0 ? debugPart[0] : 'All');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('All');

  const dismiss = useCallback(() => {
    translateY.value = SHEET_HEIGHT;
    backdropOpacity.value = 0;
    onClose();
  }, [onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => {
          ctx.value = translateY.value;
        })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (
            e.translationY > DISMISS_THRESHOLD ||
            e.velocityY > VELOCITY_THRESHOLD
          ) {
            translateY.value = SHEET_HEIGHT;
            backdropOpacity.value = 0;
            runOnJS(onClose)();
          } else {
            translateY.value = 0;
          }
        }),
    [onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

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
        const allTargetGroups = new Set<string>();
        for (const part of activeParts) {
          const groups = PART_GROUPS[part];
          if (groups) for (const g of groups) allTargetGroups.add(g);
        }
        if (allTargetGroups.size > 0) {
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
                if (group && allTargetGroups.has(group)) { matched = true; break; }
              }
            }
            if (matched) break;
          }
          if (!matched) return false;
        }
      }
      return true;
    });
  }, [workouts, timeFilter, bodyFilter, planFilter, debugPart, catalogMap]);

  const activeFilterCount = (timeFilter !== 'All' ? 1 : 0) + (bodyFilter !== 'All' ? 1 : 0) + (planFilter !== 'All' ? 1 : 0);
  const [openFilter, setOpenFilter] = useState<'time' | 'muscle' | 'type' | null>(null);

  const toggleFilter = useCallback((key: 'time' | 'muscle' | 'type') => {
    setOpenFilter((prev) => (prev === key ? null : key));
  }, []);

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
        {filtered.length === 0 ? (
          <Text style={styles.historyEmpty}>No workouts found</Text>
        ) : (
          filtered.map((w) => {
            const d = new Date(w.created_at);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            const dateStr = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
            const durationMin = Math.round(w.duration / 60);
            return (
              <HistoryRow
                key={w.id}
                workout={w}
                dateStr={dateStr}
                durationMin={durationMin}
                styles={styles}
                colors={colors}
                onPress={() => onSelectWorkout(w)}
              />
            );
          })
        )}
      </ScrollView>
      </Animated.View>
    </View>
    </GestureHandlerRootView>
  );
});


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
  const bodyweight = useWeightStore((s) => s.current) ?? 70;
  const selectedDate = useFoodLogStore((s) => s.selectedDate);
  const colors = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const analysis = useMuscleAnalysisStore((s) => s.analysis);
  const recompute = useMuscleAnalysisStore((s) => s.recompute);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const getDurationWeeks = useProgramStore((s) => s.getDurationWeeks);
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

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
  const [heroSize, setHeroSize] = useState({ w: 0, h: 0 });
  const [calorieSize, setCalorieSize] = useState({ w: 0, h: 0 });
  const [bodyMapSize, setBodyMapSize] = useState({ w: 0, h: 0 });
  const [startBtnSize, setStartBtnSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (userId) {
      fetchExerciseCatalog(userId).then(() => fetchWorkoutHistory(userId));
    }
  }, [userId]);

  // Recompute recovery data when workouts change
  useEffect(() => {
    if (workouts.length > 0) recompute(workouts, catalogMap);
  }, [workouts, catalogMap]);

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

  const calorieAnalysis = useMemo(() => {
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
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }, [selectedDate, isToday]);

  // Selected body part filter — must be before any early return
  const [debugParts, setDebugParts] = useState<string[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);

  // Recovery % → intensity: 3 colours only (red / orange / green)
  const recoveryToIntensity = (pct: number) => {
    if (pct >= 70) return 4;   // green
    if (pct >= 40) return 3;   // orange
    return 2;                  // red
  };

  // BodyHighlighter uses colors[intensity - 1], so:
  // intensity 1 → [0] bg, 2 → [1] red, 3 → [2] orange, 4 → [3] green
  const RECOVERY_COLORS = ['#1A1A1E', '#EF4444', '#F97316', '#34D399'];

  // Build body data from recovery percentages
  const recoveryBodyData: ExtendedBodyPart[] = useMemo(() => {
    if (!analysis?.groups) return [];
    const activeGroups = new Set<string>();
    for (const part of debugParts) {
      const groups = PART_GROUPS[part];
      if (groups) for (const g of groups) activeGroups.add(g);
    }
    return Array.from(MUSCLE_SLUGS).map((slug) => {
      const group = SLUG_GROUP[slug];
      if (activeGroups.size > 0 && (!group || !activeGroups.has(group))) {
        return { slug: slug as Slug, intensity: 1 };
      }
      const groupData = group ? analysis.groups[group as keyof typeof analysis.groups] : null;
      const pct = groupData?.recoveryPercent ?? 100;
      return { slug: slug as Slug, intensity: recoveryToIntensity(pct) };
    });
  }, [analysis, debugParts]);

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

  // Platform glow — derive from the SAME intensity + color array as the body map
  const platformGlow = useMemo(() => {
    const intensity = recoveryToIntensity(overallRecovery);
    const hex = RECOVERY_COLORS[intensity - 1];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      uplight: `rgba(${r},${g},${b},0.10)`,
      outer: `rgba(${r},${g},${b},0.15)`,
      core: `rgba(${r},${g},${b},0.30)`,
    };
  }, [overallRecovery]);

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

  // Most / least trained within the calendar window
  const trainedStats = useMemo(() => {
    const groupSessions: Record<string, number> = {};
    const allGroups = Object.keys(PART_GROUPS);
    for (const g of allGroups) groupSessions[g] = 0;

    for (const w of workouts) {
      const dateKey = toDateKey(w.created_at);
      if (dateKey < calendarGrid.startKey || dateKey > todayStr) continue;

      const hitGroups = new Set<string>();
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
                if (groups.includes(group)) hitGroups.add(label);
              }
            }
          }
        }
      }
      for (const g of hitGroups) groupSessions[g] = (groupSessions[g] || 0) + 1;
    }

    let most: string | null = null;
    let least: string | null = null;
    let maxCount = 0;
    let minCount = Infinity;

    for (const [group, count] of Object.entries(groupSessions)) {
      if (count > maxCount) { maxCount = count; most = group; }
      if (count < minCount) { minCount = count; least = group; }
    }

    return { most, least, mostCount: maxCount, leastCount: minCount };
  }, [workouts, catalogMap, calendarGrid.startKey, todayStr]);

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
  const caloriesBurnt = calorieAnalysis?.caloriesBurnt ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={{ paddingBottom: sw(16) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Recovery header ── */}
        <Text style={styles.recoveryTitle}>Recovery Overview — {Math.round(overallRecovery)}%</Text>
        {/* Body part filter */}
        <View style={styles.filterContainer}>
          {/* Main row: Whole, Chest, Back, Core + section toggles */}
          <View style={styles.filterMainRow}>
            <TouchableOpacity
              onPress={() => { setDebugParts([]); setExpandedSection(null); }}
              style={[styles.filterChip, debugParts.length === 0 && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, debugParts.length === 0 && styles.filterChipTextActive]}>Whole</Text>
              <Text style={[styles.filterChipSub, debugParts.length === 0 && styles.filterChipSubActive]}>{getLastLabel(
                workouts.length > 0 ? new Date(workouts[0].created_at) : null
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
        <TouchableOpacity style={styles.bodyMapSection} activeOpacity={0.7} onPress={() => openHistory()}>
          <View
            style={styles.bodyMapFigure}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setBodyMapSize({ w: width, h: height });
            }}
          >
            <View style={styles.bodyMapBody}>
              <MiniBodyMap bodyData={recoveryBodyData} colors={RECOVERY_COLORS} scale={0.62} side="front" />
            </View>
          </View>
          <View style={styles.bodyMapFigure}>
            <View style={styles.bodyMapBody}>
              <MiniBodyMap bodyData={recoveryBodyData} colors={RECOVERY_COLORS} scale={0.62} side="back" />
            </View>
          </View>
        </TouchableOpacity>

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
                        setSelectedWorkout(w);
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

        <TouchableOpacity style={styles.actionBtnAccent} activeOpacity={0.7} onPress={() => startEmptyWorkout()}>
          <Ionicons name="add" size={ms(18)} color={colors.textOnAccent} />
          <Text style={styles.actionBtnAccentLabel}>Start Empty</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={openPlans}>
          <Ionicons name="clipboard-outline" size={ms(16)} color={colors.textPrimary} />
          <Text style={styles.actionBtnLabel}>Plans</Text>
        </TouchableOpacity>
      </View>

      {/* ── History Overlay ──────────────────────── */}
      <Modal
        visible={historyVisible}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={closeHistory}
      >
        <HistoryOverlay
          workouts={workouts}
          catalogMap={catalogMap}
          debugPart={debugParts}
          styles={styles}
          colors={colors}
          onClose={closeHistory}
          onSelectWorkout={(w) => {
            setSelectedWorkout(w);
          }}
        />
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

      <Modal
        visible={!!previewRoutine}
        transparent
        statusBarTranslucent
        animationType="none"
        onRequestClose={() => setPreviewRoutine(null)}
      >
        {previewRoutine && (
          <RoutinePreviewOverlay
            routine={previewRoutine}
            colors={colors}
            catalogMap={catalogMap}
            prevMap={prevMap}
            onDismiss={() => setPreviewRoutine(null)}
          />
        )}
      </Modal>


    </View>
  );
}


/* ─── Routine Preview Overlay ─────────────────────────── */

const PREVIEW_SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

const RoutinePreviewOverlay = React.memo(function RoutinePreviewOverlay({
  routine, colors, catalogMap, prevMap, onDismiss,
}: {
  routine: Routine;
  colors: ThemeColors;
  catalogMap: Record<string, any>;
  prevMap: Record<string, any[]>;
  onDismiss: () => void;
}) {
  const os = useMemo(() => previewStyles(colors), [colors]);

  const translateY = useSharedValue(PREVIEW_SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
    backdropOpacity.value = 1;
  }, []);

  const dismiss = useCallback(() => {
    translateY.value = PREVIEW_SHEET_HEIGHT;
    backdropOpacity.value = 0;
    onDismiss();
  }, [onDismiss]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => { ctx.value = translateY.value; })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
            translateY.value = PREVIEW_SHEET_HEIGHT;
            backdropOpacity.value = 0;
            runOnJS(onDismiss)();
          } else {
            translateY.value = 0;
          }
        }),
    [onDismiss],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysLabel = routine.days.length > 0
    ? routine.days.map((d) => DAY_NAMES[d]).join(', ')
    : null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <View style={os.backdropWrap}>
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[os.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[os.sheetContainer, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={os.handleRow} hitSlop={{ top: 10, bottom: 10 }}>
            <View style={os.handle} />
          </Animated.View>
        </GestureDetector>

        <ScrollView style={os.scroll} contentContainerStyle={os.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={os.header}>
            <View style={os.headerSpacer} />
            <Text style={os.headerTitle}>Workout Summary</Text>
            <View style={os.headerSpacer} />
          </View>

          <View style={os.info}>
            <Text style={os.infoName}>{routine.name}</Text>
            <Text style={os.infoSub}>
              {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
              {daysLabel ? `  ·  ${daysLabel}` : ''}
            </Text>
          </View>

          {routine.exercises.map((ex, i) => {
            const reps = ex.set_reps || Array(ex.default_sets).fill(ex.default_reps);
            const weights = ex.set_weights || Array(ex.default_sets).fill(0);
            const prev = prevMap[ex.name] || [];
            const minR = Math.min(...reps);
            const maxR = Math.max(...reps);
            const repRange = minR === maxR ? `${minR}` : `${minR}-${maxR}`;

            const formatRest = (s: number) => {
              if (s >= 60) {
                const m = Math.floor(s / 60);
                const rem = s % 60;
                return rem > 0 ? `${m}m${rem}s` : `${m}m`;
              }
              return `${s}s`;
            };

            return (
              <View key={i} style={os.card}>
                <Text style={os.exName} numberOfLines={1}>
                  {ex.name.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <Text style={os.exSub}>
                  {reps.length} sets · {repRange} reps · {formatRest(ex.default_rest_seconds)}
                </Text>
                <View style={os.divider} />
                <View style={os.colHeaders}>
                  <Text style={[os.colHeader, os.colSet]}>SET</Text>
                  <Text style={[os.colHeader, os.colPrev]}>PREV</Text>
                  <Text style={[os.colHeader, os.colVal]}>KG</Text>
                  <Text style={[os.colHeader, os.colVal]}>REPS</Text>
                </View>
                {reps.map((r: number, si: number) => {
                  const p = prev[si];
                  const w = weights[si] || 0;
                  return (
                    <View key={si} style={os.setRow}>
                      <Text style={[os.setNum, os.colSet]}>{si + 1}</Text>
                      <Text style={[os.prevText, os.colPrev]}>
                        {p ? `${p.kg}×${p.reps}` : '—'}
                      </Text>
                      <Text style={[os.cellVal, os.colVal]}>{w > 0 ? w : '—'}</Text>
                      <Text style={[os.cellVal, os.colVal]}>{r}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
    </GestureHandlerRootView>
  );
});

const previewStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.92,
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    overflow: 'hidden',
  },
  handleRow: { alignItems: 'center', paddingVertical: sw(10) },
  handle: { width: sw(36), height: sw(4), borderRadius: sw(2), backgroundColor: colors.textTertiary + '60' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: sw(16), paddingBottom: sw(80) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: sw(12) },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: ms(18), lineHeight: ms(24), fontFamily: Fonts.bold, textAlign: 'center' },
  headerSpacer: { width: sw(36), height: sw(36) },
  info: { marginBottom: sw(16), gap: sw(4) },
  infoName: { color: colors.textPrimary, fontSize: ms(16), fontFamily: Fonts.bold, lineHeight: ms(22) },
  infoSub: { color: colors.textTertiary, fontSize: ms(13), fontFamily: Fonts.medium, lineHeight: ms(18) },
  card: { backgroundColor: colors.card, padding: sw(12), marginBottom: sw(10) },
  exName: { color: colors.textPrimary, fontSize: ms(14), fontFamily: Fonts.bold, lineHeight: ms(18) },
  exSub: { color: colors.textTertiary, fontSize: ms(11), fontFamily: Fonts.medium, lineHeight: ms(14), marginTop: sw(4) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginVertical: sw(10) },
  colHeaders: { flexDirection: 'row', alignItems: 'center', paddingVertical: sw(2) },
  colHeader: { color: colors.textTertiary, fontSize: ms(9), fontFamily: Fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  colSet: { width: sw(30) },
  colPrev: { width: sw(60) },
  colVal: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: sw(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  setNum: { color: colors.textSecondary, fontSize: ms(10), fontFamily: Fonts.semiBold, textAlign: 'center' },
  prevText: { color: colors.textTertiary, fontSize: ms(10), fontFamily: Fonts.medium, textAlign: 'center' },
  cellVal: { color: colors.textPrimary, fontSize: ms(12), fontFamily: Fonts.bold, textAlign: 'center' },
});

export default React.memo(WorkoutHistoryScreen);

const createStyles = (colors: ThemeColors, mode: string) => {
  const isDark = mode === 'dark';
  const glassBg = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.50)';
  const glassText = isDark ? '#FFFFFF' : colors.textPrimary;
  const glassTextSub = isDark ? '#FFFFFF' : colors.textSecondary;
  const glassTextMuted = isDark ? '#FFFFFF' : colors.textTertiary;

  return {
    // Expose border color as a plain string for Skia (not a style)
    _glassBorder: glassBorder,
    ...StyleSheet.create({
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

    /* ── Glass Card Base ─────────────────────────────────── */
    glassOuter: {
      borderRadius: sw(22),
      overflow: 'hidden',
      backgroundColor: glassBg,
      marginBottom: sw(8),
    },
    heroGlassOuter: {
      borderRadius: sw(22),
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : glassBg,
      marginBottom: sw(8),
    },
    glassBlur: {
      ...StyleSheet.absoluteFillObject,
    },

    /* ── Section Label (reused) ─────────────────────────── */
    sectionLabel: {
      color: glassTextMuted,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: sw(4),
    },

    sectionDivider: {
      width: '75%',
      height: 0.5,
      backgroundColor: colors.cardBorder,
      alignSelf: 'center',
      marginVertical: sw(10),
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
    heroCardInnerPad: {
      padding: sw(20),
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
    /* ── Body Part Filter Chips ─────────────────────────── */
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

    bodyMapSection: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(4),
      marginBottom: sw(6),
    },
    bodyMapFigure: {
      alignItems: 'center',
      paddingBottom: sw(0),
    },
    bodyMapGlow: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    bodyMapBody: {
      zIndex: 1,
      pointerEvents: 'none',
    },
    heroVolumeRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: sw(4),
      marginTop: sw(2),
    },
    heroVolume: {
      color: glassText,
      fontSize: ms(28),
      lineHeight: ms(33),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.5,
    },
    heroKgUnit: {
      color: glassTextSub,
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
    calorieCardInnerPad: {
      padding: sw(20),
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
      color: glassText,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    calorieTotalUnit: {
      color: glassTextSub,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    calorieCardLabel: {
      color: glassTextMuted,
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
      color: glassText,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },
    breakdownLabel: {
      color: glassTextMuted,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
    },

    /* ── Locked / Coming Soon Overlay ─────────────────────── */
    lockedCardWrap: {
      position: 'relative',
      marginBottom: sw(8),
      overflow: 'hidden',
      borderRadius: sw(22),
    },
    blurOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)',
      borderRadius: sw(22),
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
      color: glassTextSub,
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

    /* ── Most / Least Trained ─────────────────────────── */
    trainedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: sw(8),
      marginTop: sw(8),
    },
    trainedChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      paddingVertical: sw(6),
      paddingHorizontal: sw(10),
      borderRadius: sw(4),
      backgroundColor: colors.surface,
    },
    trainedLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    trainedValue: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.bold,
      flex: 1,
    },
    trainedCount: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
    },

    /* ── Active Program Card ──────────────────── */
    programSection: {
      marginTop: sw(16),
      marginHorizontal: sw(6),
      gap: sw(6),
    },
    programCard: {
      backgroundColor: colors.surface,
      padding: sw(12),
    },
    programCardDivider: {
      height: 0.5,
      backgroundColor: colors.cardBorder,
      marginVertical: sw(10),
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

    /* ── Action Bar ─────────────────────────── */
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

    /* ── Training Calendar ──────────────────────────────── */
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
    calendarMonthText: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: sw(10),
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
    calDotEmpty: {
      backgroundColor: 'transparent',
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
    calViewDetailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
    },
    calViewDetailsText: {
      color: colors.accent,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
    },

    /* ── Recent Sessions ────────────────────────────────── */
    recentSection: {
      marginTop: sw(16),
      marginBottom: sw(16),
    },
    recentHeading: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: sw(12),
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(10),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    recentRowLeft: {
      flex: 1,
      gap: sw(2),
    },
    recentDate: {
      color: glassText,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
    recentMeta: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
    recentRowRight: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: sw(2),
      marginRight: sw(8),
    },
    recentVolume: {
      color: glassText,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    recentVolUnit: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    recentSeeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(4),
      marginTop: sw(12),
    },
    recentSeeAllText: {
      color: colors.accent,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },

  })};
};
