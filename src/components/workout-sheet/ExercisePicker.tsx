import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { getMuscleColor, toCanonical, CANONICAL_TO_UI_CATEGORY, UI_CATEGORY_COLORS } from '../../constants/muscles';

/* ─── Muscle color (derived from muscles.ts) ─────────── */

function muscleColor(muscle: string): string {
  return getMuscleColor(muscle);
}
import { useAuthStore } from '../../stores/useAuthStore';
import CreateCustomExerciseModal from './CreateCustomExerciseModal';

/* ─── External API search (wger.de) ──────────────────── */

const WGER_SEARCH_URL = 'https://wger.de/api/v2/exercise/search/?language=2&format=json';

/** Wger muscle IDs → canonical muscle names */
const WGER_MUSCLE_MAP: Record<number, string> = {
  1: 'biceps',        // Biceps brachii
  2: 'shoulders',     // Anterior deltoid
  3: 'abs',           // Serratus anterior
  4: 'chest',         // Pectoralis major
  5: 'triceps',       // Triceps brachii
  6: 'abs',           // Rectus abdominis
  7: 'calves',        // Gastrocnemius
  8: 'glutes',        // Gluteus maximus
  9: 'traps',         // Trapezius
  10: 'quads',        // Quadriceps femoris
  11: 'hamstrings',   // Biceps femoris
  12: 'lats',         // Latissimus dorsi
  13: 'biceps',       // Brachialis
  14: 'obliques',     // Obliquus externus abdominis
  15: 'calves',       // Soleus
};

/** Wger category IDs → UI category strings */
const WGER_CATEGORY_MAP: Record<number, string> = {
  8: 'Arms', 9: 'Legs', 10: 'Core', 11: 'Chest',
  12: 'Back', 13: 'Shoulders', 14: 'Legs', 15: 'Cardio',
};

/** Wger equipment IDs → exercise type */
const WGER_BW_EQUIPMENT = new Set([7]); // 7 = "none (bodyweight)"

interface WgerSearchResult {
  value: string;  // exercise name
  data: {
    id: number;
    category: { id: number; name: string };
    muscles: { id: number; name: string; name_en: string }[];
    muscles_secondary: { id: number; name: string; name_en: string }[];
    equipment: { id: number; name: string }[];
  };
}

/* ─── Constants ───────────────────────────────────────── */

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.round(SCREEN_H * 0.88);
const RADIUS = sw(20);
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.6;
const SEARCH_DEBOUNCE_MS = 150;
/** Delay before mounting heavy list content (ms).
 *  Lets the spring animation run uncontested on the UI thread. */
const CONTENT_DEFER_MS = 180;

const OPEN_SPRING = { damping: 28, stiffness: 280, mass: 0.8 };
const SNAP_SPRING = { damping: 24, stiffness: 350, mass: 0.7 };
const CLOSE_CFG = { duration: 250, easing: Easing.in(Easing.cubic) };

/* ── Smart search engine ──────────────────────────────── */

