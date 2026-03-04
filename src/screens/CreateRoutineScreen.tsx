import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import ExerciseCard from '../components/workouts/ExerciseRow';
import ExercisePicker from '../components/workout-sheet/ExercisePicker';
import Body, { type ExtendedBodyPart } from '../components/BodyHighlighter';
import { useThemeStore } from '../stores/useThemeStore';
import { toSlug, ALL_SLUGS } from '../utils/muscleVolume';

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

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'CreateRoutine'>;

export default function CreateRoutineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const editRoutineId = route.params?.routineId;
  const userId = useAuthStore((s) => s.user?.id);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const updateRoutine = useRoutineStore((s) => s.updateRoutine);
  const editingRoutine = useRoutineStore((s) =>
    editRoutineId ? s.routines.find((r) => r.id === editRoutineId) : undefined
  );
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const themeMode = useThemeStore((s) => s.mode);
  const prevMap = useWorkoutStore((s) => s.prevMap);

  const isEditing = !!editRoutineId;

  const [routineName, setRoutineName] = useState(() =>
    editingRoutine?.name ?? ''
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(() =>
    editingRoutine?.days ?? []
  );
  const [exercises, setExercises] = useState<LocalExercise[]>(() => {
    if (!editingRoutine) return [];
    return editingRoutine.exercises.map((ex) => {
      const reps = ex.set_reps || Array(ex.default_sets).fill(ex.default_reps);
      const weights = ex.set_weights || Array(ex.default_sets).fill(0);
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const toggleDay = useCallback((index: number) => {
    setSelectedDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index].sort()
    );
  }, []);

  // Aggregate muscles across all exercises for summary body map
  const CATEGORY_SLUGS: Record<string, string[]> = {
    Chest: ['chest'], Back: ['upper-back', 'lower-back', 'trapezius'],
    Shoulders: ['deltoids', 'rear-deltoids'], Arms: ['biceps', 'triceps', 'forearm'],
    Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'], Core: ['abs', 'obliques'],
  };

  const summaryBodyData = useMemo(() => {
    const primaryHits: Record<string, number> = {};
    const secondaryHits: Record<string, number> = {};

    for (const ex of exercises) {
      const entry = catalogMap[ex.name];
      const primaries: string[] = [];
      const secondaries: string[] = [];

      if (entry) {
        for (const m of entry.primary_muscles) {
          const s = toSlug(m);
          if (s) primaries.push(s);
        }
        for (const m of entry.secondary_muscles) {
          const s = toSlug(m);
          if (s) secondaries.push(s);
        }
      }

      if (primaries.length === 0 && ex.category) {
        const slugs = CATEGORY_SLUGS[ex.category];
        if (slugs) primaries.push(...slugs);
      }

      for (const s of primaries) primaryHits[s] = (primaryHits[s] || 0) + 1;
      for (const s of secondaries) secondaryHits[s] = (secondaryHits[s] || 0) + 1;
    }

    const maxHits = Math.max(...Object.values(primaryHits), 1);

    return ALL_SLUGS.map((slug) => {
      const p = primaryHits[slug] || 0;
      const s = secondaryHits[slug] || 0;
      if (p > 0) {
        const intensity = 2 + Math.round((p / maxHits) * 4);
        return { slug, intensity: Math.min(intensity, 6) };
      }
      if (s > 0) return { slug, intensity: 2 };
      return { slug, intensity: 1 };
    }) as ExtendedBodyPart[];
  }, [exercises, catalogMap]);

  const summaryPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '60', a + '80', a + 'BB', a + 'DD', a];
    }
    return ['#E8E4DE', '#C8C4Be', a + '30', a + '50', a + '70', a + '90', a];
  }, [themeMode, colors.accent]);

  const hasAnyMuscles = exercises.length > 0;

  const handleAddExercise = useCallback((name: string, exerciseType: string, category: string | null) => {
    const prevMap = useWorkoutStore.getState().prevMap;
    const prevSets = prevMap[name] || [];
    const defaultReps = 10;
    const defaultSets: LocalSet[] = Array.from({ length: 3 }, (_, i) => ({
      goal_reps: defaultReps,
      goal_weight: prevSets[i]?.kg ?? 0,
    }));

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

  const handleSave = async () => {
    if (!routineName.trim()) {
      Alert.alert('Error', 'Enter a routine name');
      return;
    }
    if (!userId) return;

    setSaving(true);
    const routineExercises = exercises.map((e, i) => ({
      name: e.name,
      exercise_order: i + 1,
      default_sets: e.sets.length,
      default_reps: e.sets[0]?.goal_reps ?? 10,
      default_rest_seconds: e.rest_seconds,
      set_reps: e.sets.map((s) => s.goal_reps),
      set_weights: e.sets.map((s) => s.goal_weight),
      exercise_type: e.exercise_type || 'weighted',
    }));

    const { error } = isEditing
      ? await updateRoutine(userId, editRoutineId!, routineName.trim(), routineExercises, selectedDays)
      : await createRoutine(userId, routineName.trim(), routineExercises, selectedDays);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Routine' : 'New Routine'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Routine Name */}
          <Text style={styles.label}>Routine Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Push Day, Upper Body"
            placeholderTextColor={colors.textTertiary}
            value={routineName}
            onChangeText={setRoutineName}
          />

          {/* Days */}
          <Text style={styles.label}>Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day, i) => (
              <TouchableOpacity
                key={day}
                style={[styles.dayChip, selectedDays.includes(i) && styles.dayChipActive]}
                onPress={() => toggleDay(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayText, selectedDays.includes(i) && styles.dayTextActive]}>
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Muscle Summary */}
          <View style={styles.muscleSummary}>
              <Text style={styles.label}>Muscles Targeted</Text>
              <View style={styles.bodyMapRow}>
                <View style={styles.bodyMapSide}>
                  <Body
                    data={summaryBodyData}
                    side="front"
                    gender="male"
                    scale={0.4}
                    colors={summaryPalette}
                    border="none"
                    backColor={colors.cardBorder}
                  />
                  <Text style={styles.bodyMapLabel}>Front</Text>
                </View>
                <View style={styles.bodyMapSide}>
                  <Body
                    data={summaryBodyData}
                    side="back"
                    gender="male"
                    scale={0.4}
                    colors={summaryPalette}
                    border="none"
                    backColor={colors.cardBorder}
                  />
                  <Text style={styles.bodyMapLabel}>Back</Text>
                </View>
              </View>
          </View>

          {/* Exercise Tabs */}
          <Text style={styles.label}>Exercises</Text>
          <View style={styles.tabGrid}>
            {Array.from({ length: Math.max(10, exercises.length + 1) }, (_, i) => {
              const ex = exercises[i];
              return (
                <TouchableOpacity
                  key={`tab-${i}`}
                  style={[styles.tab, ex && styles.tabFilled, i === activeTab && (ex ? styles.tabActive : styles.tabSelectedEmpty)]}
                  onPress={() => setActiveTab(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabNumber, i === activeTab && ex && styles.tabTextActive]}>
                    {i + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Viewing area for selected box */}
          {exercises[activeTab] ? (
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
          ) : (
            <TouchableOpacity
              style={styles.emptySlotView}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={ms(24)} color={colors.textTertiary} />
              <Text style={styles.emptySlotText}>Add Exercise {activeTab + 1}</Text>
            </TouchableOpacity>
          )}

          {/* Bottom spacing for button */}
          <View style={{ height: sw(80) }} />
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.saveText}>{saving ? 'Saving...' : isEditing ? 'Update Routine' : 'Save Routine'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelect={handleAddExercise}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: sw(16),
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    marginBottom: sw(6),
    marginTop: sw(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: sw(10),
    padding: sw(12),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  daysRow: {
    flexDirection: 'row',
    gap: sw(6),
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(10),
    borderRadius: 0,
    backgroundColor: colors.card,
  },
  dayChipActive: {
    backgroundColor: colors.accent,
  },
  dayText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  dayTextActive: {
    color: colors.textOnAccent,
  },
  muscleSummary: {
    marginTop: sw(4),
  },
  bodyMapRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(16),
  },
  bodyMapSide: {
    alignItems: 'center',
    gap: sw(4),
  },
  bodyMapLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabGrid: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(10),
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    gap: sw(4),
  },
  tab: {
    flex: 1,
    height: sw(38),
    borderRadius: 0,
    backgroundColor: colors.card,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabFilled: {
    borderBottomColor: '#FFFFFF',
    borderBottomWidth: 2,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabNumber: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  tabTextActive: {
    color: colors.textOnAccent,
  },
  tabLabel: {
    color: colors.textSecondary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    lineHeight: ms(10),
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.accent,
    fontFamily: Fonts.semiBold,
  },
  tabAddText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    lineHeight: ms(10),
  },
  tabEmpty: {
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  tabSelectedEmpty: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  emptySlotView: {
    paddingVertical: sw(32),
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
  },
  emptySlotText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sw(16),
    paddingTop: sw(12),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
});
