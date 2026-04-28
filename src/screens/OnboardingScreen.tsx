import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useFoodLogStore } from '../stores/useFoodLogStore';
import { useSupplementStore } from '../stores/useSupplementStore';

const TOTAL_STEPS = 2;

const STEP_CONFIG = [
  { title: 'Tell us about yourself', subtitle: 'We use this to personalise your experience' },
  { title: 'Set your daily goals', subtitle: 'Recommended targets based on your details — adjust if you like' },
];

type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';

const ACTIVITY_OPTIONS: { key: ActivityKey; label: string; description: string; multiplier: number }[] = [
  { key: 'sedentary', label: 'Sedentary',  description: 'Desk job, little exercise',         multiplier: 1.2 },
  { key: 'light',     label: 'Light',      description: 'Light exercise 1–3 days/wk',         multiplier: 1.375 },
  { key: 'moderate',  label: 'Moderate',   description: 'Exercise 3–5 days/wk',               multiplier: 1.55 },
  { key: 'very',      label: 'Very active', description: 'Hard exercise 6–7 days/wk',         multiplier: 1.725 },
  { key: 'athlete',   label: 'Athlete',    description: 'Twice daily training / labour job',  multiplier: 1.9 },
];

type GoalMode = 'cut' | 'maintain' | 'bulk';

