import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import RestPickerModal from './RestPickerModal';
import DurationPickerModal from './DurationPickerModal';

const FOUR_HOURS = 4 * 60 * 60; // 14400 seconds

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatRestDuration(seconds: number): string {
  if (seconds >= 120) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function WorkoutHeader() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const elapsedSeconds = useActiveWorkoutStore((s) => s.elapsedSeconds);
  const restDuration = useActiveWorkoutStore((s) => s.restDuration);
  const isResting = useActiveWorkoutStore((s) => s.isResting);
  const setRestDuration = useActiveWorkoutStore((s) => s.setRestDuration);
  const startRest = useActiveWorkoutStore((s) => s.startRest);
  const stopRest = useActiveWorkoutStore((s) => s.stopRest);
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
      const { error } = await finishWorkout(userId, durationOverride);
      if (error) {
        Alert.alert('Error', error);
        return;
      }
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

  return (
    <View style={styles.container}>
      {/* Left: Rest timer controls */}
      <View style={styles.leftGroup}>
        <TouchableOpacity style={styles.restBtn} onPress={() => setRestPickerVisible(true)}>
          <Text style={styles.restText}>{formatRestDuration(restDuration)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={isResting ? stopRest : startRest}
        >
          <Ionicons
            name={isResting ? 'pause' : 'play'}
            size={ms(16)}
            color={colors.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Center: Timer */}
      <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text>

      {/* Right: Actions */}
      <View style={styles.rightGroup}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleDiscard}>
          <Ionicons name="trash-outline" size={ms(18)} color={colors.accentRed} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishBtn, finishing && styles.finishBtnSaving]}
          onPress={handleFinish}
          disabled={finishing}
          activeOpacity={0.7}
        >
          {finishing ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Ionicons name="checkmark" size={ms(20)} color={colors.textOnAccent} />
          )}
        </TouchableOpacity>
      </View>

      <RestPickerModal
        visible={restPickerVisible}
        currentDuration={restDuration}
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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    flex: 1,
  },
  restBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: sw(12),
    paddingVertical: sw(6),
    borderRadius: sw(8),
  },
  restText: {
    color: colors.accent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
  },
  iconBtn: {
    padding: sw(6),
  },
  timer: {
    color: colors.textPrimary,
    fontSize: ms(22),
    fontFamily: Fonts.bold,
    lineHeight: ms(27),
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    flex: 1,
    justifyContent: 'flex-end',
  },
  finishBtn: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(18),
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishBtnSaving: {
    opacity: 0.7,
  },
});
