import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { getDayEditInput, saveDayEdit, type ProgramDayExercise } from '../stores/useProgramStore';

import ExerciseCard from '../components/workouts/ExerciseRow';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

/* ─── Types ──────────────────────────────────────────── */

interface LocalSet {
  goal_reps: number;
  goal_weight: number;
}

interface LocalExercise {
  name: string;
  sets: LocalSet[];
  rest_seconds: number;
  category: string | null;
  exercise_type: string;
  prevSets: { kg: number; reps: number }[];
}

interface CatalogEntry {
  name: string;
  category: string;
  exercise_type: string;
  primary_muscles: string[];
}

const MUSCLE_FILTERS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quadriceps', 'hamstrings', 'glutes', 'calves', 'abs', 'traps',
];

/* ─── Helpers ────────────────────────────────────────── */

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

const MUSCLE_COLOR_MAP: Record<string, string> = {
  chest: '#EF4444',
  back: '#3B82F6',
  traps: '#3B82F6',
  shoulders: '#F59E0B',
  biceps: '#8B5CF6',
  triceps: '#8B5CF6',
  forearms: '#8B5CF6',
  quadriceps: '#34D399',
  hamstrings: '#34D399',
  glutes: '#34D399',
  calves: '#34D399',
  abs: '#F97316',
};

function muscleColor(muscle: string): string {
  return MUSCLE_COLOR_MAP[muscle] || '#6B7280';
}

/* ─── Memoised exercise row for inline list ──────────── */

