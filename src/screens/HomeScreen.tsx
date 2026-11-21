import React, { useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useToday } from '../hooks/useToday';
import { useNavigation } from '@react-navigation/native';
import TodayHomeLayout from '../components/home/today/TodayHomeLayout';
import StartWorkoutButton, { START_WORKOUT_CLEARANCE } from '../components/home/today/StartWorkoutButton';
import GrainBackground from '../components/home/today/GrainBackground';

function HomeScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const fetchTodayNutrition = useNutritionStore((s) => s.fetchTodayNutrition);
  const fetchTodaySupplements = useSupplementStore((s) => s.fetchTodaySupplements);
  const fetchSupplementGoals = useSupplementStore((s) => s.fetchSupplementGoals);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const initStreak = useStreakStore((s) => s.initStreak);
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const navigation = useNavigation<any>();
  const today = useToday();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      fetchTodayNutrition(userId);
      useFoodLogStore.getState().fetchGoals(userId);
      fetchTodaySupplements(userId);
      fetchSupplementGoals(userId);
      fetchExerciseCatalog(userId).then(() => fetchWorkoutHistory(userId));
      fetchWeightData(userId);
      initStreak(userId);
    }
  }, [userId, today]);

  const goalsCheckedAt = React.useRef(Date.now());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) {
        fetchTodayNutrition(userId);
        // Goals may have been changed on another phone (checked at most every 10 minutes).
        if (Date.now() - goalsCheckedAt.current > 10 * 60 * 1000) {
          goalsCheckedAt.current = Date.now();
          useFoodLogStore.getState().fetchGoals(userId);
        }
        fetchTodaySupplements(userId);
        useStreakStore.getState().refreshStreak(userId);
      }
    });
    return () => sub.remove();
  }, [userId]);

  const handleLogWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isActive) {
      showSheet();
    } else {
      navigation.navigate('Workouts', { screen: 'StartWorkout' });
    }
  };

  const handleOpenTraining = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Recovery');
  };

  return (
    <View style={styles.root}>
      <GrainBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <TodayHomeLayout onTraining={handleOpenTraining} />
      </ScrollView>
      <StartWorkoutButton isActive={isActive} onPress={handleLogWorkout} />
    </View>
  );
}

export default React.memo(HomeScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: sw(16),
    paddingTop: sw(8),
    paddingBottom: START_WORKOUT_CLEARANCE,
    flexGrow: 1,
  },
});
