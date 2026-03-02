import React, { useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useStreakStore } from '../stores/useStreakStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import NutritionCard from '../components/home/NutritionCard';
import WaterCard from '../components/home/WaterCard';
import CreatineCard from '../components/home/CreatineCard';
import ActivityCard from '../components/home/ActivityCard';
import { useNavigation, useFocusEffect } from '@react-navigation/native';


function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchTodayNutrition = useNutritionStore((s) => s.fetchTodayNutrition);
  const fetchNutritionGoals = useNutritionStore((s) => s.fetchNutritionGoals);
  const fetchTodaySupplements = useSupplementStore((s) => s.fetchTodaySupplements);
  const fetchSupplementGoals = useSupplementStore((s) => s.fetchSupplementGoals);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const refreshStreak = useStreakStore((s) => s.refreshStreak);
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const username = useAuthStore((s) => s.profile?.username ?? null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchTodayNutrition(user.id);
      fetchNutritionGoals(user.id);
      fetchTodaySupplements(user.id);
      fetchSupplementGoals(user.id);
      fetchExerciseCatalog(user.id).then(() => fetchWorkoutHistory(user.id));
      fetchWeightData(user.id);
      refreshStreak(user.id);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refreshStreak(user.id);
      }
    }, [user?.id])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) {
        refreshStreak(user.id);
        fetchTodayNutrition(user.id);
        fetchTodaySupplements(user.id);
      }
    });
    return () => sub.remove();
  }, [user?.id]);

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
    <View style={styles.container}>
      <Text style={styles.greeting}>
        {greeting}, {username || 'there'}
      </Text>

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

      {/* Nutrition + Supplements */}
      <View style={styles.nutritionRow}>
        <NutritionCard />
        <View style={styles.supplementCol}>
          <WaterCard />
          <CreatineCard />
        </View>
      </View>

      {/* Activity Calendar */}
      <View style={styles.activityWrap}>
        <ActivityCard />
      </View>
    </View>
  );
}

export default React.memo(HomeScreen);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: sw(16),
    paddingTop: sw(10),
    paddingBottom: sw(14),
    gap: sw(16),
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: sw(10),
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(12),
    paddingHorizontal: sw(12),
    gap: sw(8),
    ...colors.cardShadow,
  },
  actionIconWrap: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(10),
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
    flex: 4,
    flexDirection: 'row',
    gap: sw(10),
  },
  activityWrap: {
    flex: 5,
  },
  supplementCol: {
    flex: 1,
    gap: sw(14),
  },
});
