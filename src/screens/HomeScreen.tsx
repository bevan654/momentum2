import React, { useEffect, useMemo } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useStreakStore } from '../stores/useStreakStore';
import NutritionCard from '../components/home/NutritionCard';
import WaterCard from '../components/home/WaterCard';
import MotivationCard from '../components/home/MotivationCard';
import SupplementsCard from '../components/home/SupplementsCard';
import ActivityCard from '../components/home/ActivityCard';
import { useNavigation } from '@react-navigation/native';

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
  }, [userId]);

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

  const handleLogFood = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Nutrition');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      bounces
    >
      {/* Quick actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={handleLogWorkout}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.accentGreen + '15' }]}>
            <Ionicons name="barbell-outline" size={ms(18)} color={colors.accentGreen} />
          </View>
          <Text style={styles.actionLabel}>
            {isActive ? 'Resume' : 'Log Workout'}
          </Text>
          <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={handleLogFood}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: colors.accentOrange + '15' }]}>
            <Ionicons name="restaurant-outline" size={ms(18)} color={colors.accentOrange} />
          </View>
          <Text style={styles.actionLabel}>Log Food</Text>
          <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Nutrition + Water + Streak */}
      <View style={styles.nutritionRow}>
        <NutritionCard />
        <View style={styles.supplementCol}>
          <WaterCard />
          <MotivationCard />
        </View>
      </View>

      {/* Supplements */}
      <SupplementsCard />

      {/* Activity Calendar */}
      <View style={styles.activityWrap}>
        <ActivityCard />
      </View>
    </ScrollView>
  );
}

export default React.memo(HomeScreen);

const NUTRITION_ROW_H = sw(295);
const ACTIVITY_H = sw(370);

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
  actionRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    paddingHorizontal: sw(10),
    gap: sw(8),
  },
  actionIconWrap: {
    width: sw(30),
    height: sw(30),
    borderRadius: sw(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
    letterSpacing: -0.1,
  },
  nutritionRow: {
    height: NUTRITION_ROW_H,
    flexDirection: 'row',
    gap: sw(8),
  },
  supplementCol: {
    flex: 1,
    gap: sw(8),
  },
  activityWrap: {
    height: ACTIVITY_H,
  },
});
