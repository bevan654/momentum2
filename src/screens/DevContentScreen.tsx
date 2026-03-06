import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import AvatarViewer from '../components/dev/AvatarViewer';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

export default function DevContentScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleStartMockWorkout = () => {
    const { startWorkout, addExercise, updateSet, addSet, toggleSetComplete, stopRest } = useActiveWorkoutStore.getState();
    startWorkout();

    // Bench Press — previous session: 4×80kg×8 = 2560kg vol
    addExercise('Bench Press', 'weighted', 'Chest', [
      { kg: 80, reps: 8 },
      { kg: 80, reps: 8 },
      { kg: 80, reps: 7 },
      { kg: 75, reps: 8 },
    ]);
    // Pre-fill first two sets as completed to show progress
    updateSet(0, 0, 'kg', '80');
    updateSet(0, 0, 'reps', '8');
    toggleSetComplete(0, 0);
    addSet(0);
    updateSet(0, 1, 'kg', '82.5');
    updateSet(0, 1, 'reps', '8');
    toggleSetComplete(0, 1);

    // Squat — previous session: 3×100kg×5 = 1500kg vol
    addExercise('Squat', 'weighted', 'Legs', [
      { kg: 100, reps: 5 },
      { kg: 100, reps: 5 },
      { kg: 100, reps: 4 },
    ]);

    // Pull Up — no previous data (first time)
    addExercise('Pull Up', 'bodyweight', 'Back');

    // Stop the rest timer that auto-started from toggleSetComplete
    stopRest();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Mock Workout</Text>
        <TouchableOpacity
          style={styles.mockButton}
          onPress={handleStartMockWorkout}
          activeOpacity={0.7}
        >
          <Ionicons name="barbell-outline" size={ms(20)} color={colors.textOnAccent} />
          <Text style={styles.mockButtonText}>Start Mock Workout</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Avatar</Text>
        <AvatarViewer />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    list: {
      flex: 1,
    },
    listContent: {
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingBottom: sw(40),
      gap: sw(12),
    },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      alignSelf: 'flex-start',
      marginTop: sw(8),
    },
    mockButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingVertical: sw(14),
      paddingHorizontal: sw(24),
      alignSelf: 'stretch',
    },
    mockButtonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      fontFamily: Fonts.semiBold,
    },
  });
