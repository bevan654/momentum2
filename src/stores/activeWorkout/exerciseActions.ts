/**
 * The active workout's exercise and set actions (add, remove, reorder, edit, supersets), split out of
 * useActiveWorkoutStore. The store spreads them in; `deps` gives them the two bits of module state
 * they need from the store file.
 */
import * as Haptics from 'expo-haptics';
import type { StoreApi } from 'zustand';
import { useWorkoutStore } from '../useWorkoutStore';
import { updateWorkoutActivity } from '../../services/liveActivityManager';
import { suggestSets } from '../../utils/exerciseProgress';
import { EMPTY_SET, EXERCISE_TYPE_CYCLE, SET_TYPE_CYCLE } from './constants';
import { _shiftAnchorForInsert } from './setHelpers';
import { _buildSnapshot } from './liveActivitySnapshot';
import type { ActiveSet, ActiveExercise, ActiveWorkoutState } from './types';

type ExerciseActionKeys = 'addExercise' | 'removeExercise' | 'replaceExercise' | 'moveExercise' | 'cycleExerciseType' | 'setExerciseNotes' | 'setExerciseNoteColor' | 'addSet' | 'addDropSet' | 'duplicateSet' | 'removeSet' | 'updateSet' | 'toggleSetComplete' | 'cycleSetType' | 'linkSuperset' | 'unlinkSuperset';

