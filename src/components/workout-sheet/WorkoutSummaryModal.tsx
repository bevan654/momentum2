import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Modal, ScrollView, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getMuscleGroupColor } from '../../constants/muscleGroups';
import MuscleHeatmap from '../body/MuscleHeatmap';
import RankBadge from '../workouts/RankBadge';
import { AnimatedRankBar, AnimatedCardWrapper, OverallRankReveal } from './ExerciseRankReveal';
import Confetti from './Confetti';
import DurationPickerModal from './DurationPickerModal';
import { computeWorkoutRank, type WorkoutRankResult } from '../../utils/strengthScore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useWeightStore } from '../../stores/useWeightStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../lib/supabase';
import type { WorkoutSummary, SummaryExercise } from '../../stores/useActiveWorkoutStore';
import type { WorkoutWithDetails, ExerciseWithSets } from '../../stores/useWorkoutStore';
import ShareWorkoutModal from './ShareWorkoutModal';
import type { WorkoutOverlayData } from '../dev/WorkoutOverlay';

// ── Edit-mode types ──────────────────────────────────

type EditSet = { kg: string; reps: string; completed: boolean; set_type: string };
type EditExercise = { name: string; category: string | null; sets: EditSet[] };

type Props = {
  onDismiss: () => void;
  onDelete?: () => void;
} & (
  | { mode: 'just-completed'; data: WorkoutSummary }
  | { mode: 'historical'; data: WorkoutWithDetails }
);

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return `${kg.toLocaleString()} kg`;
}

function formatWorkoutDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