const InlineExerciseRow = memo(function InlineExerciseRow({
  item,
  onSelect,
  colors,
}: {
  item: CatalogEntry;
  onSelect: (name: string, exerciseType: string, category: string) => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={inlineRowStyles.row}
      onPress={() => onSelect(item.name, item.exercise_type, item.category)}
      activeOpacity={0.6}
    >
      <View style={[inlineRowStyles.dot, { backgroundColor: muscleColor(item.primary_muscles[0] || '') }]} />
      <View style={inlineRowStyles.info}>
        <Text style={[inlineRowStyles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {titleCase(item.name)}
        </Text>
        <Text style={[inlineRowStyles.cat, { color: colors.textTertiary }]}>
          {item.primary_muscles.map(titleCase).join(', ') || titleCase(item.category || '')}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const inlineRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    paddingHorizontal: sw(4),
    gap: sw(10),
  },
  dot: {
    width: sw(8),
    height: sw(8),
    borderRadius: 0,
  },
  info: {
    flex: 1,
    gap: sw(1),
  },
  name: {
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(19),
  },
  cat: {
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
});

/* ─── Module-level sorted catalog cache ──────────────── */

let _sortedCache: CatalogEntry[] | null = null;
let _sortedRef: any = null;
let _sortedAliasRef: any = null;

function getSortedCatalog(
  catalogMap: Record<string, any>,
  aliasMap: Record<string, any>,
): CatalogEntry[] {
  if (catalogMap === _sortedRef && aliasMap === _sortedAliasRef && _sortedCache) return _sortedCache;
  _sortedRef = catalogMap;
  _sortedAliasRef = aliasMap;
  _sortedCache = Object.entries(catalogMap)
    .filter(([name]) => !aliasMap[name])
    .map(([name, entry]: [string, any]) => ({
      name,
      category: entry.category || '',
      exercise_type: entry.exercise_type || 'weighted',
      primary_muscles: Array.isArray(entry.primary_muscles) ? entry.primary_muscles.map((m: string) => m.toLowerCase()) : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return _sortedCache;
}

/* ─── Main screen ────────────────────────────────────── */

export default function ProgramDayEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const aliasMap = useWorkoutStore((s) => s.aliasMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);

  const input = getDayEditInput();
  const dayName = input?.dayName ?? 'Day';

  const [label, setLabel] = useState(() => input?.label ?? '');
  const [exercises, setExercises] = useState<LocalExercise[]>(() => {
    if (!input?.exercises.length) return [];
    return input.exercises.map((ex) => {
      const reps = ex.set_reps.length > 0 ? ex.set_reps : Array(ex.default_sets).fill(ex.default_reps);
      const weights = ex.set_weights.length > 0 ? ex.set_weights : Array(ex.default_sets).fill(0);
      const entry = catalogMap[ex.name];
      return {
        name: ex.name,
        sets: reps.map((r: number, i: number) => ({
          goal_reps: r,
          goal_weight: weights[i] ?? 0,
        })),
        rest_seconds: ex.default_rest_seconds,
        category: entry?.category ?? null,
        exercise_type: ex.exercise_type || 'weighted',
        prevSets: prevMap[ex.name] || [],
      };
    });
  });
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const hasExerciseAtTab = !!exercises[activeTab];

  /* ─── Inline catalog ──────────────────────────────── */

  const sorted = getSortedCatalog(catalogMap, aliasMap);

  const filtered = useMemo(() => {
    let list = sorted;
    if (selectedCategory) {
      list = list.filter((e) => e.primary_muscles.some((m) => m.includes(selectedCategory)));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return list.slice(0, 60);
  }, [sorted, search, selectedCategory]);

  /* ─── Exercise handlers ───────────────────────────── */

  const handleAddExercise = useCallback((name: string, exerciseType: string, category: string | null) => {
    const prev = useWorkoutStore.getState().prevMap;
    const prevSets = prev[name] || [];
    const defaultSets: LocalSet[] = Array.from({ length: 3 }, (_, i) => ({
      goal_reps: 10,
      goal_weight: prevSets[i]?.kg ?? 0,
    }));

    setSearch('');
    setExercises((prev) => {
      const next = [...prev, { name, sets: defaultSets, rest_seconds: 90, category, exercise_type: exerciseType, prevSets }];
      setActiveTab(next.length - 1);
      return next;
    });
  }, []);

  const handleAddSet = useCallback((exerciseIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex] };
      const last = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, { goal_reps: last?.goal_reps ?? 10, goal_weight: last?.goal_weight ?? 0 }];
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

  const handleRemoveSet = useCallback((exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex] };
      if (ex.sets.length <= 1) return prev;
      ex.sets = ex.sets.filter((_, i) => i !== setIndex);
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

  const handleSetRepsChange = useCallback((exerciseIndex: number, setIndex: number, reps: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex] };
      ex.sets = ex.sets.map((s, i) => (i === setIndex ? { ...s, goal_reps: reps } : s));
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

  const handleSetWeightChange = useCallback((exerciseIndex: number, setIndex: number, weight: number) => {
    setExercises((prev) => {
      const next = [...prev];
      const ex = { ...next[exerciseIndex] };
      ex.sets = ex.sets.map((s, i) => (i === setIndex ? { ...s, goal_weight: weight } : s));
      next[exerciseIndex] = ex;
      return next;
    });
  }, []);

  const handleRestChange = useCallback((exerciseIndex: number, seconds: number) => {
    setExercises((prev) => {
      const next = [...prev];
      next[exerciseIndex] = { ...next[exerciseIndex], rest_seconds: seconds };
      return next;
    });
  }, []);

  const handleRemove = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setExercises((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const programExercises: ProgramDayExercise[] = exercises.map((e, i) => ({
      name: e.name,
      exercise_order: i + 1,
      default_sets: e.sets.length,
      default_reps: e.sets[0]?.goal_reps ?? 10,
      default_rest_seconds: e.rest_seconds,
      set_reps: e.sets.map((s) => s.goal_reps),
      set_weights: e.sets.map((s) => s.goal_weight),
      exercise_type: e.exercise_type || 'weighted',
    }));
    saveDayEdit(label.trim() || 'Workout', programExercises);
    navigation.goBack();
  }, [exercises, label, navigation]);

  /* ─── Render ──────────────────────────────────────── */

  const renderCatalogItem = useCallback(
    ({ item }: { item: CatalogEntry }) => (
      <InlineExerciseRow item={item} onSelect={handleAddExercise} colors={colors} />
    ),
    [handleAddExercise, colors],
  );

  const keyExtractor = useCallback((item: CatalogEntry) => item.name, []);

  return (
    <Pressable style={styles.container} onPress={Keyboard.dismiss}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{dayName}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Label + Tabs — always visible at top */}
        <View style={styles.topSection}>
          <TextInput
            style={styles.input}
            placeholder="Workout label (e.g. Push, Pull, Legs)"
            placeholderTextColor={colors.textTertiary}
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.sectionLabel}>Choose Exercise</Text>

          <View style={styles.tabGrid}>
            {Array.from({ length: Math.max(10, exercises.length + 1) }, (_, i) => {
              const ex = exercises[i];
              return (
                <TouchableOpacity
                  key={`tab-${i}`}
                  style={[
                    styles.tab,
                    ex && styles.tabFilled,
                    i === activeTab && styles.tabActive,
                    i === exercises.length && !ex && styles.tabLast,
                  ]}
                  onPress={() => { setActiveTab(i); setSearch(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabNumber, i === activeTab && styles.tabTextActive]}>
                    {i + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content area: exercise card OR inline catalog */}
        {hasExerciseAtTab ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ExerciseCard
              key={`${exercises[activeTab].name}-${activeTab}`}
              name={exercises[activeTab].name}
              sets={exercises[activeTab].sets}
              restSeconds={exercises[activeTab].rest_seconds}
              category={exercises[activeTab].category}
              prevSets={exercises[activeTab].prevSets}
              onAddSet={() => handleAddSet(activeTab)}
              onRemoveSet={(setIndex) => handleRemoveSet(activeTab, setIndex)}
              onSetRepsChange={(setIndex, reps) => handleSetRepsChange(activeTab, setIndex, reps)}
              onSetWeightChange={(setIndex, weight) => handleSetWeightChange(activeTab, setIndex, weight)}
              onRestChange={(seconds) => handleRestChange(activeTab, seconds)}
              onRemove={() => {
                handleRemove(activeTab);
                setActiveTab((prev) => Math.max(0, Math.min(prev, exercises.length - 2)));
              }}
              onMoveUp={() => handleMoveUp(activeTab)}
              onMoveDown={() => handleMoveDown(activeTab)}
              isFirst={activeTab === 0}
              isLast={activeTab === exercises.length - 1}
            />
            <View style={{ height: sw(40) }} />
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            {/* Inline search */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={ms(16)} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={setSearch}
                autoFocus={exercises.length === 0}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={ms(16)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
              style={styles.chipScroll}
            >
              <TouchableOpacity
                style={[styles.chip, !selectedCategory && styles.chipActive]}
                onPress={() => setSelectedCategory(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text>
              </TouchableOpacity>
              {MUSCLE_FILTERS.map((muscle) => {
                const active = selectedCategory === muscle;
                const displayName = titleCase(muscle);
                const mColor = muscleColor(muscle);
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={[styles.chip, active && { backgroundColor: mColor + '25', borderColor: mColor }]}
                    onPress={() => setSelectedCategory(active ? null : muscle)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chipDot, { backgroundColor: mColor }]} />
                    <Text style={[styles.chipText, active && { color: mColor }]}>{displayName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Results */}
            <FlatList
              data={filtered}
              keyExtractor={keyExtractor}
              renderItem={renderCatalogItem}
              keyboardShouldPersistTaps="handled"
              style={styles.catalogList}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={5}
              ListEmptyComponent={
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>No exercises found</Text>
                </View>
              }
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </Pressable>
  );
}

/* ─── Styles ─────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  doneBtn: {
    paddingHorizontal: sw(8),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneText: {
    color: colors.accent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
  },

  // Top section (label + tabs)
  topSection: {
    paddingHorizontal: sw(16),
    gap: sw(10),
    paddingBottom: sw(6),
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textTertiary,
    padding: sw(12),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: sw(10),
  },
  tabGrid: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    height: sw(38),
    borderRadius: 0,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  tabFilled: {
    borderBottomColor: '#FFFFFF',
    borderBottomWidth: 2,
  },
  tabActive: {
    borderBottomColor: '#FFFFFF',
    borderBottomWidth: 2,
  },
  tabNumber: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabLast: {
    borderRightWidth: 0,
  },

  // Exercise card scroll area
  cardContent: {
    paddingHorizontal: sw(16),
    paddingTop: sw(8),
  },

  // Inline search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: sw(16),
    borderRadius: 0,
    paddingHorizontal: sw(12),
    gap: sw(8),
    marginTop: sw(6),
    marginBottom: sw(4),
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
    paddingVertical: sw(10),
  },

  // Category chips
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
    flexDirection: 'row',
    alignItems: 'center',
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

  // Catalog list
  catalogList: {
    flex: 1,
    paddingHorizontal: sw(16),
  },
  emptySearch: {
    alignItems: 'center',
    paddingTop: sw(24),
  },
  emptySearchText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
  },
});
