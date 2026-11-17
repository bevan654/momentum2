import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost, type PortalHostHandle } from '../ui/Portal';
import { useLingerMount } from '../../hooks/useLingerMount';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MuscleHeatmap from '../body/MuscleHeatmap';
import DurationPickerModal from './DurationPickerModal';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import type { WorkoutSummary, SummaryExercise } from '../../stores/useActiveWorkoutStore';
import type { WorkoutWithDetails, CoachExerciseNote } from '../../stores/useWorkoutStore';
import ShareModal from '../share/ShareModal';
import WorkoutOverlay from '../share/WorkoutOverlay';
import CoachTakeCard, { type CoachResult } from './CoachTakeCard';
import { toSummaryExercises } from './summary/summaryFormat';
import { useSummaryEdit } from './summary/useSummaryEdit';
import { ExerciseResultCard } from './summary/SummaryExerciseCards';
import EditableExerciseSection from './summary/EditableExerciseSection';
import AnimatedCheckmark from './summary/AnimatedCheckmark';
import HistoricalPage from './summary/HistoricalPage';
import SummaryConfirmExit from './summary/SummaryConfirmExit';
import SharePreviewCard from './summary/SharePreviewCard';
import SummaryStats from './summary/SummaryStats';
import { SummaryEditFooter, SummaryCompletedFooter } from './summary/SummaryFooters';
import { useSummaryShare } from './summary/useSummaryShare';

type Props = {
  onDismiss: () => void;
  onDelete?: () => void;
  inline?: boolean;
} & (
  | { mode: 'just-completed'; data: WorkoutSummary }
  | { mode: 'historical'; data: WorkoutWithDetails }
);

