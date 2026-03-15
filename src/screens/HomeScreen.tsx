import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { useStreakStore } from '../stores/useStreakStore';
import { useNavigation } from '@react-navigation/native';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchTodayNutrition = useNutritionStore((s) => s.fetchTodayNutrition);
  const fetchNutritionGoals = useNutritionStore((s) => s.fetchNutritionGoals);
  const fetchTodaySupplements = useSupplementStore((s) => s.fetchTodaySupplements);
  const fetchSupplementGoals = useSupplementStore((s) => s.fetchSupplementGoals);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const fetchWeightData = useWeightStore((s) => s.fetchWeightData);
  const workouts = useWorkoutStore((s) => s.workouts);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const refreshStreak = useStreakStore((s) => s.refreshStreak);
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { calories, calorieGoal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal } =
    useNutritionStore();

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

  const addWater = useSupplementStore((s) => s.addWater);
  const handleAddWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.id) addWater(user.id, 250);
  };

  const calProgress = calorieGoal > 0 ? Math.min(calories / calorieGoal, 1) : 0;
  const pProgress = proteinGoal > 0 ? Math.min(protein / proteinGoal, 1) : 0;
  const cProgress = carbsGoal > 0 ? Math.min(carbs / carbsGoal, 1) : 0;
  const fProgress = fatGoal > 0 ? Math.min(fat / fatGoal, 1) : 0;

  const weekDates = useMemo(() => getWeekDates(), []);
  const workoutDates = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      const d = new Date(w.created_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return set;
  }, [workouts]);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {/* Top section */}
        <View style={styles.topRow}>
          {/* Left — flame + streak */}
          <View style={styles.leftCol}>
            <Ionicons name="flame" size={ms(36)} color={colors.accent} />
            <Text style={styles.streakDays}>{currentStreak} days</Text>
            <Text style={styles.streakLabel}>Streak</Text>
          </View>

          {/* Right — calories + bar */}
          <View style={styles.rightCol}>
            <View style={styles.calRow}>
              <Text style={styles.calNumber}>{calories}</Text>
              <Text style={styles.calGoal}> /{calorieGoal}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${calProgress * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Macros */}
        <View style={styles.macroCol}>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>P</Text>
            <View style={styles.macroTrack}>
              <View style={[styles.macroFill, { width: `${pProgress * 100}%` }]} />
            </View>
            <Text style={styles.macroValue}>{protein}<Text style={styles.macroGoalText}>/{proteinGoal}g</Text></Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>C</Text>
            <View style={styles.macroTrack}>
              <View style={[styles.macroFill, { width: `${cProgress * 100}%` }]} />
            </View>
            <Text style={styles.macroValue}>{carbs}<Text style={styles.macroGoalText}>/{carbsGoal}g</Text></Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroLabel}>F</Text>
            <View style={styles.macroTrack}>
              <View style={[styles.macroFill, { width: `${fProgress * 100}%` }]} />
            </View>
            <Text style={styles.macroValue}>{fat}<Text style={styles.macroGoalText}>/{fatGoal}g</Text></Text>
          </View>
        </View>

        {/* Week row */}
        <View style={styles.weekRow}>
          {weekDates.map((dateKey, i) => {
            const done = workoutDates.has(dateKey);
            const dayNum = dateKey.split('-')[2].replace(/^0/, '');
            return (
              <View key={dateKey} style={styles.weekItem}>
                <View style={[styles.dot, done && styles.dotDone]}>
                  {done
                    ? <Ionicons name="checkmark" size={ms(10)} color="#fff" />
                    : <Text style={styles.dotText}>{dayNum}</Text>
                  }
                </View>
                <Text style={[styles.dayLabel, done && styles.dayLabelDone]}>{DAY_LABELS[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLogWorkout} activeOpacity={0.7}>
          <Ionicons name="barbell-outline" size={ms(18)} color={colors.accentGreen} />
          <Text style={[styles.actionBtnLabel, { color: colors.accentGreen }]}>
            {isActive ? 'Resume' : 'Workout'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleLogFood} activeOpacity={0.7}>
          <Ionicons name="restaurant-outline" size={ms(18)} color={colors.accentOrange} />
          <Text style={[styles.actionBtnLabel, { color: colors.accentOrange }]}>Food</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleAddWater} activeOpacity={0.7}>
          <Ionicons name="water-outline" size={ms(18)} color={colors.water} />
          <Text style={[styles.actionBtnLabel, { color: colors.water }]}>+Water</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default React.memo(HomeScreen);

const DOT_SIZE = sw(26);
const ACTION_BAR_H = sw(56);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  card: {
    margin: sw(16),
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(14),
    gap: sw(12),
  },

  /* Top */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftCol: {
    alignItems: 'center',
    marginRight: sw(14),
  },
  streakDays: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    marginTop: sw(2),
  },
  streakLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },

  rightCol: {
    flex: 1,
    gap: sw(6),
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  calNumber: {
    color: colors.textPrimary,
    fontSize: ms(26),
    lineHeight: ms(30),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  calGoal: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
  },
  barTrack: {
    height: sw(6),
    backgroundColor: colors.surface,
    borderRadius: sw(3),
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.textPrimary,
    borderRadius: sw(3),
  },

  /* Macros */
  macroCol: {
    gap: sw(5),
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  macroLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    width: sw(12),
  },
  macroTrack: {
    flex: 1,
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    backgroundColor: colors.textTertiary,
    borderRadius: sw(2),
  },
  macroValue: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    minWidth: sw(50),
    textAlign: 'right',
  },
  macroGoalText: {
    color: colors.textTertiary + '60',
    fontSize: ms(8),
    fontFamily: Fonts.regular,
  },

  /* Week */
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekItem: {
    alignItems: 'center',
    gap: sw(3),
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: colors.accent,
  },
  dotText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },
  dayLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
  },
  dayLabelDone: {
    color: colors.textSecondary,
    fontFamily: Fonts.bold,
  },

  /* Action bar */
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ACTION_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.card + 'E6',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(8),
  },
  actionBtnLabel: {
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 0.2,
  },
});
