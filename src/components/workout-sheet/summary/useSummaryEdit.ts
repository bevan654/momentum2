import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import { useWorkoutStore, type WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import type { WorkoutSummary, SummaryExercise } from '../../../stores/useActiveWorkoutStore';
import { buildFeedExerciseDetails } from '../../../utils/feedExerciseDetails';
import type { EditExercise } from './summaryFormat';

/**
 * Edit mode of the workout summary: the editable copy of the exercises and duration,
 * the set/exercise edit handlers, and saving through upsert_workout (mode 'edit') plus
 * the matching activity_feed row. On save it hands the new values back through
 * setSavedDuration / setSavedExercises so the summary updates without a re-fetch.
 */
export function useSummaryEdit({
  data, isJustCompleted, workoutId, userId, displayDuration, displayExercises,
  setSavedDuration, setSavedExercises,
}: {
  data: WorkoutSummary | WorkoutWithDetails;
  isJustCompleted: boolean;
  workoutId: string | undefined;
  userId: string | undefined;
  displayDuration: number;
  displayExercises: SummaryExercise[] | null;
  setSavedDuration: (seconds: number) => void;
  setSavedExercises: (exercises: SummaryExercise[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editExercises, setEditExercises] = useState<EditExercise[]>([]);
  const [editDuration, setEditDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);

  const startEditing = useCallback(() => {
    let exercises: EditExercise[];
    if (isJustCompleted) {
      const src = displayExercises ?? (data as WorkoutSummary).exercises;
      exercises = src.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type,
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
        exercise_type: ex.exercise_type,
        origId: ex.id,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: s.set_type || 'working',
          origId: s.id,
          parentOrigId: s.parent_set_number != null
            ? ex.sets.find((p) => p.set_number === s.parent_set_number)?.id ?? null
            : null,
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

      // 1. Save in one transaction (upsert_workout, mode 'edit'). Rows keep their
      //    origId, so the set times, rest, targets, notes and supersets the editor
      //    doesn't show survive the edit.
      const { error: saveErr } = await supabase.rpc('upsert_workout', {
        p: {
          id: workoutId,
          mode: 'edit',
          duration: editDuration,
          total_exercises: cleanedExercises.length,
          total_sets: newTotalSets,
          exercises: cleanedExercises.map((ex) => ({
            name: ex.name,
            orig_id: ex.origId ?? null,
            // The exercise's own type; the catalog's only for an exercise added in the editor
            exercise_type: ex.exercise_type || catalogMap[ex.name]?.exercise_type || 'weighted',
            sets: ex.sets.map((s, j) => {
              const parentPos = s.parentOrigId ? ex.sets.findIndex((p) => p.origId === s.parentOrigId) : -1;
              return {
                set_number: j + 1,
                kg: parseFloat(s.kg) || 0,
                reps: parseInt(s.reps, 10) || 0,
                completed: s.completed,
                set_type: s.set_type,
                parent_set_number: parentPos >= 0 ? parentPos + 1 : null,
                orig_id: s.origId ?? null,
              };
            }),
          })),
        },
      });
      if (saveErr) throw saveErr;

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
          // The card's per-exercise rows and muscle maps come from this, so rebuild it too
          exercise_details: buildFeedExerciseDetails(
            cleanedExercises.map((ex) => ({
              name: ex.name,
              exercise_type: ex.exercise_type || catalogMap[ex.name]?.exercise_type || 'weighted',
              sets: ex.sets,
            })),
            catalogMap,
          ),
        })
        .eq('workout_id', workoutId);

      // 5. Build display overrides
      const newSummaryExercises: SummaryExercise[] = cleanedExercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type || 'weighted',
        sets: ex.sets.map((s) => ({
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
          parent_set_number: null,
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

  return {
    editing, editExercises, editDuration, setEditDuration, saving,
    startEditing, cancelEditing, updateEditSet, removeEditSet, addEditSet, removeEditExercise, saveEdits,
  };
}