export default function WorkoutSummaryModal(props: Props) {
  const { mode, data, onDismiss, onDelete, inline } = props;
  const isJustCompleted = mode === 'just-completed';
  const [deleting, setDeleting] = useState(false);
  const [coachResult, setCoachResult] = useState<CoachResult | null>(null);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Edit state ───────────────────────────────────
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const durationPickerMounted = useLingerMount(durationPickerVisible);

  // Share modal
  const [showShare, setShowShare] = useState(false);
  const shareMounted = useLingerMount(showShare);

  // Historical page: Android back closes an open share sheet / dialog first.
  const portalHostRef = useRef<PortalHostHandle>(null);

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

  const globalPrevMap = useWorkoutStore((s) => s.prevMap);
  const allWorkouts = useWorkoutStore((s) => s.workouts);
  const userId = useAuthStore((s) => s.user?.id);

  // For just-completed, use the snapshot captured at finish time (immune to background refetches).
  // For historical mode, compute prev sets from the session *before* this workout.
  const prevMap = useMemo(() => {
    if (isJustCompleted) return (data as WorkoutSummary).prevMap ?? globalPrevMap;
    const viewed = data as WorkoutWithDetails;
    const viewedDate = new Date(viewed.created_at).getTime();
    // Find workouts older than the viewed one, newest first (allWorkouts is already sorted desc)
    const older = allWorkouts.filter((w) => new Date(w.created_at).getTime() < viewedDate);
    const map: Record<string, { kg: number; reps: number }[]> = {};
    for (const w of older) {
      for (const ex of w.exercises) {
        if (map[ex.name]) continue;
        const sets = ex.sets
          .filter((s) => s.completed)
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }));
        if (sets.length > 0) map[ex.name] = sets;
      }
    }
    return map;
  }, [isJustCompleted, data, allWorkouts, globalPrevMap]);

  // Per-exercise coach notes, keyed by lowercase name — freshly generated for
  // just-completed (via CoachTakeCard's onResult), or read straight off the
  // persisted workout row for historical mode.
  const coachNotesByName = useMemo(() => {
    const map = new Map<string, CoachExerciseNote>();
    const source = isJustCompleted ? coachResult?.exercises : (data as WorkoutWithDetails).coachNotes;
    for (const n of source ?? []) map.set(n.name.toLowerCase(), n);
    return map;
  }, [isJustCompleted, coachResult, data]);

  // Resolve workout ID
  const workoutId = isJustCompleted
    ? (data as WorkoutSummary).workoutId
    : (data as WorkoutWithDetails).id;

  // ── Inline share-to-feed state + confirm-before-exit (just-completed only) ─────────
  const {
    sharePhotoUrl, sharePhotoUploading, shareVisibility, setShareVisibility, shareTextRef, shareSubmitting,
    handlePickSharePhoto, handleRemoveSharePhoto, handlePostToFeed,
    confirmExitVisible, handleCloseRequest, handleConfirmExitPost, handleConfirmExitDiscard, handleConfirmExitCancel,
  } = useSummaryShare({ isJustCompleted, workoutId, userId, onDismiss });

  // Use saved overrides if available, otherwise use original data
  const displayDuration = savedDuration ?? data.duration;
  const totalVolume = data.totalVolume;

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

  // The exercises in summary shape (saved edits, the finished workout, or the saved workout's rows).
  const summaryExercises = useMemo<SummaryExercise[]>(() => savedExercises ?? (
    isJustCompleted ? (data as WorkoutSummary).exercises : toSummaryExercises((data as WorkoutWithDetails).exercises)
  ), [savedExercises, data, isJustCompleted]);

  // Top set: heaviest weight used across all exercises
  const topSet = useMemo(() => {
    let bestKg = 0;
    let bestReps = 0;
    for (const ex of summaryExercises) {
      for (const s of ex.sets) {
        if (s.completed && s.kg > bestKg) {
          bestKg = s.kg;
          bestReps = s.reps;
        }
      }
    }
    return bestKg > 0 ? { kg: bestKg, reps: bestReps } : null;
  }, [summaryExercises]);

  // ── Edit mode: state, handlers and save (useSummaryEdit) ──
  const {
    editing, editExercises, editDuration, setEditDuration, saving,
    startEditing, cancelEditing, updateEditSet, removeEditSet, addEditSet, removeEditExercise, saveEdits,
  } = useSummaryEdit({
    data, isJustCompleted, workoutId, userId, displayDuration, displayExercises,
    setSavedDuration, setSavedExercises,
  });

  const handleDurationConfirm = useCallback((seconds: number) => {
    setEditDuration(seconds);
    setDurationPickerVisible(false);
  }, []);
  const openDurationPicker = useCallback(() => setDurationPickerVisible(true), []);

  /* ── Shared inner content ───────────────────────────── */

  const statsContent = (
    <SummaryStats
      editing={editing}
      editDuration={editDuration}
      editExerciseCount={editExercises.length}
      editSetCount={editExercises.reduce((n, ex) => n + ex.sets.length, 0)}
      onEditDuration={openDurationPicker}
      duration={displayDuration}
      volume={displayVolume}
      topSet={topSet}
      totalExercises={totalExercises}
      totalSets={totalSets}
    />
  );

  const exerciseContent = editing ? (
    <View style={styles.exerciseDetailList}>
      {editExercises.map((ex, i) => (
        <EditableExerciseSection
          key={i}
          exercise={ex}
          exIdx={i}
          canRemove={editExercises.length > 1}
          colors={colors}
          onUpdateSet={updateEditSet}
          onRemoveSet={removeEditSet}
          onAddSet={addEditSet}
          onRemoveExercise={removeEditExercise}
        />
      ))}
    </View>
  ) : isJustCompleted ? (
    <View style={styles.exerciseDetailList}>
      {summaryExercises.map((ex, i) => (
        <ExerciseResultCard key={i} exercise={ex} colors={colors} prevSets={prevMap[ex.name]} coachNote={coachNotesByName.get(ex.name.toLowerCase())} />
      ))}
    </View>
  ) : savedExercises ? (
    // A saved workout after Save: show the edit, not the rows the page was opened with
    <View style={styles.exerciseDetailList}>
      {savedExercises.map((ex, i) => (
        <ExerciseResultCard key={i} exercise={ex} colors={colors} prevSets={prevMap[ex.name]} coachNote={coachNotesByName.get(ex.name.toLowerCase())} />
      ))}
    </View>
  ) : (
    <View style={styles.exerciseDetailList}>
      {(data as WorkoutWithDetails).exercises.map((ex) => (
        <ExerciseResultCard key={ex.id} exercise={ex} colors={colors} prevSets={prevMap[ex.name]} coachNote={coachNotesByName.get(ex.name.toLowerCase())} />
      ))}
    </View>
  );

  const editFooter = <SummaryEditFooter saving={saving} onCancel={cancelEditing} onSave={saveEdits} />;

  // Memoised: a new exercises array on every render made the share image's body maps recompute and redraw.
  const shareData = useMemo(() => ({
    exercises: summaryExercises,
    duration: displayDuration,
    date: isJustCompleted ? new Date() : new Date((data as WorkoutWithDetails).created_at),
    workoutName: null,
  }), [summaryExercises, isJustCompleted, data, displayDuration]);

  const subModals = (
    <>
      {durationPickerMounted && (
        <DurationPickerModal
          visible={durationPickerVisible}
          initialSeconds={editDuration}
          subtitle="How long did this workout take?"
          onConfirm={handleDurationConfirm}
          onCancel={() => setDurationPickerVisible(false)}
        />
      )}
      {shareMounted && (
        <ShareModal visible={showShare} onClose={() => setShowShare(false)}>
          {({ imageUri }) => <WorkoutOverlay backgroundUri={imageUri} data={shareData} />}
        </ShareModal>
      )}
      {confirmExitVisible && (
        <SummaryConfirmExit
          colors={colors}
          onPost={handleConfirmExitPost}
          onDiscard={handleConfirmExitDiscard}
          onCancel={handleConfirmExitCancel}
        />
      )}
    </>
  );

  /* ── Historical mode: full-screen slide page ─────── */

  if (!isJustCompleted) {
    const historicalContent = (
      <>
        <HistoricalPage
          data={data as WorkoutWithDetails}
          heatmapExercises={savedExercises ?? (data as WorkoutWithDetails).exercises}
          colors={colors}
          editing={editing}
          onDismiss={onDismiss}
          onDelete={onDelete}
          handleDelete={handleDelete}
          deleting={deleting}
          startEditing={startEditing}
          workoutId={workoutId}
          statsContent={statsContent}
          exerciseContent={exerciseContent}
          editFooter={editFooter}
          setShowShare={setShowShare}
          inline={inline}
        />
        {subModals}
      </>
    );

    if (inline) return historicalContent;

    return (
      <Modal
        visible
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          if (!portalHostRef.current?.closeTopLayer()) onDismiss();
        }}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <PortalHost ref={portalHostRef}>
              <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
              {historicalContent}
              </SafeAreaView>
            </PortalHost>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </Modal>
    );
  }

  /* ── Just-completed mode ──────────────────────────── */

  const justCompletedContent = (
    <View style={styles.inlinePage}>
      {!editing && (
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleCloseRequest}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Ionicons name="close" size={ms(16)} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <View style={styles.header}>
            <Text style={styles.title}>Edit Workout</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <AnimatedCheckmark colors={colors} />
              <Text style={styles.title}>Workout Complete!</Text>
            </View>

            {statsContent}

            {!editing && (
              <CoachTakeCard
                workoutId={workoutId ?? ''}
                exercises={summaryExercises}
                prevMap={prevMap}
                duration={displayDuration}
                totalSets={totalSets}
                totalExercises={totalExercises}
                onResult={setCoachResult}
              />
            )}

            {!editing && summaryExercises.length > 0 && (
              <MuscleHeatmap exercises={summaryExercises} />
            )}

            {exerciseContent}

            <SharePreviewCard
              data={data as WorkoutSummary}
              shareVisibility={shareVisibility}
              setShareVisibility={setShareVisibility}
              shareTextRef={shareTextRef}
              sharePhotoUrl={sharePhotoUrl}
              sharePhotoUploading={sharePhotoUploading}
              handlePickSharePhoto={handlePickSharePhoto}
              handleRemoveSharePhoto={handleRemoveSharePhoto}
            />
          </>
        )}
      </ScrollView>

      {editing ? editFooter : (
        <SummaryCompletedFooter
          shareVisibility={shareVisibility}
          postDisabled={shareSubmitting || sharePhotoUploading}
          onPost={handlePostToFeed}
          onShare={() => setShowShare(true)}
        />
      )}
      {subModals}
    </View>
  );

  if (inline) return justCompletedContent;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
      {/* Sub-dialogs (duration, share, confirm exit) render here, inside this native window. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PortalHost>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
            {justCompletedContent}
          </SafeAreaView>
        </PortalHost>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  inlinePage: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: sw(16),
    paddingTop: sw(16),
    paddingBottom: sw(16),
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
  header: {
    alignItems: 'center',
    marginBottom: sw(12),
    marginTop: sw(4),
    gap: sw(6),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
  },
  exerciseDetailList: {
    width: '100%',
    gap: sw(8),
    marginBottom: sw(8),
  },
});