const TOKEN_ALIASES: Record<string, string[]> = {
  db: ['dumbbell'],
  bb: ['barbell'],
  ez: ['ez-bar', 'ez bar'],
  kb: ['kettlebell'],
  sm: ['smith', 'smith machine'],
  bp: ['bench press'],
  ohp: ['overhead press'],
  rdl: ['romanian deadlift'],
  dl: ['deadlift'],
  sq: ['squat'],
  lp: ['leg press'],
  bench: ['bench press'],
  squat: ['squats', 'back squat', 'front squat', 'goblet squat'],
  deadlift: ['deadlifts', 'dead lift'],
  press: ['bench press', 'overhead press', 'shoulder press', 'leg press'],
  row: ['rows', 'barbell row', 'dumbbell row', 'cable row', 'seated row', 'bent over row'],
  curl: ['curls', 'bicep curl', 'hammer curl', 'preacher curl'],
  fly: ['flys', 'flies', 'flyes', 'chest fly', 'cable fly', 'pec fly'],
  raise: ['raises', 'lateral raise', 'front raise', 'calf raise'],
  extension: ['extensions', 'tricep extension', 'leg extension'],
  pulldown: ['lat pulldown', 'lat pull down', 'pull down'],
  pullup: ['pull up', 'pull-up', 'pullups', 'pull ups', 'chin up', 'chinup'],
  pushup: ['push up', 'push-up', 'pushups', 'push ups'],
  dip: ['dips', 'chest dip', 'tricep dip'],
  shrug: ['shrugs', 'barbell shrug', 'dumbbell shrug'],
  crunch: ['crunches', 'ab crunch'],
  plank: ['planks'],
  lunge: ['lunges', 'walking lunge', 'reverse lunge'],
  incl: ['incline'],
  decl: ['decline'],
  rev: ['reverse'],
  chest: ['bench press', 'fly', 'pec', 'push up'],
  back: ['row', 'pulldown', 'pull up', 'lat'],
  shoulders: ['overhead press', 'lateral raise', 'front raise', 'delt', 'shoulder'],
  biceps: ['bicep curl', 'hammer curl', 'preacher curl', 'curl'],
  triceps: ['tricep extension', 'pushdown', 'dip', 'skull crusher', 'tricep'],
  quads: ['squat', 'leg press', 'leg extension', 'lunge'],
  hamstrings: ['romanian deadlift', 'leg curl', 'hamstring'],
  glutes: ['hip thrust', 'glute bridge', 'squat', 'lunge'],
  calves: ['calf raise', 'calf'],
  abs: ['crunch', 'plank', 'sit up', 'ab', 'core'],
  traps: ['shrug', 'trap'],
  forearms: ['wrist curl', 'forearm'],
  lats: ['lat pulldown', 'pull up', 'lat'],
};

let _expandMap: Record<string, Set<string>> | null = null;
function getExpandMap(): Record<string, Set<string>> {
  if (_expandMap) return _expandMap;
  _expandMap = {};
  for (const [key, vals] of Object.entries(TOKEN_ALIASES)) {
    if (!_expandMap[key]) _expandMap[key] = new Set();
    for (const v of vals) {
      _expandMap[key].add(v);
      if (!_expandMap[v]) _expandMap[v] = new Set();
      _expandMap[v].add(key);
    }
  }
  return _expandMap;
}

function expandToken(token: string): string[] {
  const map = getExpandMap();
  const out = [token];
  const mapped = map[token];
  if (mapped) {
    for (const m of mapped) out.push(m);
  }
  for (const key of Object.keys(map)) {
    if (key.length >= 3 && key.startsWith(token) && key !== token) {
      out.push(key);
      for (const m of map[key]) out.push(m);
    }
  }
  return out;
}

function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return Infinity;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function wordScore(qw: string, nw: string): number {
  if (nw === qw) return 10;
  if (nw.startsWith(qw)) return 8;
  if (nw.includes(qw) && qw.length >= 2) return 5;
  const maxTypo = qw.length <= 4 ? 1 : 2;
  const dist = levenshtein(qw, nw.slice(0, qw.length + maxTypo), maxTypo);
  if (dist <= maxTypo) return 6 - dist * 2;
  return 0;
}

interface ExerciseData {
  name: string;
  category: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
}