function ExerciseDetailSection({ exercise, colors, styles, rankResult }: { exercise: ExerciseWithSets; colors: ThemeColors; styles: ReturnType<typeof createStyles>; rankResult: WorkoutRankResult | null }) {
  const catColor = exercise.category ? getMuscleGroupColor(exercise.category) : colors.textTertiary;
  const completedCount = exercise.sets.filter((s) => s.completed).length;

  return (
    <View style={styles.exerciseDetail}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
        {rankResult?.exerciseScores[exercise.name] && (
          <View style={{ marginLeft: sw(4) }}>
            <RankBadge rank={rankResult.exerciseScores[exercise.name].rank} />
          </View>
        )}
        {exercise.hasPR && (
          <Ionicons name="trophy" size={ms(10)} color={colors.accentOrange} style={{ marginLeft: sw(4) }} />
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.completedCount}>{completedCount} sets</Text>
      </View>
    </View>
  );
}

function SummaryExerciseSection({ exercise, colors, styles, rankResult, animateIndex }: { exercise: SummaryExercise; colors: ThemeColors; styles: ReturnType<typeof createStyles>; rankResult: WorkoutRankResult | null; animateIndex?: number }) {
  const catColor = exercise.category ? getMuscleGroupColor(exercise.category) : colors.textTertiary;
  const completedCount = exercise.sets.filter((s) => s.completed).length;
  const scoreEntry = rankResult?.exerciseScores[exercise.name];
  const shouldAnimate = animateIndex != null && scoreEntry && scoreEntry.score > 0;

  const card = (
    <View style={styles.exerciseDetail}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
        {!shouldAnimate && scoreEntry && (
          <View style={{ marginLeft: sw(4) }}>
            <RankBadge rank={scoreEntry.rank} />
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.completedCount}>{completedCount} sets</Text>
      </View>

      {shouldAnimate && (
        <AnimatedRankBar entry={scoreEntry} animateIndex={animateIndex} colors={colors} />
      )}
    </View>
  );

  if (shouldAnimate) {
    return <AnimatedCardWrapper animateIndex={animateIndex}>{card}</AnimatedCardWrapper>;
  }

  return card;
}

// ── Editable exercise section ────────────────────────

function EditableExerciseSection({
  exercise,
  exIdx,
  canRemove,
  colors,
  styles,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
}: {
  exercise: EditExercise;
  exIdx: number;
  canRemove: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'kg' | 'reps', value: string) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveExercise: (exIdx: number) => void;
}) {
  const catColor = exercise.category ? getMuscleGroupColor(exercise.category) : colors.textTertiary;

  const SET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    warmup: { label: 'W', color: colors.accentOrange },
    drop: { label: 'D', color: colors.accentPink },
    failure: { label: 'F', color: colors.accentRed },
  };

  return (
    <View style={styles.exerciseDetail}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ flex: 1 }} />
        {canRemove && (
          <TouchableOpacity style={styles.removeExerciseBtn} onPress={() => onRemoveExercise(exIdx)} activeOpacity={0.6}>
            <Ionicons name="close-circle" size={ms(16)} color={colors.accentRed} />
          </TouchableOpacity>
        )}
      </View>

      {/* Column headers */}
      <View style={styles.setRow}>
        <View style={styles.setNumCol}>
          <Text style={styles.editColHeader}>#</Text>
        </View>
        <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>kg</Text>
        <View style={{ width: sw(14) }} />
        <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>reps</Text>
        <View style={styles.setStatusCol} />
      </View>

      {exercise.sets.map((s, i) => {
        const typeConfig = SET_TYPE_CONFIG[s.set_type || ''];
        return (
          <View key={i} style={styles.setRow}>
            <View style={styles.setNumCol}>
              {typeConfig ? (
                <Text style={[styles.setTypeLabel, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              ) : (
                <Text style={styles.setNumber}>{i + 1}</Text>
              )}
            </View>
            <TextInput
              style={styles.editInput}
              value={s.kg}
              onChangeText={(v) => onUpdateSet(exIdx, i, 'kg', v)}
              keyboardType="decimal-pad"
              maxLength={6}
              selectTextOnFocus
              placeholderTextColor={colors.textTertiary}
              placeholder="0"
            />
            <Text style={styles.setTimes}>&times;</Text>
            <TextInput
              style={styles.editInput}
              value={s.reps}
              onChangeText={(v) => onUpdateSet(exIdx, i, 'reps', v)}
              keyboardType="number-pad"
              maxLength={4}
              selectTextOnFocus
              placeholderTextColor={colors.textTertiary}
              placeholder="0"
            />
            <View style={styles.setStatusCol}>
              {exercise.sets.length > 1 ? (
                <TouchableOpacity onPress={() => onRemoveSet(exIdx, i)} activeOpacity={0.6}>
                  <Ionicons name="close" size={ms(12)} color={colors.accentRed + '90'} />
                </TouchableOpacity>
              ) : (
                <View style={styles.incompleteDot} />
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={() => onAddSet(exIdx)} activeOpacity={0.7}>
        <Ionicons name="add" size={ms(12)} color={colors.accent} />
        <Text style={styles.addSetBtnText}>Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

function AnimatedCheckmark({ colors, styles }: { colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 220 }));

    const t = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.checkCircle, animStyle]}>
      <Ionicons name="checkmark" size={ms(28)} color={colors.textOnAccent} />
    </Animated.View>
  );
}

export default function WorkoutSummaryModal(props: Props) {
  const { mode, data, onDismiss, onDelete } = props;
  const isJustCompleted = mode === 'just-completed';
  const [deleting, setDeleting] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Edit state ───────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editExercises, setEditExercises] = useState<EditExercise[]>([]);
  const [editDuration, setEditDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);

  // Share modal + workout name
  const [showShare, setShowShare] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  // Local overrides after save so display updates without re-fetch
  const [savedDuration, setSavedDuration] = useState<number | null>(null);
  const [savedExercises, setSavedExercises] = useState<SummaryExercise[] | null>(null);

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            onDelete?.();
          },
        },
      ],
    );
  };

  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const bodyweight = useWeightStore((s) => s.current) ?? 70;
  const userId = useAuthStore((s) => s.user?.id);

  // Resolve workout ID
  const workoutId = isJustCompleted
    ? (data as WorkoutSummary).workoutId
    : (data as WorkoutWithDetails).id;

  // Use saved overrides if available, otherwise use original data
  const displayDuration = savedDuration ?? data.duration;
  const totalVolume = isJustCompleted ? data.totalVolume : data.totalVolume;

  const displayExercises: SummaryExercise[] | null = savedExercises ?? (
    isJustCompleted ? (data as WorkoutSummary).exercises : null
  );

  const totalExercises = savedExercises
    ? savedExercises.length
    : (isJustCompleted ? data.totalExercises : (data as WorkoutWithDetails).total_exercises);
  const totalSets = savedExercises
    ? savedExercises.reduce((n, ex) => n + ex.sets.length, 0)
    : (isJustCompleted ? data.totalSets : (data as WorkoutWithDetails).completedSets);

  const displayVolume = savedExercises
    ? Math.round(savedExercises.reduce((v, ex) => v + ex.sets.reduce((sv, s) => sv + s.kg * s.reps, 0), 0))
    : totalVolume;

  const prCount = data.prCount;

  // Defer rank computation so it doesn't block the first render frame
  const [rankResult, setRankResult] = useState<WorkoutRankResult | null>(null);
  const rankDepsRef = useRef({ data, bodyweight, catalogMap, isJustCompleted, displayExercises });
  rankDepsRef.current = { data, bodyweight, catalogMap, isJustCompleted, displayExercises };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const { data: d, bodyweight: bw, catalogMap: cm, isJustCompleted: jc, displayExercises: de } = rankDepsRef.current;
      const exercises = jc
        ? (de ?? (d as WorkoutSummary).exercises).map((ex) => ({
            name: ex.name,
            exercise_type: cm[ex.name]?.exercise_type || 'weighted',
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed })),
          }))
        : (d as WorkoutWithDetails).exercises.map((ex) => ({
            name: ex.name,
            exercise_type: ex.exercise_type,
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed })),
          }));
      if (exercises.length === 0) { setRankResult(null); return; }
      setRankResult(computeWorkoutRank({ exercises, bodyweight: bw, catalog: cm }));
    });
    return () => cancelAnimationFrame(id);
  }, [data, bodyweight, catalogMap, isJustCompleted, displayExercises]);

  // ── Edit handlers ────────────────────────────────

  const startEditing = useCallback(() => {
    let exercises: EditExercise[];
    if (isJustCompleted) {
      const src = displayExercises ?? (data as WorkoutSummary).exercises;
      exercises = src.map((ex) => ({
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: s.set_type,
        })),
      }));
    } else {
      exercises = (data as WorkoutWithDetails).exercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: s.set_type || 'working',
        })),
      }));
    }
    setEditExercises(exercises);
    setEditDuration(displayDuration);
    setEditing(true);
  }, [data, isJustCompleted, displayDuration, displayExercises]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditExercises([]);
  }, []);

  const updateEditSet = useCallback((exIdx: number, setIdx: number, field: 'kg' | 'reps', value: string) => {
    setEditExercises((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, [field]: value } : s)),
        };
      });
      return next;
    });
  }, []);

  const removeEditSet = useCallback((exIdx: number, setIdx: number) => {
    setEditExercises((prev) => prev.map((ex, ei) => {
      if (ei !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    }));
  }, []);

  const addEditSet = useCallback((exIdx: number) => {
    setEditExercises((prev) => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      return { ...ex, sets: [...ex.sets, { kg: '', reps: '', completed: true, set_type: 'working' }] };
    }));
  }, []);

  const removeEditExercise = useCallback((exIdx: number) => {
    setEditExercises((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== exIdx);
    });
  }, []);

  const saveEdits = useCallback(async () => {
    if (!workoutId || !userId) return;
    setSaving(true);

    try {
      // Filter out empty sets
      const cleanedExercises = editExercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.kg.trim() !== '' || s.reps.trim() !== ''),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (cleanedExercises.length === 0) {
        Alert.alert('Error', 'At least one exercise with valid sets is required.');
        setSaving(false);
        return;
      }

      const newTotalSets = cleanedExercises.reduce((n, ex) => n + ex.sets.length, 0);

      // 1. Update workout row
      const { error: wErr } = await supabase
        .from('workouts')
        .update({
          duration: editDuration,
          total_exercises: cleanedExercises.length,
          total_sets: newTotalSets,
        })
        .eq('id', workoutId);

      if (wErr) throw wErr;

      // 2. Delete existing exercises (sets cascade via FK)
      const { error: delErr } = await supabase
        .from('exercises')
        .delete()
        .eq('workout_id', workoutId);

      if (delErr) throw delErr;

      // 3. Re-insert exercises + sets
      for (let i = 0; i < cleanedExercises.length; i++) {
        const ex = cleanedExercises[i];
        const exerciseType = catalogMap[ex.name]?.exercise_type || 'weighted';

        const { data: exData, error: exErr } = await supabase
          .from('exercises')
          .insert({
            workout_id: workoutId,
            name: ex.name,
            exercise_order: i + 1,
            exercise_type: exerciseType,
          })
          .select('id')
          .single();

        if (exErr || !exData) continue;

        const setRows = ex.sets.map((s, j) => ({
          exercise_id: exData.id,
          set_number: j + 1,
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
        }));

        if (setRows.length > 0) {
          await supabase.from('sets').insert(setRows);
        }
      }

      // 4. Update activity_feed
      const newVolume = Math.round(
        cleanedExercises.reduce((v, ex) =>
          v + ex.sets.reduce((sv, s) => sv + (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0), 0), 0)
      );
      const exerciseNames = cleanedExercises.map((ex) => ex.name);

      await supabase
        .from('activity_feed')
        .update({
          duration: editDuration,
          total_volume: newVolume,
          exercise_names: exerciseNames,
          total_exercises: cleanedExercises.length,
          total_sets: newTotalSets,
        })
        .eq('workout_id', workoutId);

      // 5. Build display overrides
      const newSummaryExercises: SummaryExercise[] = cleanedExercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        sets: ex.sets.map((s) => ({
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
        })),
      }));

      setSavedDuration(editDuration);
      setSavedExercises(newSummaryExercises);

      // 6. Refresh workout history cache
      fetchWorkoutHistory(userId).catch(() => {});

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [workoutId, userId, editExercises, editDuration, catalogMap, fetchWorkoutHistory]);

  const handleDurationConfirm = useCallback((seconds: number) => {
    setEditDuration(seconds);
    setDurationPickerVisible(false);
  }, []);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={editing ? undefined : onDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={styles.modal}>
          {/* Confetti burst (just-completed only, hidden in edit mode) */}
          {isJustCompleted && !editing && <Confetti />}

          {/* Close button (hidden in edit mode) */}
          {!editing && (
            <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.6}>
              <Ionicons name="close" size={ms(18)} color={colors.textTertiary} />
            </TouchableOpacity>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            {editing ? (
              <View style={styles.header}>
                <Text style={styles.title}>Edit Workout</Text>
              </View>
            ) : isJustCompleted ? (
              <View style={styles.header}>
                <AnimatedCheckmark colors={colors} styles={styles} />
                <Text style={styles.title}>Workout Complete!</Text>
                <TextInput
                  style={styles.workoutNameInput}
                  value={workoutName}
                  onChangeText={setWorkoutName}
                  placeholder="Name this workout..."
                  placeholderTextColor={colors.textTertiary}
                  maxLength={40}
                  returnKeyType="done"
                />
              </View>
            ) : (
              <View style={styles.header}>
                <Text style={styles.title}>Workout Summary</Text>
                <Text style={styles.dateSubtitle}>
                  {formatWorkoutDate((data as WorkoutWithDetails).created_at)}
                </Text>
              </View>
            )}

            {/* Rank + PR row (hidden in edit mode) */}
            {!editing && (rankResult || prCount > 0) && (
              <View style={styles.tagRow}>
                {rankResult && <RankBadge rank={rankResult.rank} size="normal" />}
                {prCount > 0 && (
                  <View style={styles.prBadge}>
                    <Ionicons name="trophy" size={ms(11)} color={colors.accentOrange} />
                    <Text style={styles.prBadgeText}>{prCount} PR{prCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Stats row */}
            {editing ? (
              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statItem} onPress={() => setDurationPickerVisible(true)} activeOpacity={0.7}>
                  <Text style={styles.statValue}>{formatDuration(editDuration)}</Text>
                  <Text style={styles.durationEditHint}>tap to edit</Text>
                </TouchableOpacity>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{editExercises.length}</Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{editExercises.reduce((n, ex) => n + ex.sets.length, 0)}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
              </View>
            ) : (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatDuration(displayDuration)}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{formatVolume(displayVolume)}</Text>
                  <Text style={styles.statLabel}>Volume</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalExercises}</Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{totalSets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
              </View>
            )}

            {/* Muscle heatmap (non-edit only) */}
            {!editing && isJustCompleted && (displayExercises ?? (data as WorkoutSummary).exercises).length > 0 && (
              <MuscleHeatmap exercises={(displayExercises ?? (data as WorkoutSummary).exercises) as any} embedded />
            )}
            {!editing && !isJustCompleted && (data as WorkoutWithDetails).exercises.length > 0 && (
              <MuscleHeatmap exercises={(data as WorkoutWithDetails).exercises} embedded />
            )}

            {/* Exercise sections */}
            {editing ? (
              <View style={styles.exerciseDetailList}>
                {editExercises.map((ex, i) => (
                  <EditableExerciseSection
                    key={i}
                    exercise={ex}
                    exIdx={i}
                    canRemove={editExercises.length > 1}
                    colors={colors}
                    styles={styles}
                    onUpdateSet={updateEditSet}
                    onRemoveSet={removeEditSet}
                    onAddSet={addEditSet}
                    onRemoveExercise={removeEditExercise}
                  />
                ))}
              </View>
            ) : isJustCompleted ? (
              <View style={styles.exerciseDetailList}>
                {(displayExercises ?? (data as WorkoutSummary).exercises).map((ex, i) => (
                  <SummaryExerciseSection key={i} exercise={ex} colors={colors} styles={styles} rankResult={rankResult} animateIndex={rankResult ? i : undefined} />
                ))}
                {rankResult && Object.keys(rankResult.exerciseScores).length > 0 && (
                  <OverallRankReveal
                    exerciseCount={(displayExercises ?? (data as WorkoutSummary).exercises).filter((ex) => rankResult.exerciseScores[ex.name]?.score > 0).length}
                    colors={colors}
                  />
                )}
              </View>
            ) : (
              <View style={styles.exerciseDetailList}>
                {(data as WorkoutWithDetails).exercises.map((ex) => (
                  <ExerciseDetailSection key={ex.id} exercise={ex} colors={colors} styles={styles} rankResult={rankResult} />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer buttons */}
          {editing ? (
            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditing} activeOpacity={0.7} disabled={saving}>
                <Text style={styles.cancelEditBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveEditBtn} onPress={saveEdits} activeOpacity={0.7} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.saveEditBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.footerRow}>
              {!isJustCompleted && onDelete && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                  disabled={deleting}
                >
                  <Ionicons name="trash-outline" size={ms(16)} color={colors.accentRed} />
                </TouchableOpacity>
              )}
              {isJustCompleted ? (
                <>
                  {workoutId && (
                    <TouchableOpacity style={styles.smallIconBtn} onPress={startEditing} activeOpacity={0.7}>
                      <Ionicons name="pencil" size={ms(16)} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.shareBtnMain} onPress={() => setShowShare(true)} activeOpacity={0.7}>
                    <Ionicons name="share-outline" size={ms(18)} color={colors.textOnAccent} />
                    <Text style={styles.shareBtnMainText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smallIconBtn} onPress={onDismiss} activeOpacity={0.7}>
                    <Ionicons name="checkmark" size={ms(18)} color={colors.accentGreen} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {workoutId && (
                    <TouchableOpacity style={styles.editBtn} onPress={startEditing} activeOpacity={0.7}>
                      <Ionicons name="pencil" size={ms(16)} color={colors.accent} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.shareBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
                    <Ionicons name="share-outline" size={ms(16)} color={colors.accentGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={onDismiss}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneBtnText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Duration picker modal (edit mode) */}
      {durationPickerVisible && (
        <DurationPickerModal
          visible
          onConfirm={handleDurationConfirm}
          onCancel={() => setDurationPickerVisible(false)}
        />
      )}

      {/* Share workout modal */}
      {showShare && (
        <ShareWorkoutModal
          visible={showShare}
          data={{
            exercises: displayExercises ?? (
              isJustCompleted
                ? (data as WorkoutSummary).exercises
                : (data as WorkoutWithDetails).exercises.map((ex) => ({
                    name: ex.name,
                    category: ex.category,
                    sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type })),
                  }))
            ),
            duration: displayDuration,
            date: isJustCompleted ? new Date() : new Date((data as WorkoutWithDetails).created_at),
            workoutName: workoutName.trim() || null,
            catalogMap,
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(18),
    padding: sw(16),
    width: '90%',
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeBtn: {
    position: 'absolute',
    top: sw(12),
    right: sw(12),
    zIndex: 10,
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: sw(4),
  },

  /* -- Header -------------------------------- */
  header: {
    alignItems: 'center',
    marginBottom: sw(12),
    marginTop: sw(4),
    gap: sw(6),
  },
  checkCircle: {
    width: sw(46),
    height: sw(46),
    borderRadius: sw(23),
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(24),
  },
  dateSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    marginTop: sw(-2),
  },
  workoutNameInput: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(8),
    paddingHorizontal: sw(16),
    alignSelf: 'stretch',
    marginTop: sw(4),
  },

  /* -- Tags (PR + muscle pills) -------------- */
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(12),
    zIndex: 2,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange + '18',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
    gap: sw(4),
  },
  prBadgeText: {
    color: colors.accentOrange,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  musclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
    gap: sw(4),
  },
  muscleDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
  },
  muscleText: {
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },

  /* -- Stats row ----------------------------- */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    paddingVertical: sw(10),
    marginBottom: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(2),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(24),
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(21),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },

  /* -- Exercise pills (just-completed) ------- */
  exerciseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(8),
  },
  exercisePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    borderRadius: sw(8),
  },
  exercisePillText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },

  /* -- Exercise detail (historical) ---------- */
  exerciseDetailList: {
    width: '100%',
    gap: sw(8),
    marginBottom: sw(8),
  },
  exerciseDetail: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(8),
    paddingHorizontal: sw(10),
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(6),
  },
  catStrip: {
    width: sw(3),
    height: sw(14),
    borderRadius: sw(2),
    marginRight: sw(8),
  },
  exerciseDetailName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  completedCount: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },

  /* -- Set rows ------------------------------ */
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(4),
    borderRadius: sw(4),
  },
  setRowPR: {
    backgroundColor: colors.accentOrange + '10',
  },
  setNumCol: {
    width: sw(22),
    alignItems: 'center',
  },
  setNumber: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  setTypeLabel: {
    fontSize: ms(11),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(15),
  },
  setText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    flex: 1,
    textAlign: 'center',
  },
  setTimes: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
    marginHorizontal: sw(2),
  },
  setStatusCol: {
    width: sw(20),
    alignItems: 'center',
  },
  incompleteDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.textTertiary + '40',
  },

  /* -- Edit mode inputs ---------------------- */
  editInput: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    textAlign: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(6),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: sw(28),
  },
  editColHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
  removeExerciseBtn: {
    padding: sw(4),
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(4),
    paddingVertical: sw(6),
    marginTop: sw(4),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderStyle: 'dashed',
  },
  addSetBtnText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },
  durationEditHint: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },

  /* -- Footer buttons ------------------------ */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(6),
  },
  deleteBtn: {
    width: sw(44),
    height: sw(44),
    borderRadius: sw(10),
    backgroundColor: colors.accentRed + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    width: sw(44),
    height: sw(44),
    borderRadius: sw(10),
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: sw(44),
    height: sw(44),
    borderRadius: sw(10),
    backgroundColor: colors.accentGreen + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallIconBtn: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.accentGreen,
    borderRadius: sw(10),
    paddingVertical: sw(12),
  },
  shareBtnMainText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  doneBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  doneBtnGreen: {
    backgroundColor: colors.accentGreen,
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  cancelEditBtnText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(21),
  },
  saveEditBtn: {
    flex: 1,
    backgroundColor: colors.accentGreen,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  saveEditBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
});