export function createExerciseActions(
  set: StoreApi<ActiveWorkoutState>['setState'],
  get: () => ActiveWorkoutState,
  { isFinishing, newExerciseId }: {
    /** True while the workout is being saved: edits then wouldn't be in the saved copy. */
    isFinishing: () => boolean;
    newExerciseId: () => string;
  },
): Pick<ActiveWorkoutState, ExerciseActionKeys> {
  /** Typing a weight or reps commits each keystroke; the Lock Screen catches up once typing pauses. */
  let setEditTimer: ReturnType<typeof setTimeout> | null = null;
  const SET_EDIT_ACTIVITY_DELAY_MS = 600;

  return {
    // ── Exercise management ───────────────────────────

    addExercise: (name, exerciseType, category, prevSets = []) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      const prevNotes = useWorkoutStore.getState().prevNoteMap[name] || undefined;
      set((s) => ({
        exercises: [
          ...s.exercises,
          {
            id: newExerciseId(),
            name,
            exercise_type: exerciseType as ActiveExercise['exercise_type'],
            category,
            sets: [{ ...EMPTY_SET }],
            prevSets,
            supersetWith: null,
            prevNotes,
          },
        ],
      }));
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    removeExercise: (index) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = s.exercises.filter((_, i) => i !== index);
        const a = s.restAnchor;
        const restAnchor = !a || a.exerciseIndex < index ? a
          : a.exerciseIndex === index ? null
          : { ...a, exerciseIndex: a.exerciseIndex - 1 };
        // Fix superset refs
        return {
          restAnchor,
          exercises: exercises.map((ex) => {
            let sw = ex.supersetWith;
            if (sw === null) return ex;
            if (sw === index) sw = null; // partner removed
            else if (sw > index) sw = sw - 1; // shift down
            return { ...ex, supersetWith: sw };
          }),
        };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    replaceExercise: (index, name, exerciseType, category, prevSets) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        exercises[index] = {
          ...exercises[index],
          id: newExerciseId(),
          name,
          exercise_type: exerciseType as ActiveExercise['exercise_type'],
          category,
          prevSets,
        };
        const restAnchor = s.restAnchor?.exerciseIndex === index ? null : s.restAnchor;
        return { exercises, restAnchor };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    moveExercise: (fromIndex, direction) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= s.exercises.length) return s;

        const exercises = [...s.exercises];
        [exercises[fromIndex], exercises[toIndex]] = [exercises[toIndex], exercises[fromIndex]];
        const a = s.restAnchor;
        const restAnchor = !a ? a
          : a.exerciseIndex === fromIndex ? { ...a, exerciseIndex: toIndex }
          : a.exerciseIndex === toIndex ? { ...a, exerciseIndex: fromIndex }
          : a;

        // Fix superset refs
        return {
          restAnchor,
          exercises: exercises.map((ex) => {
            let sw = ex.supersetWith;
            if (sw === null) return ex;
            if (sw === fromIndex) sw = toIndex;
            else if (sw === toIndex) sw = fromIndex;
            return { ...ex, supersetWith: sw };
          }),
        };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    cycleExerciseType: (index) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = exercises[index];
        exercises[index] = {
          ...ex,
          exercise_type: (EXERCISE_TYPE_CYCLE[ex.exercise_type] || 'weighted') as ActiveExercise['exercise_type'],
        };
        return { exercises };
      });
      get()._persist();
    },

    setExerciseNotes: (index, notes) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        if (!exercises[index]) return s;
        exercises[index] = { ...exercises[index], notes };
        return { exercises };
      });
      get()._persist();
    },

    setExerciseNoteColor: (index, color) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        if (!exercises[index]) return s;
        exercises[index] = { ...exercises[index], noteColor: color };
        return { exercises };
      });
      get()._persist();
    },

    // ── Set management ────────────────────────────────

    addSet: (exerciseIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        ex.sets = [...ex.sets, { ...EMPTY_SET }];
        exercises[exerciseIndex] = ex;
        return { exercises };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    addDropSet: (exerciseIndex, parentSetIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const parentSetNumber = parentSetIndex + 1; // 1-indexed
        // Find insertion point: after the last consecutive drop child of this parent
        let insertAt = parentSetIndex + 1;
        while (
          insertAt < sets.length &&
          sets[insertAt].set_type === 'drop' &&
          sets[insertAt].parent_set_number === parentSetNumber
        ) {
          insertAt++;
        }
        const dropSet: ActiveSet = {
          kg: '',
          reps: '',
          completed: false,
          set_type: 'drop',
          parent_set_number: parentSetNumber,
        };
        sets.splice(insertAt, 0, dropSet);
        ex.sets = sets;
        exercises[exerciseIndex] = ex;
        return { exercises, restAnchor: _shiftAnchorForInsert(s.restAnchor, exerciseIndex, insertAt) };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    duplicateSet: (exerciseIndex, setIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const original = sets[setIndex];
        if (!original) return s;

        // For non-drop sets, insert AFTER any drop children so the drop chain stays contiguous.
        // For drop sets, insert immediately after (preserving the drop chain).
        let insertAt = setIndex + 1;
        if (original.set_type !== 'drop') {
          const parentNum = setIndex + 1;
          while (
            insertAt < sets.length &&
            sets[insertAt].set_type === 'drop' &&
            sets[insertAt].parent_set_number === parentNum
          ) {
            insertAt++;
          }
        }

        const dup: ActiveSet = {
          kg: original.kg,
          reps: original.reps,
          completed: false,
          set_type: original.set_type,
          parent_set_number: original.parent_set_number,
        };
        sets.splice(insertAt, 0, dup);

        // Bump parent_set_number for any drop sets whose parent index shifted by the insertion
        for (let i = insertAt + 1; i < sets.length; i++) {
          const cur = sets[i];
          if (cur.set_type === 'drop' && cur.parent_set_number != null && cur.parent_set_number >= insertAt + 1) {
            sets[i] = { ...cur, parent_set_number: cur.parent_set_number + 1 };
          }
        }

        ex.sets = sets;
        exercises[exerciseIndex] = ex;
        return { exercises, restAnchor: _shiftAnchorForInsert(s.restAnchor, exerciseIndex, insertAt) };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    removeSet: (exerciseIndex, setIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const oldSets = ex.sets;
        const deletedSet = oldSets[setIndex];

        // Build set of indices to remove
        const removeIndices = new Set<number>([setIndex]);
        if (deletedSet.set_type !== 'drop') {
          // Cascade-remove drop children of this parent
          const parentSetNumber = setIndex + 1;
          for (let i = 0; i < oldSets.length; i++) {
            if (oldSets[i].set_type === 'drop' && oldSets[i].parent_set_number === parentSetNumber) {
              removeIndices.add(i);
            }
          }
        }

        const newSets = oldSets.filter((_, i) => !removeIndices.has(i));
        if (newSets.length === 0) return s; // Keep at least one set

        // Reindex: map old 1-indexed positions to new for surviving non-drop sets
        const posMap = new Map<number, number>();
        let newPos = 0;
        for (let i = 0; i < oldSets.length; i++) {
          if (!removeIndices.has(i)) {
            newPos++;
            if (oldSets[i].set_type !== 'drop') {
              posMap.set(i + 1, newPos);
            }
          }
        }

        ex.sets = newSets.map((st) => {
          if (st.set_type === 'drop' && st.parent_set_number !== null) {
            const newParent = posMap.get(st.parent_set_number) ?? null;
            // Unchanged sets keep their identity (SetRow's swipe-delete finds its set by identity)
            return newParent === st.parent_set_number ? st : { ...st, parent_set_number: newParent };
          }
          return st;
        });

        exercises[exerciseIndex] = ex;
        let restAnchor = s.restAnchor;
        if (restAnchor && restAnchor.exerciseIndex === exerciseIndex) {
          if (removeIndices.has(restAnchor.setIndex)) restAnchor = null;
          else {
            let below = 0;
            removeIndices.forEach((i) => { if (i < restAnchor!.setIndex) below++; });
            restAnchor = { ...restAnchor, setIndex: restAnchor.setIndex - below };
          }
        }
        return { exercises, restAnchor };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    updateSet: (exerciseIndex, setIndex, field, value) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        sets[setIndex] = { ...sets[setIndex], [field]: value };
        ex.sets = sets;
        exercises[exerciseIndex] = ex;
        return { exercises };
      });
      get()._persist();
      // Weight × reps on the Lock Screen, once typing pauses. An edit that doesn't change
      // what's shown is skipped before it reaches native.
      if (setEditTimer) clearTimeout(setEditTimer);
      setEditTimer = setTimeout(() => {
        setEditTimer = null;
        if (get().isActive) updateWorkoutActivity(_buildSnapshot(get()));
      }, SET_EDIT_ACTIVITY_DELAY_MS);
    },

    toggleSetComplete: (exerciseIndex, setIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      const exercises = [...get().exercises];
      const ex = { ...exercises[exerciseIndex] };
      const sets = [...ex.sets];
      const wasCompleted = sets[setIndex].completed;

      // A set can only be completed once it has the required inputs:
      // reps for every type, plus kg for straight weighted exercises.
      if (!wasCompleted) {
        const cur = sets[setIndex];
        const needsKg = ex.exercise_type === 'weighted';
        if (cur.reps.trim() === '' || (needsKg && cur.kg.trim() === '')) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
      }
      if (wasCompleted) {
        sets[setIndex] = { ...sets[setIndex], completed: false, completedAt: null, target: null };
      } else {
        // What the set row was suggesting (the friend's set in ghost mode, else the progression hint)
        const ghostPrev = get().ghostUserName ? ex.prevSets[setIndex] : undefined;
        const suggested = ghostPrev ? null : suggestSets(ex.sets, ex.prevSets, ex.exercise_type)[setIndex];
        const target = ghostPrev
          ? { kg: ghostPrev.kg, reps: ghostPrev.reps, source: 'previous' as const }
          : suggested
            ? { kg: suggested.kg, reps: suggested.reps, source: 'progression' as const }
            : null;
        sets[setIndex] = { ...sets[setIndex], completed: true, completedAt: Date.now(), target };
      }
      ex.sets = sets;
      exercises[exerciseIndex] = ex;
      set({ exercises });

      if (!wasCompleted) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        set({ restAnchor: { exerciseIndex, setIndex } });
        get().startRest(); // sends the Lock Screen update: the ticked set and the rest together
      }

      get()._persist();
      if (wasCompleted) updateWorkoutActivity(_buildSnapshot(get()));
    },

    cycleSetType: (exerciseIndex, setIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const ex = { ...exercises[exerciseIndex] };
        const sets = [...ex.sets];
        const current = sets[setIndex].set_type;
        let next = (SET_TYPE_CYCLE[current] || 'working') as ActiveSet['set_type'];

        // When cycling to 'drop', find nearest preceding working set as parent
        let parentSetNumber: number | null = null;
        if (next === 'drop') {
          for (let i = setIndex - 1; i >= 0; i--) {
            if (sets[i].set_type === 'working' || sets[i].set_type === 'warmup' || sets[i].set_type === 'failure') {
              // Use the nearest non-drop set as parent (typically a working set)
              if (sets[i].set_type === 'working') {
                parentSetNumber = i + 1; // 1-indexed
                break;
              }
            }
          }
          // No valid parent found — skip 'drop', go to 'failure'
          if (parentSetNumber === null) {
            next = 'failure';
          }
        }

        sets[setIndex] = {
          ...sets[setIndex],
          set_type: next,
          parent_set_number: next === 'drop' ? parentSetNumber : null,
        };
        ex.sets = sets;
        exercises[exerciseIndex] = ex;
        return { exercises };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get())); // set-type label on the Lock Screen
    },

    // ── Superset ──────────────────────────────────────

    linkSuperset: (exerciseIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const nextIdx = exerciseIndex + 1;
        if (nextIdx >= s.exercises.length) return s;
        const exercises = [...s.exercises];

        // Clear any existing partners on either side before re-linking
        const existingA = exercises[exerciseIndex].supersetWith;
        if (existingA !== null && existingA !== nextIdx && exercises[existingA]) {
          exercises[existingA] = { ...exercises[existingA], supersetWith: null };
        }
        const existingB = exercises[nextIdx].supersetWith;
        if (existingB !== null && existingB !== exerciseIndex && exercises[existingB]) {
          exercises[existingB] = { ...exercises[existingB], supersetWith: null };
        }

        exercises[exerciseIndex] = { ...exercises[exerciseIndex], supersetWith: nextIdx };
        exercises[nextIdx] = { ...exercises[nextIdx], supersetWith: exerciseIndex };
        return { exercises };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    unlinkSuperset: (exerciseIndex) => {
      if (isFinishing()) return; // the workout is being saved; a change now wouldn't be in it
      set((s) => {
        const exercises = [...s.exercises];
        const partnerIdx = exercises[exerciseIndex].supersetWith;
        exercises[exerciseIndex] = { ...exercises[exerciseIndex], supersetWith: null };
        if (partnerIdx !== null && exercises[partnerIdx]) {
          exercises[partnerIdx] = { ...exercises[partnerIdx], supersetWith: null };
        }
        return { exercises };
      });
      get()._persist();
      updateWorkoutActivity(_buildSnapshot(get()));
    },

    // ── Rest timer ────────────────────────────────────
  };
}
