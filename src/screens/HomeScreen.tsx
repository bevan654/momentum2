import React, { useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useProgramStore } from '../stores/useProgramStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import HomeHeader from '../components/home/HomeHeader';
import StreakStrip from '../components/home/StreakStrip';
import TodayStatCard from '../components/home/TodayStatCard';
import HydrationCard from '../components/home/HydrationCard';
import StepsCard from '../components/home/StepsCard';
import QuickStartCard from '../components/home/QuickStartCard';
import BmiCard from '../components/home/BmiCard';

function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const fetchTodayNutrition = useNutritionStore((s) => s.fetchTodayNutrition);
  const fetchNutritionGoals = useNutritionStore((s) => s.fetchNutritionGoals);
  const fetchTodaySupplements = useSupplementStore((s) => s.fetchTodaySupplements);
  const fetchSupplementGoals = useSupplementStore((s) => s.fetchSupplementGoals);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const initStreak = useStreakStore((s) => s.initStreak);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const fetchRoutines = useRoutineStore((s) => s.fetchRoutines);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (user?.id) {
      fetchTodayNutrition(user.id);
      fetchNutritionGoals(user.id);
      fetchTodaySupplements(user.id);
      fetchSupplementGoals(user.id);
      fetchExerciseCatalog(user.id).then(() => fetchWorkoutHistory(user.id));
      fetchWeightData(user.id);
      initStreak(user.id);
      fetchPrograms(user.id);
      fetchRoutines(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) {
        fetchTodayNutrition(user.id);
        fetchTodaySupplements(user.id);
        useStreakStore.getState().refreshStreak(user.id);
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + sw(8) }]}
      showsVerticalScrollIndicator={false}
      bounces
    >
      <HomeHeader />
      <StreakStrip />
      <BmiCard />

      <View style={styles.statsRow}>
        <TodayStatCard />
        <HydrationCard />
        <StepsCard />
      </View>
      <QuickStartCard />
    </ScrollView>
  );
}

export default React.memo(HomeScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: sw(16),
    paddingTop: sw(8),
    paddingBottom: sw(24),
    gap: sw(8),
  },
  statsRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
});
