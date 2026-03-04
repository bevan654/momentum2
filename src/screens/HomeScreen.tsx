import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, ScrollView, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useSupplementStore } from '../stores/useSupplementStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWeightStore } from '../stores/useWeightStore';
import { useProteinPowderStore } from '../stores/useProteinPowderStore';
import type { ProteinPowder } from '../stores/useProteinPowderStore';
import NutritionCard from '../components/home/NutritionCard';
import WaterCard from '../components/home/WaterCard';
import ProteinPowderCell from '../components/home/ProteinPowderCell';
import PowderSelectSheet from '../components/home/PowderSelectSheet';
import SupplementsCard from '../components/home/SupplementsCard';
import ActivityCard from '../components/home/ActivityCard';
import { useNavigation } from '@react-navigation/native';

function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchTodayNutrition = useNutritionStore((s) => s.fetchTodayNutrition);
  const fetchNutritionGoals = useNutritionStore((s) => s.fetchNutritionGoals);
  const fetchTodaySupplements = useSupplementStore((s) => s.fetchTodaySupplements);
  const fetchSupplementGoals = useSupplementStore((s) => s.fetchSupplementGoals);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const fetchPowders = useProteinPowderStore((s) => s.fetchPowders);
  const fetchScoopGoal = useProteinPowderStore((s) => s.fetchScoopGoal);
  const fetchTodayScoops = useProteinPowderStore((s) => s.fetchTodayScoops);
  const powders = useProteinPowderStore((s) => s.powders);
  const logScoop = useProteinPowderStore((s) => s.logScoop);
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [powderSheetVisible, setPowderSheetVisible] = useState(false);
  const [pendingScoopAmount, setPendingScoopAmount] = useState(1);

  const handlePickPowder = useCallback((amount: number) => {
    setPendingScoopAmount(amount);
    setPowderSheetVisible(true);
  }, []);

  const handleSelectPowder = useCallback((powder: ProteinPowder) => {
    if (user?.id) logScoop(user.id, powder, pendingScoopAmount);
    setPowderSheetVisible(false);
  }, [user?.id, logScoop, pendingScoopAmount]);


  useEffect(() => {
    if (user?.id) {
      fetchTodayNutrition(user.id);
      fetchNutritionGoals(user.id);
      fetchTodaySupplements(user.id);
      fetchSupplementGoals(user.id);
      fetchExerciseCatalog(user.id).then(() => fetchWorkoutHistory(user.id));
      fetchWeightData(user.id);
      fetchPowders(user.id);
      fetchScoopGoal(user.id);
      fetchTodayScoops(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) {
        fetchTodayNutrition(user.id);
        fetchTodaySupplements(user.id);
        fetchTodayScoops(user.id);
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

      {/* Nutrition + Water + Protein Powder */}
      <View style={styles.nutritionRow}>
        <NutritionCard />
        <View style={styles.supplementCol}>
          <WaterCard />
          <ProteinPowderCell embedded onPickPowder={handlePickPowder} />
        </View>
      </View>

      <PowderSelectSheet
        visible={powderSheetVisible}
        onClose={() => setPowderSheetVisible(false)}
        powders={powders}
        onSelect={handleSelectPowder}
      />

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
    paddingTop: sw(10),
    paddingBottom: sw(24),
    gap: sw(14),
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
    height: NUTRITION_ROW_H,
    flexDirection: 'row',
    gap: sw(10),
  },
  supplementCol: {
    flex: 1,
    gap: sw(10),
  },
  activityWrap: {
    height: ACTIVITY_H,
  },
});