function scoreExercise(ex: ExerciseData, query: string): number {
  const lower = ex.name.toLowerCase();

  if (lower === query) return 200;
  if (lower.startsWith(query)) return 150;
  if (lower.includes(query)) return 120;

  const queryWords = query.split(/[\s\-]+/).filter(Boolean);
  const nameWords = lower.split(/[\s\-]+/);
  const muscleWords = [
    ...(ex.primary_muscles || []).flatMap((m) => m.toLowerCase().split(/[\s\-]+/)),
    ...(ex.secondary_muscles || []).flatMap((m) => m.toLowerCase().split(/[\s\-]+/)),
  ];
  const catWords = ex.category ? ex.category.toLowerCase().split(/[\s\-]+/) : [];
  const allTargetWords = [...nameWords, ...muscleWords, ...catWords];

  let totalScore = 0;
  let matchedQueryWords = 0;

  for (const qw of queryWords) {
    const expanded = expandToken(qw);
    let bestWordScore = 0;

    for (const eq of expanded) {
      const eqTokens = eq.split(/[\s\-]+/);
      for (const et of eqTokens) {
        for (const nw of allTargetWords) {
          const s = wordScore(et, nw);
          const isName = nameWords.includes(nw);
          const adjusted = isName ? s : Math.ceil(s * 0.7);
          if (adjusted > bestWordScore) bestWordScore = adjusted;
        }
      }
    }

    if (bestWordScore > 0) matchedQueryWords++;
    totalScore += bestWordScore;
  }

  if (matchedQueryWords < queryWords.length) return 0;

  const precisionBonus = (matchedQueryWords / queryWords.length) * 10;
  return totalScore + precisionBonus;
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Debounce hook ────────────────────────────────────── */

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/* ═══════════════════════════════════════════════════════════
   Module-level cache for expensive computations
   ─────────────────────────────────────────────────────────
   The ExercisePicker unmounts on close and remounts on open.
   Without caching, every open re-sorts the entire 10K+
   exercise catalog. These caches persist across mount cycles
   and only recompute when the underlying data changes.
   ═══════════════════════════════════════════════════════════ */

interface CatalogEntry {
  name: string;
  category: string | null;
  exercise_type: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  done: boolean;
}

let _sortedCache: CatalogEntry[] | null = null;
let _sortedCatalogRef: any = null;
let _sortedAliasRef: any = null;
let _sortedPrevRef: any = null;

function getCachedSorted(
  catalogMap: Record<string, any>,
  aliasMap: Record<string, any>,
  prevMap: Record<string, any>,
): CatalogEntry[] {
  if (
    catalogMap === _sortedCatalogRef &&
    aliasMap === _sortedAliasRef &&
    prevMap === _sortedPrevRef &&
    _sortedCache
  ) {
    return _sortedCache;
  }
  _sortedCatalogRef = catalogMap;
  _sortedAliasRef = aliasMap;
  _sortedPrevRef = prevMap;
  _sortedCache = Object.entries(catalogMap)
    .filter(([name]) => !aliasMap[name])
    .map(([name, entry]: [string, any]) => ({
      name,
      category: entry.category,
      exercise_type: entry.exercise_type,
      primary_muscles: entry.primary_muscles || [],
      secondary_muscles: entry.secondary_muscles || [],
      done: !!prevMap[name],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _sortedCache;
}

const MAIN_MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio'];

const GROUP_CHIP_COLORS: Record<string, string> = UI_CATEGORY_COLORS;

function getMainGroup(muscle: string): string | null {
  const canonical = toCanonical(muscle);
  return canonical ? CANONICAL_TO_UI_CATEGORY[canonical] : null;
}

/* ── Memoized row component ───────────────────────────── */

interface ExerciseRowProps {
  name: string;
  category: string;
  exercise_type: string;
  primary_muscles?: string[];
  onSelect: (name: string, category: string, exerciseType: string) => void;
  styles: ReturnType<typeof createStyles>;
}

const ExerciseRow = memo(function ExerciseRow({
  name,
  category,
  exercise_type,
  primary_muscles,
  onSelect,
  styles,
}: ExerciseRowProps) {
  const subtitle = primary_muscles && primary_muscles.length > 0
    ? primary_muscles.map(titleCase).join(', ')
    : titleCase(category || '');
  return (
    <TouchableOpacity
      style={styles.exerciseRow}
      onPress={() => onSelect(name, category, exercise_type)}
      activeOpacity={0.6}
    >
      <View
        style={[
          styles.catDot,
          { backgroundColor: muscleColor(primary_muscles?.[0] || category || '') },
        ]}
      />
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>{titleCase(name)}</Text>
        <Text style={styles.exerciseCat}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
});

/* ═══════════════════════════════════════════════════════════
   ExercisePicker
   ─────────────────────────────────────────────────────────
   Architecture for FPS:
   1. Module-level cache: sorted entries + muscles survive
      unmount/remount — zero-cost on re-open.
   2. Deferred content mount: the heavy SectionList/FlatList
      mounts AFTER the spring animation is mostly done
      (CONTENT_DEFER_MS delay), keeping the UI thread free
      for smooth 120fps animation.
   3. No Modal, no GestureHandlerRootView — direct Reanimated
      translateY + Gesture Handler.
   4. GPU rasterization hint on the animated sheet view.
   ═══════════════════════════════════════════════════════════ */

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, exerciseType: string, category: string | null) => void;
  mode?: 'add' | 'replace';
}

export default function ExercisePicker({ visible, onClose, onSelect, mode = 'add' }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const aliasMap = useWorkoutStore((s) => s.aliasMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const createUserExercise = useWorkoutStore((s) => s.createUserExercise);
  const userId = useAuthStore((s) => s.user?.id);

  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [alive, setAlive] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [apiResults, setApiResults] = useState<CatalogEntry[]>([]);
  const [apiSearching, setApiSearching] = useState(false);
  const [showApiResults, setShowApiResults] = useState(false);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  /* ─── Refs ──────────────────────────────────────────── */

  const translateY = useSharedValue(SHEET_H);
  const ctx = useSharedValue(0);
  const openRef = useRef(false);
  const gestureClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Animation helpers ─────────────────────────────── */

  const cleanup = useCallback(() => {
    setAlive(false);
    setContentReady(false);
    setSearch('');
    setSelectedMuscle(null);
    setApiResults([]);
    setShowApiResults(false);
  }, []);

  /* ─── Open / close lifecycle ────────────────────────── */

  useEffect(() => {
    if (visible) {
      openRef.current = true;
      gestureClosingRef.current = false;
      setAlive(true);
      setContentReady(false);
      cancelAnimation(translateY);
      // Start at position 0 instantly — no spring animation, avoids stutter on Modal mount
      translateY.value = 0;
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
      contentTimerRef.current = setTimeout(() => setContentReady(true), CONTENT_DEFER_MS);
    } else if (openRef.current) {
      openRef.current = false;
      if (contentTimerRef.current) { clearTimeout(contentTimerRef.current); contentTimerRef.current = null; }
      if (!gestureClosingRef.current) {
        Keyboard.dismiss();
        cancelAnimation(translateY);
        translateY.value = withTiming(SHEET_H, CLOSE_CFG, (finished) => {
          if (finished) runOnJS(cleanup)();
        });
      }
      gestureClosingRef.current = false;
    }
  }, [visible]);

  useEffect(() => () => {
    cancelAnimation(translateY);
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
  }, []);

  /* ─── Animated styles (UI thread) ───────────────────── */

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateY.value / SHEET_H;
    return { opacity: Math.max(0, Math.min(BACKDROP_MAX, progress * BACKDROP_MAX)) };
  });

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: Math.max(0, translateY.value) }] };
  });

  /* ─── Gesture (UI thread) ───────────────────────────── */

  const handleDismiss = useCallback(() => {
    gestureClosingRef.current = true;
    Keyboard.dismiss();
    onCloseRef.current();
  }, []);

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
            translateY.value = withSpring(
              SHEET_H,
              {
                velocity: e.velocityY,
                damping: 50,
                stiffness: 300,
                mass: 0.8,
                overshootClamping: true,
              },
              (finished) => {
                if (finished) runOnJS(cleanup)();
              },
            );
            runOnJS(handleDismiss)();
          } else {
            translateY.value = withSpring(0, SNAP_SPRING);
          }
        }),
    [handleDismiss, cleanup],
  );

  /* ─── Data (uses module-level cache) ────────────────── */

  // Base sorted list from cache — O(1) when catalog hasn't changed
  const baseSorted = getCachedSorted(catalogMap, aliasMap, prevMap);

  // Reset API results when search text changes
  useEffect(() => {
    setShowApiResults(false);
    setApiResults([]);
  }, [debouncedSearch]);

  // Muscle filter — maps granular muscles to main groups
  const sortedEntries = useMemo(() => {
    if (!selectedMuscle) return baseSorted;
    return baseSorted.filter((e) =>
      e.primary_muscles.some((m) => getMainGroup(m) === selectedMuscle),
    );
  }, [baseSorted, selectedMuscle]);

  const localExercises = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return sortedEntries;

    const scored = sortedEntries
      .map((e) => ({
        ...e,
        score: scoreExercise(e, q) + (e.done ? 10 : 0),
      }))
      .filter((e) => e.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [sortedEntries, debouncedSearch]);

  const exercises = showApiResults ? apiResults : localExercises;


  /* ─── Handlers ──────────────────────────────────────── */

  const handleReload = useCallback(async () => {
    if (!userId || reloading) return;
    setReloading(true);
    await fetchExerciseCatalog(userId, true);
    setReloading(false);
  }, [userId, reloading, fetchExerciseCatalog]);

  const searchApi = useCallback(async () => {
    const q = search.trim();
    if (!q || apiSearching) return;
    setApiSearching(true);
    try {
      const res = await fetch(`${WGER_SEARCH_URL}&term=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const suggestions: WgerSearchResult[] = json.suggestions || [];
      const mapped: CatalogEntry[] = suggestions.map((s) => {
        const d = s.data;
        const primary = d.muscles?.map((m) => WGER_MUSCLE_MAP[m.id] || '').filter(Boolean) || [];
        const secondary = d.muscles_secondary?.map((m) => WGER_MUSCLE_MAP[m.id] || '').filter(Boolean) || [];
        const category = d.category ? (WGER_CATEGORY_MAP[d.category.id] || d.category.name || 'Custom') : 'Custom';
        const isBw = d.equipment?.some((e) => WGER_BW_EQUIPMENT.has(e.id)) && d.equipment.length === 1;
        return {
          name: s.value,
          category,
          exercise_type: isBw ? 'bodyweight' : 'weighted',
          primary_muscles: primary,
          secondary_muscles: secondary,
          done: false,
        };
      });
      setApiResults(mapped);
      setShowApiResults(true);
    } catch {
      setApiResults([]);
      setShowApiResults(false);
      Alert.alert(
        'Deep Search Unavailable',
        'The exercise database is currently offline. Try again later or use the local search.',
      );
    } finally {
      setApiSearching(false);
    }
  }, [search, apiSearching]);

  const handleSelect = useCallback(
    async (name: string, category: string, exerciseType: string) => {
      // If selected from API results, auto-save as user exercise with muscle data
      if (showApiResults && userId) {
        const apiEntry = apiResults.find((e) => e.name === name);
        if (apiEntry && !catalogMap[name]) {
          try {
            await createUserExercise({
              userId,
              name: apiEntry.name,
              category: apiEntry.category || 'Custom',
              exerciseType: apiEntry.exercise_type,
              primaryMuscles: apiEntry.primary_muscles,
              secondaryMuscles: apiEntry.secondary_muscles,
              equipment: [],
            });
          } catch {
            // Duplicate or error — still allow selection, catalog lookup will handle it
          }
        }
      }
      onSelect(name, exerciseType, category);
      setSearch('');
      onClose();
    },
    [onSelect, onClose, showApiResults, apiResults, userId, catalogMap, createUserExercise],
  );

  const handleOpenCreateModal = useCallback(() => {
    setCreateModalVisible(true);
  }, []);

  const handleCreateSubmit = useCallback(
    async (data: {
      name: string;
      category: string;
      exerciseType: string;
      primaryMuscles: string[];
      secondaryMuscles: string[];
      equipment: string[];
    }) => {
      if (userId) {
        try {
          await createUserExercise({
            userId,
            name: data.name,
            category: data.category,
            exerciseType: data.exerciseType,
            primaryMuscles: data.primaryMuscles,
            secondaryMuscles: data.secondaryMuscles,
            equipment: data.equipment,
          });
        } catch (err: any) {
          const msg = err?.message || 'Unknown error';
          const isDuplicate = msg.includes('unique') || msg.includes('duplicate');
          Alert.alert(
            isDuplicate ? 'Exercise Already Exists' : 'Failed to Create Exercise',
            isDuplicate
              ? 'An exercise with a similar name already exists.'
              : msg,
          );
          return;
        }
      }
      setCreateModalVisible(false);
      onSelect(data.name, data.exerciseType, data.category);
      setSearch('');
      onClose();
    },
    [userId, createUserExercise, onSelect, onClose],
  );

  /* ─── Render callbacks (memoized) ───────────────────── */

  const renderFlatItem = useCallback(
    ({ item }: { item: any }) => (
      <ExerciseRow
        name={item.name}
        category={item.category}
        exercise_type={item.exercise_type}
        primary_muscles={item.primary_muscles}
        onSelect={handleSelect}
        styles={styles}
      />
    ),
    [handleSelect, styles],
  );

  const keyExtractor = useCallback((item: any) => item.name, []);

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptySearch}>
        <Text style={styles.emptySearchText}>
          {showApiResults ? 'No online results found' : 'No exercises found'}
        </Text>
      </View>
    ),
    [styles, showApiResults],
  );

  /* ─── Render ────────────────────────────────────────── */

  if (!alive) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Backdrop */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          Keyboard.dismiss();
          onCloseRef.current();
        }}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      {/* Sheet — GPU rasterization during animation */}
      <Animated.View
        style={[styles.sheet, sheetStyle]}
        renderToHardwareTextureAndroid
      >
        <KeyboardAvoidingView
          style={styles.sheetInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? SCREEN_H * 0.2 : 0}
        >
          {/* Drag handle + header — always visible immediately */}
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {mode === 'replace' ? 'Replace Exercise' : 'Add Exercise'}
                </Text>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Search — always visible immediately (lightweight) */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={ms(18)} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus={false}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleReload}
              disabled={reloading}
              style={styles.reloadBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {reloading ? (
                <ActivityIndicator size={ms(18)} color={colors.accent} />
              ) : (
                <Ionicons name="refresh" size={ms(18)} color={colors.accent} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Content: always mounted to keep Fabric view tree stable ── */}
          <View style={{ flex: 1 }}>
            {/* Loading spinner — hidden once content is ready */}
            {!contentReady && (
              <View style={styles.deferredPlaceholder}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}

            {/* Muscle filter chips */}
            {contentReady && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                keyboardShouldPersistTaps="handled"
                style={styles.chipScroll}
              >
                <TouchableOpacity
                  style={[styles.chip, !selectedMuscle && styles.chipActive]}
                  onPress={() => setSelectedMuscle(null)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, !selectedMuscle && styles.chipTextActive]}>
                    All
                  </Text>
                </TouchableOpacity>
                {MAIN_MUSCLE_GROUPS.map((group) => {
                  const active = selectedMuscle === group;
                  const gColor = GROUP_CHIP_COLORS[group] || '#6B7280';
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[styles.chip, active && { backgroundColor: gColor + '25', borderColor: gColor }]}
                      onPress={() => setSelectedMuscle(active ? null : group)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.chipDot, { backgroundColor: gColor }]} />
                      <Text style={[styles.chipText, active && { color: gColor }]}>
                        {group}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Result count + Create */}
            {contentReady && (
              <View style={styles.subHeaderRow}>
                {showApiResults ? (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: sw(4) }}
                    onPress={() => { setShowApiResults(false); setApiResults([]); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={ms(14)} color={colors.accent} />
                    <Text style={[styles.resultCount, { color: colors.accent }]}>
                      Back to local · {apiResults.length} online result{apiResults.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                ) : search.trim().length > 0 || selectedMuscle ? (
                  <Text style={styles.resultCount}>
                    {exercises.length} result{exercises.length !== 1 ? 's' : ''}
                  </Text>
                ) : (
                  <View />
                )}
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleOpenCreateModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={ms(16)} color={colors.accent} />
                  <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Results */}
            {contentReady && (
              <FlatList
                data={exercises}
                keyExtractor={keyExtractor}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                renderItem={renderFlatItem}
                ListEmptyComponent={listEmptyComponent}
                initialNumToRender={20}
                maxToRenderPerBatch={15}
                windowSize={7}
                removeClippedSubviews={Platform.OS === 'android'}
              />
            )}
          </View>

          {/* Floating deep search button */}
          {contentReady && debouncedSearch.trim().length > 0 && !showApiResults && (
            <TouchableOpacity
              style={styles.searchOnlineFloating}
              onPress={searchApi}
              activeOpacity={0.7}
              disabled={apiSearching}
            >
              {apiSearching ? (
                <ActivityIndicator size={ms(16)} color={colors.textOnAccent} />
              ) : (
                <Ionicons name="globe-outline" size={ms(16)} color={colors.textOnAccent} />
              )}
              <Text style={styles.searchOnlineFloatingText}>
                {apiSearching ? 'Searching...' : 'Deep Search'}
              </Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </Animated.View>

      <CreateCustomExerciseModal
        visible={createModalVisible}
        initialName={search.trim()}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateSubmit}
      />
    </View>
    </GestureHandlerRootView>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_H,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      overflow: 'hidden',
    },
    sheetInner: {
      flex: 1,
      paddingBottom: sw(30),
    },
    handleZone: {
      alignItems: 'center',
      paddingTop: sw(12),
      paddingBottom: sw(4),
    },
    handle: {
      width: sw(40),
      height: sw(4),
      borderRadius: sw(2),
      backgroundColor: colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      paddingTop: sw(8),
      paddingBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      fontFamily: Fonts.bold,
      lineHeight: ms(25),
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: sw(16),
      borderRadius: 0,
      paddingHorizontal: sw(12),
      gap: sw(8),
      marginBottom: sw(8),
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
      paddingVertical: sw(10),
    },
    reloadBtn: {
      padding: sw(4),
    },
    chipScroll: {
      maxHeight: sw(32),
      minHeight: sw(32),
      marginHorizontal: sw(16),
      marginBottom: sw(4),
    },
    chipRow: {
      gap: sw(6),
      alignItems: 'center',
    },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: sw(5),
      paddingHorizontal: sw(10),
      paddingVertical: sw(4),
      borderRadius: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    chipDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: 0,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
    },
    chipTextActive: {
      color: colors.accent,
    },
    subHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      marginBottom: sw(6),
      marginTop: sw(6),
    },
    resultCount: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(16),
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    createBtnText: {
      color: colors.accent,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(18),
    },
    list: {
      flex: 1,
      paddingHorizontal: sw(16),
    },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(10),
      paddingHorizontal: sw(4),
      gap: sw(10),
    },
    catDot: {
      width: sw(8),
      height: sw(8),
      borderRadius: 0,
    },
    exerciseInfo: {
      flex: 1,
      gap: sw(1),
    },
    exerciseName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(19),
    },
    exerciseCat: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
    },
    emptySearch: {
      alignItems: 'center',
      paddingTop: sw(24),
      gap: sw(4),
    },
    emptySearchText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    deferredPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchOnlineFloating: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      marginHorizontal: sw(16),
      marginBottom: sw(4),
      paddingVertical: sw(10),
      backgroundColor: colors.accent,
      borderRadius: sw(10),
    },
    searchOnlineFloatingText: {
      color: colors.textOnAccent,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
    },
  });
