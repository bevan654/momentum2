import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore, getPreferredRestDuration } from '../../stores/useActiveWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import RestPickerModal from './RestPickerModal';
import DurationPickerModal from './DurationPickerModal';
import ActionSheet, { type ActionSheetItem } from './ActionSheet';
import { formatClock } from '../../utils/formatDuration';
import { workoutTotals } from '../../utils/workoutProgress';
import { queueWorkoutFinishFeedback } from '../../services/workoutFinishFeedback';

const FOUR_HOURS = 4 * 60 * 60; // 14400 seconds

function formatRestDuration(seconds: number): string {
  if (seconds >= 120) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function WorkoutHeader() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds);
  const workoutTitle = useActiveWorkoutStore((s) => s.workoutTitle);
  const setRestDuration = useActiveWorkoutStore((s) => s.setRestDuration);
  const discardWorkout = useActiveWorkoutStore((s) => s.discardWorkout);
  const finishWorkout = useActiveWorkoutStore((s) => s.finishWorkout);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const userId = useAuthStore((s) => s.user?.id);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchPrevData = useWorkoutStore((s) => s.fetchPrevData);

  const [restPickerVisible, setRestPickerVisible] = useState(false);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const totals = useMemo(() => workoutTotals(exercises), [exercises]);
  const setsRatio = totals.setsTotal > 0 ? totals.setsDone / totals.setsTotal : 0;

  const handleDiscard = () => {
    Alert.alert('Discard Workout', 'Are you sure? All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: discardWorkout },
    ]);
  };

  const handleFinish = () => {
    if (!userId || finishing) return;

    if (exercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise before finishing.');
      return;
    }

    const incompleteCount = exercises.reduce(
      (n, ex) => n + ex.sets.filter((s) => !s.completed).length, 0
    );

    const message = incompleteCount > 0
      ? `You have ${incompleteCount} incomplete set${incompleteCount > 1 ? 's' : ''}. Finish anyway?`
      : 'Save and finish this workout?';

    Alert.alert('Finish Workout', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          if (elapsedSeconds >= FOUR_HOURS) {
            setDurationPickerVisible(true);
          } else {
            doFinish();
          }
        },
      },
    ]);
  };

  const doFinish = async (durationOverride?: number) => {
    if (!userId) return;
    setFinishing(true);
    try {
      // Queue before the network write starts. If the historical hang recurs
      // and the user force-restarts, the next launch can still ask about it.
      await queueWorkoutFinishFeedback({ userId, workoutId: null });
      const { error, workoutId } = await finishWorkout(userId, durationOverride);
      if (error) {
        Alert.alert('Error', error);
        return;
      }
      await queueWorkoutFinishFeedback({ userId, workoutId: workoutId ?? null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Refresh caches in background — don't block the UI
      Promise.all([
        fetchExerciseCatalog(userId),
        fetchWorkoutHistory(userId),
        fetchPrevData(userId),
      ]).catch(() => {});
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const menuActions: ActionSheetItem[] = [
    {
      key: 'rest',
      label: `Rest length · ${formatRestDuration(getPreferredRestDuration())}`,
      icon: 'timer-outline',
      onPress: () => setRestPickerVisible(true),
    },
    { key: 'discard', label: 'Discard workout', icon: 'trash-outline', onPress: handleDiscard, destructive: true },
  ];

  return (
    <View style={styles.wrapper}>
    <View style={styles.container}>
      {/* Left: title + elapsed time + volume so far */}
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{workoutTitle || 'Workout'}</Text>
        <Text style={styles.elapsed} numberOfLines={1}>
          {formatClock(elapsedSeconds)}
          {totals.volumeKg > 0 ? `  ·  ${Math.round(totals.volumeKg).toLocaleString()} kg` : ''}
        </Text>
      </View>

      {/* Right: Finish + options */}
      <TouchableOpacity
        style={[styles.finishBtn, finishing && styles.finishBtnSaving]}
        onPress={handleFinish}
        disabled={finishing}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Finish workout"
      >
        {finishing ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={styles.finishText}>
            Finish{totals.setsTotal > 0 ? ` · ${totals.setsDone}/${totals.setsTotal}` : ''}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={() => setMenuOpen(true)}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Workout options"
      >
        <Ionicons name="ellipsis-horizontal" size={ms(18)} color={colors.textSecondary} />
      </TouchableOpacity>

    </View>

      {/* Workout progress: sets done / total */}
      {totals.setsTotal > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(setsRatio * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{totals.setsDone}/{totals.setsTotal} sets</Text>
        </View>
      )}

      <ActionSheet
        visible={menuOpen}
        title={workoutTitle || 'Workout'}
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

      <RestPickerModal
        visible={restPickerVisible}
        currentDuration={getPreferredRestDuration()}
        onSelect={setRestDuration}
        onClose={() => setRestPickerVisible(false)}
      />

      <DurationPickerModal
        visible={durationPickerVisible}
        onConfirm={(seconds) => {
          setDurationPickerVisible(false);
          doFinish(seconds);
        }}
        onCancel={() => setDurationPickerVisible(false)}
      />
    </View>
  );
}

export default React.memo(WorkoutHeader);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: sw(16),
    paddingTop: sw(10),
    paddingBottom: sw(10),
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(10),
  },
  progressTrack: {
    flex: 1,
    height: sw(3),
    borderRadius: sw(2),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: sw(2),
    backgroundColor: colors.accent,
  },
  progressText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
    fontVariant: ['tabular-nums'],
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
  },
  elapsed: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(17),
    fontVariant: ['tabular-nums'],
  },
  finishBtn: {
    minWidth: sw(84),
    height: sw(36),
    paddingHorizontal: sw(16),
    borderRadius: sw(18),
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishBtnSaving: {
    opacity: 0.7,
  },
  finishText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(17),
  },
  moreBtn: {
    padding: sw(4),
  },
});
