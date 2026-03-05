import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Modal, StyleSheet, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Canvas, Path as SkiaPath, Rect as SkiaRect, Oval as SkiaOval, Skia, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useThemeStore, type ThemeMode } from '../stores/useThemeStore';
import { Fonts } from '../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import type { WorkoutWithDetails, ExerciseWithSets } from '../stores/useWorkoutStore';
import MiniBodyMap from '../components/body/MiniBodyMap';
import { useMuscleAnalysisStore } from '../stores/useMuscleAnalysisStore';
import { MUSCLE_SLUGS, toSlug, type Slug } from '../utils/muscleVolume';
import type { ExtendedBodyPart } from '../components/BodyHighlighter';
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

const RestDayGlow = React.memo(({ width, height, radius }: {
  width: number;
  height: number;
  radius: number;
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
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.0)']}
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
}) => (
  <TouchableOpacity
    style={styles.historyRowCard}
    activeOpacity={0.6}
    onPress={onPress}
  >
    <View style={styles.historyRowContent}>
      <View style={styles.historyRowLeft}>
        <Text style={styles.historyDate}>{dateStr}</Text>
        <Text style={styles.historyMeta}>
          {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
          {'  ·  '}{durationMin} min
        </Text>
      </View>
      <View style={styles.historyRowRight}>
        <Text style={styles.historyVolume}>{formatVolume(workout.totalVolume)}</Text>
        <Text style={styles.historyVolUnit}>kg</Text>
      </View>
      <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
    </View>
  </TouchableOpacity>
));

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
  const colors = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const analysis = useMuscleAnalysisStore((s) => s.analysis);
  const recompute = useMuscleAnalysisStore((s) => s.recompute);
  const styles = useMemo(() => createStyles(colors, themeMode), [colors, themeMode]);

  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [heroSize, setHeroSize] = useState({ w: 0, h: 0 });
  const [calorieSize, setCalorieSize] = useState({ w: 0, h: 0 });
  const [bodyMapSize, setBodyMapSize] = useState({ w: 0, h: 0 });
  const [startBtnSize, setStartBtnSize] = useState({ w: 0, h: 0 });

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchExerciseCatalog(userId).then(() => fetchWorkoutHistory(userId));
      }
    }, [userId])
  );

  // Recompute recovery data when workouts change
  useFocusEffect(
    useCallback(() => {
      if (workouts.length > 0) recompute(workouts, catalogMap);
    }, [workouts, catalogMap])
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

  // Slug → muscle group mapping for recovery lookup
  const SLUG_GROUP: Record<string, string> = {
    chest: 'chest', 'upper-back': 'back', 'lower-back': 'back', trapezius: 'back',
    deltoids: 'shoulders', 'rear-deltoids': 'shoulders', biceps: 'biceps', triceps: 'triceps',
    forearm: 'forearms', abs: 'abs', obliques: 'abs', quadriceps: 'quads',
    tibialis: 'quads', adductors: 'quads', hamstring: 'hamstrings', gluteal: 'glutes', calves: 'calves',
  };

  // Recovery % → intensity: 3 colours only (red / orange / green)
  const recoveryToIntensity = (pct: number) => {
    if (pct >= 70) return 4;   // green
    if (pct >= 40) return 3;   // orange
    return 2;                  // red
  };

  // BodyHighlighter uses colors[intensity - 1], so:
  // intensity 1 → [0] bg, 2 → [1] red, 3 → [2] orange, 4 → [3] green
  const RECOVERY_COLORS = ['#1A1A1E', '#EF4444', '#F97316', '#34D399'];

  const PART_GROUPS: Record<string, string[]> = {
    Chest: ['chest'],
    Back: ['back'],
    Shoulders: ['shoulders'],
    Arms: ['biceps', 'triceps', 'forearms'],
    Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  };

  // Selected body part filter
  const [debugPart, setDebugPart] = useState<string | null>(null);
  const [subPart, setSubPart] = useState<string | null>(null);

  // Sub-muscle labels for display
  const SUB_LABELS: Record<string, string> = {
    biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
    quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  };

  // The muscles currently active (respects sub-part drill-down)
  const activeFilter = useMemo(() => {
    if (subPart) return [subPart];
    if (debugPart && PART_GROUPS[debugPart]) return PART_GROUPS[debugPart];
    return null;
  }, [debugPart, subPart]);

  // Build body data from recovery percentages
  const recoveryBodyData: ExtendedBodyPart[] = useMemo(() => {
    if (!analysis?.groups) return [];
    return Array.from(MUSCLE_SLUGS).map((slug) => {
      const group = SLUG_GROUP[slug];
      if (activeFilter && (!group || !activeFilter.includes(group))) {
        return { slug: slug as Slug, intensity: 1 };
      }
      const groupData = group ? analysis.groups[group as keyof typeof analysis.groups] : null;
      const pct = groupData?.recoveryPercent ?? 100;
      return { slug: slug as Slug, intensity: recoveryToIntensity(pct) };
    });
  }, [analysis, activeFilter]);

  // Overall recovery % — use min (not average) so platform matches the most fatigued visible muscle
  const overallRecovery = useMemo(() => {
    if (!analysis?.groups) return 100;
    if (activeFilter) {
      const vals = activeFilter.map((k) => {
        const g = analysis.groups[k as keyof typeof analysis.groups] as { recoveryPercent?: number } | undefined;
        return g?.recoveryPercent ?? 100;
      });
      return Math.min(...vals);
    }
    const groups = Object.values(analysis.groups) as { recoveryPercent?: number }[];
    if (groups.length === 0) return 100;
    return Math.min(...groups.map((g) => g.recoveryPercent ?? 100));
  }, [analysis, activeFilter]);

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

    const padding = sw(40) * 2;
    const available = SCREEN_WIDTH - padding;
    const gap = sw(2);
    const dotSize = Math.floor((available - gap * (COLS_PER_ROW - 1)) / COLS_PER_ROW);
    return { rows, dotSize, gap, startKey };
  }, []);

  const trainedDays = useMemo(() => {
    const days = new Set<string>();

    for (const w of workouts) {
      const dateKey = toDateKey(w.created_at);

      if (!activeFilter) {
        days.add(dateKey);
        continue;
      }

      let matched = false;
      for (const ex of w.exercises) {
        let primary = ex.primary_muscles || [];
        let secondary = ex.secondary_muscles || [];
        if (primary.length === 0 && secondary.length === 0) {
          const cat = catalogMap[ex.name];
          if (cat) {
            primary = cat.primary_muscles || [];
            secondary = cat.secondary_muscles || [];
          }
        }
        for (const raw of [...primary, ...secondary]) {
          const slug = toSlug(raw);
          if (slug) {
            const group = SLUG_GROUP[slug];
            if (group && activeFilter.includes(group)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
      if (matched) days.add(dateKey);
    }

    return days;
  }, [workouts, catalogMap, activeFilter]);

  // Last trained date per body part (from all workouts)
  const lastTrainedMap = useMemo(() => {
    const map: Record<string, Date | null> = {};
    for (const label of Object.keys(PART_GROUPS)) map[label] = null;

    for (const w of workouts) {
      const wDate = new Date(w.created_at);
      const hitParts = new Set<string>();
      for (const ex of w.exercises) {
        let primary = ex.primary_muscles || [];
        let secondary = ex.secondary_muscles || [];
        if (primary.length === 0 && secondary.length === 0) {
          const cat = catalogMap[ex.name];
          if (cat) { primary = cat.primary_muscles || []; secondary = cat.secondary_muscles || []; }
        }
        for (const raw of [...primary, ...secondary]) {
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
        let secondary = ex.secondary_muscles || [];
        if (primary.length === 0 && secondary.length === 0) {
          const cat = catalogMap[ex.name];
          if (cat) { primary = cat.primary_muscles || []; secondary = cat.secondary_muscles || []; }
        }
        for (const raw of [...primary, ...secondary]) {
          const slug = toSlug(raw);
          if (slug) {
            const group = SLUG_GROUP[slug];
            if (group) {
              // Find which PART_GROUPS key maps to this group
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

  return (
    <View style={styles.container}>
      <View
        style={styles.scrollContent}
      >
        {/* ── Body Map ─────────────────────────────── */}
        <Text style={styles.recoveryTitle}>Recovery Overview — {Math.round(overallRecovery)}%</Text>
        {/* Body part filter */}
        <View style={styles.filterRow}>
          {['Whole', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs'].map((label) => {
            const isActive = label === 'Whole' ? debugPart === null : debugPart === label;
            const lastDate = label !== 'Whole' ? lastTrainedMap[label] : null;
            let lastLabel = '';
            if (label !== 'Whole' && lastDate) {
              const elapsed = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
              if (elapsed < 24) lastLabel = `${Math.round(elapsed)}h ago`;
              else if (elapsed < 48) lastLabel = '1d ago';
              else lastLabel = `${Math.round(elapsed / 24)}d ago`;
            } else if (label !== 'Whole') {
              lastLabel = 'Never';
            }
            return (
              <TouchableOpacity
                key={label}
                onPress={() => { setDebugPart(label === 'Whole' ? null : label); setSubPart(null); }}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={styles.filterChipText}>{label}</Text>
                {label !== 'Whole' && (
                  <Text style={styles.filterChipSub}>{lastLabel}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {debugPart && PART_GROUPS[debugPart] && PART_GROUPS[debugPart].length > 1 && (
          <View style={styles.subFilterRow}>
            <TouchableOpacity
              onPress={() => setSubPart(null)}
              style={[styles.subFilterChip, !subPart && styles.subFilterChipActive]}
            >
              <Text style={[styles.subFilterChipText, !subPart && styles.subFilterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {PART_GROUPS[debugPart].map((muscle) => {
              const isActive = subPart === muscle;
              return (
                <TouchableOpacity
                  key={muscle}
                  onPress={() => setSubPart(isActive ? null : muscle)}
                  style={[styles.subFilterChip, isActive && styles.subFilterChipActive]}
                >
                  <Text style={[styles.subFilterChipText, isActive && styles.subFilterChipTextActive]}>
                    {SUB_LABELS[muscle] || muscle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <TouchableOpacity style={styles.bodyMapSection} activeOpacity={0.7} onPress={() => setShowHistory(true)}>
          <View
            style={styles.bodyMapFigure}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setBodyMapSize({ w: width, h: height });
            }}
          >
            {bodyMapSize.w > 0 && (
              <Canvas style={styles.bodyMapGlow} pointerEvents="none">
                {/* Uplight glow from platform */}
                <SkiaOval
                  x={bodyMapSize.w * 0.2}
                  y={bodyMapSize.h * 0.35}
                  width={bodyMapSize.w * 0.6}
                  height={bodyMapSize.h * 0.65}
                  color={platformGlow.uplight}
                >
                  <BlurMask blur={sw(25)} style="normal" />
                </SkiaOval>
                {/* Platform ellipse */}
                <SkiaOval
                  x={bodyMapSize.w * 0.1}
                  y={bodyMapSize.h - sw(40)}
                  width={bodyMapSize.w * 0.8}
                  height={sw(28)}
                  color={platformGlow.outer}
                >
                  <BlurMask blur={sw(6)} style="normal" />
                </SkiaOval>
                <SkiaOval
                  x={bodyMapSize.w * 0.2}
                  y={bodyMapSize.h - sw(36)}
                  width={bodyMapSize.w * 0.6}
                  height={sw(16)}
                  color={platformGlow.core}
                >
                  <BlurMask blur={sw(2)} style="normal" />
                </SkiaOval>
              </Canvas>
            )}
            <View style={styles.bodyMapBody}>
              <MiniBodyMap bodyData={recoveryBodyData} colors={RECOVERY_COLORS} scale={0.75} side="front" />
            </View>
          </View>
          <View style={styles.bodyMapFigure}>
            {bodyMapSize.w > 0 && (
              <Canvas style={styles.bodyMapGlow} pointerEvents="none">
                {/* Uplight glow from platform */}
                <SkiaOval
                  x={bodyMapSize.w * 0.2}
                  y={bodyMapSize.h * 0.35}
                  width={bodyMapSize.w * 0.6}
                  height={bodyMapSize.h * 0.65}
                  color={platformGlow.uplight}
                >
                  <BlurMask blur={sw(25)} style="normal" />
                </SkiaOval>
                {/* Platform ellipse */}
                <SkiaOval
                  x={bodyMapSize.w * 0.1}
                  y={bodyMapSize.h - sw(40)}
                  width={bodyMapSize.w * 0.8}
                  height={sw(28)}
                  color={platformGlow.outer}
                >
                  <BlurMask blur={sw(6)} style="normal" />
                </SkiaOval>
                <SkiaOval
                  x={bodyMapSize.w * 0.2}
                  y={bodyMapSize.h - sw(36)}
                  width={bodyMapSize.w * 0.6}
                  height={sw(16)}
                  color={platformGlow.core}
                >
                  <BlurMask blur={sw(2)} style="normal" />
                </SkiaOval>
              </Canvas>
            )}
            <View style={styles.bodyMapBody}>
              <MiniBodyMap bodyData={recoveryBodyData} colors={RECOVERY_COLORS} scale={0.75} side="back" />
            </View>
          </View>
        </TouchableOpacity>

        {/* ── Training Calendar (last 56 days) ── */}
        <TouchableOpacity style={styles.calendarSection} activeOpacity={0.7} onPress={() => setShowHistory(true)}>
          <View style={[styles.calendarHeatmap, { gap: calendarGrid.gap }]}>
            {calendarGrid.rows.map((row, ri) => (
              <View key={ri} style={[styles.calendarRow, { gap: calendarGrid.gap }]}>
                {row.map((dateStr, ci) => (
                  <View key={ci} style={[
                    styles.calDot,
                    { width: calendarGrid.dotSize, height: calendarGrid.dotSize },
                    trainedDays.has(dateStr) && styles.calDotTrained,
                    dateStr === todayStr && (trainedDays.has(dateStr) ? styles.calDotTodayTrained : styles.calDotToday),
                  ]} />
                ))}
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* ── Most / Least Trained ──────────────────── */}
        {trainedStats.most && trainedStats.least && (
          <View style={[styles.trainedRow, { width: calendarGrid.dotSize * COLS_PER_ROW + calendarGrid.gap * (COLS_PER_ROW - 1), alignSelf: 'center' }]}>
            <View style={styles.trainedChip}>
              <Ionicons name="trending-up" size={ms(12)} color={colors.accent} />
              <Text style={styles.trainedLabel}>Most</Text>
              <Text style={styles.trainedValue}>{trainedStats.most}</Text>
              <Text style={styles.trainedCount}>{trainedStats.mostCount}x</Text>
            </View>
            <View style={styles.trainedChip}>
              <Ionicons name="trending-down" size={ms(12)} color={'#EF4444'} />
              <Text style={styles.trainedLabel}>Least</Text>
              <Text style={styles.trainedValue}>{trainedStats.least}</Text>
              <Text style={styles.trainedCount}>{trainedStats.leastCount}x</Text>
            </View>
          </View>
        )}

      </View>

      {/* ── Start Workout Button (fixed above footer) ── */}
      <View style={styles.startWorkoutBar}>
        <TouchableOpacity
          style={[styles.startWorkoutOuter, { width: calendarGrid.dotSize * COLS_PER_ROW + calendarGrid.gap * (COLS_PER_ROW - 1), alignSelf: 'center' }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('StartWorkout')}
        >
          <View style={styles.startWorkoutLeft}>
            <Text style={styles.startWorkoutText}>Start Workout</Text>
          </View>
          <View style={styles.startWorkoutRight}>
            <Ionicons name="arrow-forward" size={ms(18)} color={colors.textOnAccent} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── History Modal ──────────────────────── */}
      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.historyModal}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>{debugPart ? `${debugPart} History` : 'Workout History'}</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={ms(22)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
            {workouts.length === 0 ? (
              <Text style={styles.historyEmpty}>No workouts yet</Text>
            ) : (
              workouts.filter((w) => {
                if (!debugPart) return true;
                const targetGroups = PART_GROUPS[debugPart];
                if (!targetGroups) return true;
                for (const ex of w.exercises) {
                  let primary = ex.primary_muscles || [];
                  let secondary = ex.secondary_muscles || [];
                  if (primary.length === 0 && secondary.length === 0) {
                    const cat = catalogMap[ex.name];
                    if (cat) { primary = cat.primary_muscles || []; secondary = cat.secondary_muscles || []; }
                  }
                  for (const raw of [...primary, ...secondary]) {
                    const slug = toSlug(raw);
                    if (slug) {
                      const group = SLUG_GROUP[slug];
                      if (group && targetGroups.includes(group)) return true;
                    }
                  }
                }
                return false;
              }).map((w) => {
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
                    onPress={() => {
                      setShowHistory(false);
                      setTimeout(() => setSelectedWorkout(w), 300);
                    }}
                  />
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
      paddingHorizontal: sw(16),
      paddingTop: sw(16),
      paddingBottom: sw(12),
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
      backgroundColor: 'rgba(255,255,255,0.10)',
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
      color: 'rgba(255,255,255,0.50)',
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: sw(14),
      zIndex: 1,
    },
    /* ── Body Part Filter Chips ─────────────────────────── */
    filterRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(4),
      marginBottom: sw(8),
      paddingHorizontal: sw(8),
    },
    filterChip: {
      flex: 1,
      paddingHorizontal: sw(2),
      paddingVertical: sw(5),
      borderRadius: sw(8),
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center',
    },
    filterChipActive: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filterChipText: {
      color: '#FFF',
      fontSize: ms(9.5),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
    },
    filterChipSub: {
      color: 'rgba(255,255,255,0.30)',
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.medium,
    },
    /* ── Sub-filter chips (specific muscles within a group) ── */
    subFilterRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(6),
      marginBottom: sw(8),
      paddingHorizontal: sw(40),
    },
    subFilterChip: {
      paddingHorizontal: sw(10),
      paddingVertical: sw(3),
      borderRadius: sw(6),
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    subFilterChipActive: {
      backgroundColor: `${colors.accent}20`,
      borderColor: `${colors.accent}60`,
    },
    subFilterChipText: {
      color: 'rgba(255,255,255,0.45)',
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    subFilterChipTextActive: {
      color: colors.accent,
      fontFamily: Fonts.semiBold,
    },

    bodyMapSection: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: sw(8),
      marginBottom: sw(12),
    },
    bodyMapFigure: {
      alignItems: 'center',
      paddingBottom: sw(30),
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
    historyRowCard: {
      marginBottom: sw(8),
    },
    historyRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: sw(14),
    },
    historyRowLeft: {
      flex: 1,
      gap: sw(2),
    },
    historyDate: {
      color: glassText,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    historyMeta: {
      color: glassTextSub,
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
      color: glassText,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    historyVolUnit: {
      color: glassTextSub,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },

    /* ── Most / Least Trained ─────────────────────────── */
    trainedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: sw(8),
      marginTop: sw(14),
    },
    trainedChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      paddingVertical: sw(8),
      paddingHorizontal: sw(10),
      borderRadius: sw(4),
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    trainedLabel: {
      color: 'rgba(255,255,255,0.35)',
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    trainedValue: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.bold,
      flex: 1,
    },
    trainedCount: {
      color: 'rgba(255,255,255,0.30)',
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
    },

    /* ── Start Workout Button ─────────────────────────── */
    startWorkoutBar: {
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(16),
      backgroundColor: colors.background,
    },
    startWorkoutOuter: {
      flexDirection: 'row',
      borderRadius: sw(12),
      overflow: 'hidden',
    },
    startWorkoutLeft: {
      flex: 1,
      backgroundColor: glassBg,
      paddingVertical: sw(14),
      justifyContent: 'center',
      alignItems: 'center',
    },
    startWorkoutRight: {
      width: sw(48),
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    startWorkoutText: {
      color: '#FFF',
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
    },

    /* ── Training Calendar ──────────────────────────────── */
    calendarSection: {
      alignItems: 'center',
      marginBottom: sw(6),
    },
    calendarMonthText: {
      color: 'rgba(255,255,255,0.50)',
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
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    calDotEmpty: {
      backgroundColor: 'transparent',
    },
    calDotTrained: {
      backgroundColor: colors.accent,
    },
    calDotToday: {
      backgroundColor: '#3B82F6',
    },
    calDotTodayTrained: {
      backgroundColor: '#3B82F6',
    },

    /* ── Recent Sessions ────────────────────────────────── */
    recentSection: {
      marginTop: sw(16),
      marginBottom: sw(16),
    },
    recentHeading: {
      color: 'rgba(255,255,255,0.50)',
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
      borderBottomColor: 'rgba(255,255,255,0.06)',
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
      color: 'rgba(255,255,255,0.40)',
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
      color: 'rgba(255,255,255,0.40)',
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
