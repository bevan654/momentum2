import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost, type PortalHostHandle } from '../ui/Portal';
import { useLingerMount } from '../../hooks/useLingerMount';
import { useSharedValue, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MuscleHeatmap from '../body/MuscleHeatmap';
import DurationPickerModal from './DurationPickerModal';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useActiveWorkoutStore, type WorkoutSummary, type SummaryExercise } from '../../stores/useActiveWorkoutStore';
import type { WorkoutWithDetails, CoachExerciseNote } from '../../stores/useWorkoutStore';
import ShareModal from '../share/ShareModal';
import WorkoutOverlay from '../dev/WorkoutOverlay';
import CoachTakeCard, { type CoachResult } from './CoachTakeCard';
import { pickAndUploadWorkoutPhoto } from '../../utils/uploadWorkoutPhoto';
import { formatDuration, formatVolume } from './summary/summaryFormat';
import { useSummaryEdit } from './summary/useSummaryEdit';
import { ExerciseDetailCard, SummaryExerciseCard } from './summary/SummaryExerciseCards';
import EditableExerciseSection from './summary/EditableExerciseSection';
import AnimatedCheckmark from './summary/AnimatedCheckmark';
import HistoricalPage from './summary/HistoricalPage';
import SummaryConfirmExit from './summary/SummaryConfirmExit';
import SharePreviewCard, { type ShareVisibility } from './summary/SharePreviewCard';

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

  // ── Crossfade animation for historical modal ────
  const contentOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!inline && mode === 'historical') {
      backdropOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });
      contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    }
  }, []);

  const animatedDismiss = useCallback(() => {
    contentOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    backdropOpacity.value = withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss]);

  // ── Edit state ───────────────────────────────────
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const durationPickerMounted = useLingerMount(durationPickerVisible);

  // Share modal + workout name
  const [showShare, setShowShare] = useState(false);
  const shareMounted = useLingerMount(showShare);
  const [workoutName] = useState('');

  // Themed confirm-before-exit dialog (just-completed mode only)
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);

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

  // ── Inline share-to-feed state (just-completed only) ─────────
  const commitFeedPost = useActiveWorkoutStore((s) => s.commitFeedPost);
  const [sharePhotoUrl, setSharePhotoUrl] = useState<string | null>(null);
  const [sharePhotoUploading, setSharePhotoUploading] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<ShareVisibility>('public');
  const [shareTitle, setShareTitle] = useState('');
  const [shareCaption, setShareCaption] = useState('');
  const [shareSubmitting, setShareSubmitting] = useState(false);

  const handlePickSharePhoto = useCallback(async () => {
    if (!workoutId || !userId || sharePhotoUploading) return;
    setSharePhotoUploading(true);
    try {
      const result = await pickAndUploadWorkoutPhoto(userId, workoutId);
      if (result) {
        setSharePhotoUrl(result.publicUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } finally {
      setSharePhotoUploading(false);
    }
  }, [workoutId, userId, sharePhotoUploading]);

  const handleRemoveSharePhoto = useCallback(() => {
    Alert.alert('Remove photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setSharePhotoUrl(null) },
    ]);
  }, []);

  const handlePostToFeed = useCallback(() => {
    if (shareSubmitting) return;
    setShareSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    commitFeedPost({
      visibility: shareVisibility,
      title: shareTitle,
      caption: shareCaption,
    }).catch(() => {});
    // Dismiss immediately — feed insert is fire-and-forget
    onDismiss();

  }, [shareSubmitting, commitFeedPost, shareVisibility, shareTitle, shareCaption, onDismiss]);

  // Confirm before exiting the just-completed summary without sharing.
  // Workout is already in `workouts`; the dialog exists so users don't lose the feed post by accident.
  const handleCloseRequest = useCallback(() => {
    if (!isJustCompleted || shareVisibility === 'private') {
      onDismiss();
      return;
    }
    setConfirmExitVisible(true);
  }, [isJustCompleted, shareVisibility, onDismiss]);

  const handleConfirmExitPost = useCallback(() => {
    setConfirmExitVisible(false);
    handlePostToFeed();
  }, [handlePostToFeed]);

  const handleConfirmExitDiscard = useCallback(() => {
    setConfirmExitVisible(false);
    onDismiss();
  }, [onDismiss]);


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

  // Top set: heaviest weight used across all exercises
  const topSet = useMemo(() => {
    const exs = savedExercises ?? (
      isJustCompleted ? (data as WorkoutSummary).exercises
        : (data as WorkoutWithDetails).exercises.map((ex) => ({
            name: ex.name, category: ex.category, exercise_type: ex.exercise_type || 'weighted',
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type || 'working', parent_set_number: s.parent_set_number ?? null })),
          }))
    );
    let bestKg = 0;
    let bestReps = 0;
    for (const ex of exs) {
      for (const s of ex.sets) {
        if (s.completed && s.kg > bestKg) {
          bestKg = s.kg;
          bestReps = s.reps;
        }
      }
    }
    return bestKg > 0 ? { kg: bestKg, reps: bestReps } : null;
  }, [savedExercises, data, isJustCompleted]);

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

  /* ── Shared inner content ───────────────────────────── */

  const statsContent = editing ? (
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
      {topSet && (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{topSet.kg}×{topSet.reps}</Text>
            <Text style={styles.statLabel}>Top Set</Text>
          </View>
        </>
      )}
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
      {(displayExercises ?? (data as WorkoutSummary).exercises).map((ex, i) => (
        <SummaryExerciseCard key={i} exercise={ex} colors={colors} prevSets={prevMap[ex.name]} coachNote={coachNotesByName.get(ex.name.toLowerCase())} />
      ))}
    </View>
  ) : (
    <View style={styles.exerciseDetailList}>
      {(data as WorkoutWithDetails).exercises.map((ex) => (
        <ExerciseDetailCard key={ex.id} exercise={ex} colors={colors} prevSets={prevMap[ex.name]} coachNote={coachNotesByName.get(ex.name.toLowerCase())} />
      ))}
    </View>
  );

  const editFooter = (
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
  );

  // Memoised: a new exercises array on every render made the share image's body maps recompute and redraw.
  const shareData = useMemo(() => ({
    exercises: displayExercises ?? (
      isJustCompleted
        ? (data as WorkoutSummary).exercises
        : (data as WorkoutWithDetails).exercises.map((ex) => ({
            name: ex.name,
            category: ex.category,
            exercise_type: ex.exercise_type || 'weighted',
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type || 'working', parent_set_number: s.parent_set_number ?? null })),
          }))
    ),
    duration: displayDuration,
    date: isJustCompleted ? new Date() : new Date((data as WorkoutWithDetails).created_at),
    workoutName: workoutName.trim() || null,
  }), [displayExercises, isJustCompleted, data, displayDuration, workoutName]);

  const subModals = (
    <>
      {durationPickerMounted && (
        <DurationPickerModal
          visible={durationPickerVisible}
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
          onCancel={() => setConfirmExitVisible(false)}
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
          colors={colors}
          editing={editing}
          onDismiss={inline ? onDismiss : animatedDismiss}
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
          if (!portalHostRef.current?.closeTopLayer()) animatedDismiss();
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
                exercises={displayExercises ?? (data as WorkoutSummary).exercises}
                prevMap={prevMap}
                duration={displayDuration}
                totalSets={totalSets}
                totalExercises={totalExercises}
                onResult={setCoachResult}
              />
            )}

            {!editing && (displayExercises ?? (data as WorkoutSummary).exercises).length > 0 && (
              <MuscleHeatmap exercises={displayExercises ?? (data as WorkoutSummary).exercises} />
            )}

            {exerciseContent}

            <SharePreviewCard
              data={data as WorkoutSummary}
              shareVisibility={shareVisibility}
              setShareVisibility={setShareVisibility}
              shareTitle={shareTitle}
              setShareTitle={setShareTitle}
              shareCaption={shareCaption}
              setShareCaption={setShareCaption}
              sharePhotoUrl={sharePhotoUrl}
              sharePhotoUploading={sharePhotoUploading}
              handlePickSharePhoto={handlePickSharePhoto}
              handleRemoveSharePhoto={handleRemoveSharePhoto}
            />
          </>
        )}
      </ScrollView>

      {editing ? editFooter : (
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.smallIconBtn} onPress={() => useActiveWorkoutStore.getState().undoFinish()} activeOpacity={0.7}>
            <Ionicons name="pencil" size={ms(18)} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtnMain} onPress={handlePostToFeed} activeOpacity={0.85} disabled={shareSubmitting || sharePhotoUploading}>
            <Ionicons
              name={shareVisibility === 'private' ? 'lock-closed' : 'paper-plane'}
              size={ms(16)}
              color={colors.textOnAccent}
            />
            <Text style={styles.shareBtnMainText}>
              {shareVisibility === 'private' ? 'Save as private' : 'Post to feed'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallIconBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={ms(18)} color={colors.accent} />
          </TouchableOpacity>
        </View>
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(6),
    marginBottom: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(1),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(20),
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    lineHeight: ms(13),
    letterSpacing: 0.3,
  },
  exerciseDetailList: {
    width: '100%',
    gap: sw(8),
    marginBottom: sw(8),
  },
  durationEditHint: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(6),
  },
  smallIconBtn: {
    width: sw(40),
    height: sw(40),
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
    backgroundColor: colors.accent,
    paddingVertical: sw(12),
  },
  shareBtnMainText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    letterSpacing: 0.3,
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
