import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../lib/supabase';
import { useWorkoutStore, type WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import type { WorkoutSummary, SummaryExercise } from '../../../stores/useActiveWorkoutStore';
import { buildFeedExerciseDetails } from '../../../utils/feedExerciseDetails';
import type { EditExercise } from './summaryFormat';

/** A drop set's parent as a 1-based position in the edited sets, or null (not a drop set, or its parent was removed). */
function parentSetNumber(sets: EditExercise['sets'], set: EditExercise['sets'][number]): number | null {
  const parentPos = set.parentOrigId ? sets.findIndex((p) => p.origId === set.parentOrigId) : -1;
  return parentPos >= 0 ? parentPos + 1 : null;
}

type SavedRowExercise = {
  id: string;
  name: string;
  exercise_type: string | null;
  sets: {
    id: string; set_number: number; kg: number; reps: number; completed: boolean;
    set_type: string | null; parent_set_number: number | null;
  }[];
};

/** Saved rows in edit shape. Each row's id goes in origId, so upsert_workout keeps the fields the editor doesn't show. */
function toEditExercises(rows: SavedRowExercise[], categoryOf: (name: string) => string | null): EditExercise[] {
  return rows.map((ex) => {
    const sets = [...(ex.sets ?? [])].sort((a, b) => a.set_number - b.set_number);
    return {
      name: ex.name,
      category: categoryOf(ex.name),
      exercise_type: ex.exercise_type ?? undefined,
      origId: ex.id,
      sets: sets.map((s) => ({
        kg: String(Number(s.kg) || 0),
        reps: String(Number(s.reps) || 0),
        completed: s.completed,
        set_type: s.set_type || 'working',
        origId: s.id,
        parentOrigId: s.parent_set_number != null
          ? sets.find((p) => p.set_number === s.parent_set_number)?.id ?? null
          : null,
      })),
    };
  });
}

/** The workout's exercises and sets as saved now (the columns the history list loads), or null if that fails. */
async function loadSavedRows(workoutId: string): Promise<SavedRowExercise[] | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, exercise_order, exercise_type, sets(id, set_number, kg, reps, completed, set_type, parent_set_number)')
    .eq('workout_id', workoutId)
    .order('exercise_order', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return data as unknown as SavedRowExercise[];
}

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
  // A saved workout after Save: `data` (and its row ids) is the version from before,
  // because upsert_workout replaces the rows. Another edit has to start from the rows
  // as saved now, or it shows the old sets and saving puts them back.
  // `gen` drops a load that a newer save has overtaken.
  const savedRowsRef = useRef<{ stale: boolean; rows: EditExercise[] | null; gen: number }>({
    stale: false, rows: null, gen: 0,
  });

  const loadEditRows = useCallback(async (): Promise<EditExercise[] | null> => {
    if (!workoutId) return null;
    const gen = savedRowsRef.current.gen;
    const rows = await loadSavedRows(workoutId).catch(() => null);
    if (!rows || savedRowsRef.current.gen !== gen) return null;
    const edit = toEditExercises(rows, (name) => catalogMap[name]?.category || null);
    savedRowsRef.current.rows = edit;
    return edit;
  }, [workoutId, catalogMap]);

  const startEditing = useCallback(async () => {
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
    } else if (savedRowsRef.current.stale) {
      const fresh = savedRowsRef.current.rows ?? await loadEditRows();
      if (!fresh) {
        Alert.alert(
          'Couldn\'t Load Workout',
          'Your last edit is saved, but the workout couldn\'t be loaded again to edit. Check your connection and try again.',
        );
        return;
      }
      exercises = fresh;
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
  }, [data, isJustCompleted, displayDuration, displayExercises, loadEditRows]);

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
            sets: ex.sets.map((s, j) => ({
              set_number: j + 1,
              kg: parseFloat(s.kg) || 0,
              reps: parseInt(s.reps, 10) || 0,
              completed: s.completed,
              set_type: s.set_type,
              parent_set_number: parentSetNumber(ex.sets, s),
              orig_id: s.origId ?? null,
            })),
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

      // The workout is already saved: a failure here is reported, but doesn't undo the save.
      const { error: feedErr } = await supabase
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
          // Same link as the save, so drop sets keep their D1/D2 labels
          parent_set_number: parentSetNumber(ex.sets, s),
        })),
      }));

      setSavedDuration(editDuration);
      setSavedExercises(newSummaryExercises);

      // The rows were replaced: load them, with their new ids, for the next edit.
      if (!isJustCompleted) {
        savedRowsRef.current = { stale: true, rows: null, gen: savedRowsRef.current.gen + 1 };
        loadEditRows().catch(() => {});
      }

      // 6. Refresh workout history cache
      fetchWorkoutHistory(userId).catch(() => {});

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
      if (feedErr) {
        Alert.alert('Feed Not Updated', 'Your workout was saved, but its post in the feed still shows the old numbers.');
      }
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [workoutId, userId, editExercises, editDuration, catalogMap, fetchWorkoutHistory, isJustCompleted, loadEditRows]);

  return {
    editing, editExercises, editDuration, setEditDuration, saving,
    startEditing, cancelEditing, updateEditSet, removeEditSet, addEditSet, removeEditExercise, saveEdits,
  };
}