const computeRecommendation = (params: {
  gender: string | null;
  ageNum: number;
  heightCm: number;
  weightKg: number;
  goalKg: number;
  activity: ActivityKey | null;
}): { mode: GoalMode; calories: number; protein: number; carbs: number; fat: number } | null => {
  const { gender, ageNum, heightCm, weightKg, goalKg, activity } = params;
  if (!gender || !activity) return null;
  if (!(ageNum > 0 && heightCm > 0 && weightKg > 0 && goalKg > 0)) return null;

  // Mifflin-St Jeor
  const bmr =
    gender === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5;

  const multiplier = ACTIVITY_OPTIONS.find((o) => o.key === activity)!.multiplier;
  const tdee = bmr * multiplier;

  const diff = goalKg - weightKg;
  let mode: GoalMode = 'maintain';
  let calories = tdee;
  if (diff <= -1) {
    mode = 'cut';
    calories = tdee - 500;
  } else if (diff >= 1) {
    mode = 'bulk';
    calories = tdee + 300;
  }

  // Protein: 2.0 g/kg for cut, 1.8 g/kg for bulk/maintain
  const proteinG = Math.round((mode === 'cut' ? 2.0 : 1.8) * weightKg);
  // Fat: 25% of calories
  const fatG = Math.round((calories * 0.25) / 9);
  // Carbs: remainder
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    mode,
    calories: Math.round(calories / 10) * 10,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
  };
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { profile, updateProfile } = useAuthStore();
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);

  // Step state
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('2000');
  const [protein, setProtein] = useState('150');
  const [carbs, setCarbs] = useState('250');
  const [fat, setFat] = useState('65');
  const [water, setWater] = useState('2500');
  const [creatine, setCreatine] = useState('5');
  const [goalWeight, setGoalWeight] = useState('');
  const [activity, setActivity] = useState<ActivityKey | null>(null);

  // Tracks whether user has manually edited macros — if not, we auto-fill from TDEE
  const macrosTouched = useRef(false);

  // Animation values
  const progressAnim = useSharedValue(1 / TOTAL_STEPS);
  const slideAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(1);

  const easeOut = Easing.out(Easing.cubic);

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progressAnim.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateX: slideAnim.value }],
  }));

  const animateTransition = useCallback(
    (nextStep: number) => {
      const direction = nextStep > step ? -1 : 1;

      fadeAnim.value = withTiming(0, { duration: 120, easing: easeOut }, (finished) => {
        if (finished) {
          runOnJS(setStep)(nextStep);
          slideAnim.value = direction * -40;
          progressAnim.value = withTiming(nextStep / TOTAL_STEPS, { duration: 300, easing: easeOut });
          slideAnim.value = withTiming(0, { duration: 250, easing: easeOut });
          fadeAnim.value = withTiming(1, { duration: 250, easing: easeOut });
        }
      });
    },
    [step],
  );

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) animateTransition(step + 1);
  }, [step, animateTransition]);

  const goBack = useCallback(() => {
    if (step > 1) animateTransition(step - 1);
  }, [step, animateTransition]);

  const recommendation = useMemo(
    () => computeRecommendation({
      gender,
      ageNum: Number(age),
      heightCm: Number(height),
      weightKg: Number(weight),
      goalKg: Number(goalWeight),
      activity,
    }),
    [gender, age, height, weight, goalWeight, activity],
  );

  // Auto-fill macros from the recommendation as long as the user hasn't manually edited them
  useEffect(() => {
    if (!recommendation || macrosTouched.current) return;
    setCalories(String(recommendation.calories));
    setProtein(String(recommendation.protein));
    setCarbs(String(recommendation.carbs));
    setFat(String(recommendation.fat));
  }, [recommendation]);

  const onMacroChange = (setter: (v: string) => void) => (v: string) => {
    macrosTouched.current = true;
    setter(v);
  };

  const canContinue = useMemo(() => {
    switch (step) {
      case 1: {
        if (gender === null) return false;
        if (activity === null) return false;
        const a = Number(age);
        const h = Number(height);
        const w = Number(weight);
        return (
          age !== '' && Number.isInteger(a) && a >= 13 && a <= 100 &&
          height !== '' && h >= 100 && h <= 250 &&
          weight !== '' && w >= 30 && w <= 300
        );
      }
      case 2: {
        const cal = Number(calories);
        const pro = Number(protein);
        const car = Number(carbs);
        const f = Number(fat);
        const wa = Number(water);
        const cr = Number(creatine);
        const gw = Number(goalWeight);
        return (
          cal > 0 && pro > 0 && car > 0 && f > 0 &&
          wa > 0 && cr > 0 &&
          goalWeight !== '' && gw >= 30 && gw <= 300
        );
      }
      default:
        return false;
    }
  }, [step, gender, activity, age, height, weight, calories, protein, carbs, fat, water, creatine, goalWeight]);

  const handleFinish = useCallback(async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        gender: gender!,
        age: Number(age),
        height: Number(height),
        starting_weight: Number(weight),
        goal_weight: Number(goalWeight),
      });
      await updateGoals(profile.id, {
        calorie_goal: Number(calories),
        protein_goal: Number(protein),
        carbs_goal: Number(carbs),
        fat_goal: Number(fat),
      });
      await updateSupplementGoals(profile.id, {
        water_goal: Number(water),
        creatine_goal: Number(creatine),
      });
    } finally {
      setSaving(false);
    }
  }, [
    profile, saving, gender, age, height, weight,
    calories, protein, carbs, fat,
    water, creatine, goalWeight,
    updateProfile, updateGoals, updateSupplementGoals,
  ]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.detailsStack}>
            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderCard, gender === 'male' && styles.genderCardSelected]}
                  onPress={() => setGender('male')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="male"
                    size={ms(28)}
                    color={gender === 'male' ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.genderLabel, gender === 'male' && styles.genderLabelSelected]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderCard, gender === 'female' && styles.genderCardSelected]}
                  onPress={() => setGender('female')}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="female"
                    size={ms(28)}
                    color={gender === 'female' ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.genderLabel, gender === 'female' && styles.genderLabelSelected]}>
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Age */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Age</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="e.g. 24"
                  placeholderTextColor={colors.textTertiary}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>yrs</Text>
                </View>
              </View>
            </View>

            {/* Height */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Height</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="e.g. 178"
                  placeholderTextColor={colors.textTertiary}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>cm</Text>
                </View>
              </View>
            </View>

            {/* Weight */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Weight</Text>
              <View style={styles.inputWithUnit}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="e.g. 75"
                  placeholderTextColor={colors.textTertiary}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  maxLength={5}
                />
                <View style={styles.unitBadge}>
                  <Text style={styles.unitBadgeText}>kg</Text>
                </View>
              </View>
            </View>

            {/* Activity level */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Activity level</Text>
              <View style={styles.activityList}>
                {ACTIVITY_OPTIONS.map((opt) => {
                  const selected = activity === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.activityCard, selected && styles.activityCardSelected]}
                      onPress={() => setActivity(opt.key)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.activityTextWrap}>
                        <Text style={[styles.activityLabel, selected && styles.activityLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.activityDescription}>{opt.description}</Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={ms(20)} color={colors.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.detailsStack}>
            {recommendation && (
              <View style={styles.recBanner}>
                <Ionicons
                  name={
                    recommendation.mode === 'cut'
                      ? 'trending-down'
                      : recommendation.mode === 'bulk'
                      ? 'trending-up'
                      : 'remove'
                  }
                  size={ms(18)}
                  color={colors.accent}
                />
                <Text style={styles.recBannerText}>
                  {recommendation.mode === 'cut'
                    ? 'Cutting plan — calorie deficit to reach your goal weight.'
                    : recommendation.mode === 'bulk'
                    ? 'Lean bulk plan — calorie surplus to reach your goal weight.'
                    : 'Maintenance plan — calories balanced for your current weight.'}
                </Text>
              </View>
            )}

            <View>
              <Text style={styles.sectionHeading}>Body</Text>
              <View style={styles.goalsGrid}>
                <View style={styles.goalItem}>
                  <Text style={styles.goalLabel}>Goal weight</Text>
                  <View style={styles.inputWithUnit}>
                    <TextInput
                      style={[styles.input, styles.inputFlex, styles.goalInput]}
                      placeholder="e.g. 72"
                      placeholderTextColor={colors.textTertiary}
                      value={goalWeight}
                      onChangeText={setGoalWeight}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                    <View style={styles.unitBadge}>
                      <Text style={styles.unitBadgeText}>kg</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.sectionHeading}>Nutrition</Text>
              <View style={styles.goalsGrid}>
                {([
                  { label: 'Calories', unit: 'kcal', value: calories, setter: onMacroChange(setCalories), kb: 'number-pad' as const, max: 5 },
                  { label: 'Protein', unit: 'g', value: protein, setter: onMacroChange(setProtein), kb: 'number-pad' as const, max: 5 },
                  { label: 'Carbs', unit: 'g', value: carbs, setter: onMacroChange(setCarbs), kb: 'number-pad' as const, max: 5 },
                  { label: 'Fat', unit: 'g', value: fat, setter: onMacroChange(setFat), kb: 'number-pad' as const, max: 5 },
                ]).map((item) => (
                  <View key={item.label} style={styles.goalItem}>
                    <Text style={styles.goalLabel}>{item.label}</Text>
                    <View style={styles.inputWithUnit}>
                      <TextInput
                        style={[styles.input, styles.inputFlex, styles.goalInput]}
                        value={item.value}
                        onChangeText={item.setter}
                        keyboardType={item.kb}
                        maxLength={item.max}
                      />
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>{item.unit}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text style={styles.sectionHeading}>Supplements</Text>
              <View style={styles.goalsGrid}>
                {([
                  { label: 'Water', unit: 'ml', value: water, setter: setWater, kb: 'number-pad' as const, max: 6 },
                  { label: 'Creatine', unit: 'g', value: creatine, setter: setCreatine, kb: 'decimal-pad' as const, max: 4 },
                ]).map((item) => (
                  <View key={item.label} style={styles.goalItem}>
                    <Text style={styles.goalLabel}>{item.label}</Text>
                    <View style={styles.inputWithUnit}>
                      <TextInput
                        style={[styles.input, styles.inputFlex, styles.goalInput]}
                        value={item.value}
                        onChangeText={item.setter}
                        keyboardType={item.kb}
                        maxLength={item.max}
                      />
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitBadgeText}>{item.unit}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS;
  const { title, subtitle } = STEP_CONFIG[step - 1];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + sw(20) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: '100%', transformOrigin: 'left' }, progressStyle]} />
      </View>

      {/* Back button */}
      <View style={styles.navRow}>
        {step > 1 ? (
          <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <Text style={styles.stepIndicator}>{step} / {TOTAL_STEPS}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title & subtitle */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Step content with animation */}
        <Animated.View style={contentStyle}>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      {/* Continue / Finish button */}
      <View style={{ paddingBottom: insets.bottom + sw(16) }}>
        <TouchableOpacity
          style={[styles.button, (!canContinue || saving) && styles.buttonDisabled]}
          onPress={isLastStep ? handleFinish : goNext}
          disabled={!canContinue || saving}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : isLastStep ? 'Finish' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: sw(24),
    },

    /* ─── Progress bar ─────────────────────────────────────── */
    progressTrack: {
      height: sw(4),
      backgroundColor: colors.cardBorder,
      borderRadius: sw(2),
      marginBottom: sw(16),
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: sw(2),
    },

    /* ─── Navigation row ───────────────────────────────────── */
    navRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: sw(24),
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
    },
    backText: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
    },
    stepIndicator: {
      color: colors.textTertiary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },

    /* ─── Typography ───────────────────────────────────────── */
    title: {
      color: colors.textPrimary,
      fontSize: ms(28),
      lineHeight: ms(33),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      marginBottom: sw(8),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
      marginBottom: sw(28),
    },

    scrollContent: {
      flexGrow: 1,
      paddingBottom: sw(24),
    },

    /* ─── Combined details step ────────────────────────────── */
    detailsStack: {
      gap: sw(20),
    },
    fieldGroup: {
      gap: sw(8),
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },

    /* ─── Gender ───────────────────────────────────────────── */
    genderRow: {
      flexDirection: 'row',
      gap: sw(12),
    },
    genderCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: sw(14),
      paddingVertical: sw(18),
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    genderCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    genderLabel: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    genderLabelSelected: {
      color: colors.textPrimary,
    },

    /* ─── Input fields ─────────────────────────────────────── */
    input: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(14),
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    inputFlex: {
      flex: 1,
    },
    inputWithUnit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
    },
    unitBadge: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingHorizontal: sw(14),
      paddingVertical: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    unitBadgeText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },

    /* ─── Activity selector ────────────────────────────────── */
    activityList: {
      gap: sw(8),
    },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      backgroundColor: colors.card,
      borderRadius: sw(12),
      paddingVertical: sw(12),
      paddingHorizontal: sw(14),
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    activityCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    activityTextWrap: {
      flex: 1,
      gap: sw(2),
    },
    activityLabel: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    activityLabelSelected: {
      color: colors.textPrimary,
    },
    activityDescription: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },

    /* ─── Recommendation banner ────────────────────────────── */
    recBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      padding: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    recBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },

    /* ─── Goals steps ──────────────────────────────────────── */
    sectionHeading: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      marginBottom: sw(12),
    },
    goalsGrid: {
      gap: sw(14),
    },
    goalItem: {
      gap: sw(6),
    },
    goalLabel: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    goalInput: {
      textAlign: 'left',
    },

    /* ─── Button ───────────────────────────────────────────── */
    button: {
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      padding: sw(16),
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
    },
  });
