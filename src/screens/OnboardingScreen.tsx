import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { ScrollView as ScrollViewType } from 'react-native';
import {
  View,
  Text,
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
import { cleanUsernameInput, useUsernameAvailability } from '../hooks/useUsernameAvailability';
import DetailsStep from '../components/onboarding/DetailsStep';
import GoalsStep from '../components/onboarding/GoalsStep';
import { STEP_CONFIG, computeRecommendation, type ActivityKey } from '../components/onboarding/onboardingPlan';

const TOTAL_STEPS = 2;

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
  const [username, setUsername] = useState(profile?.username ?? '');
  const needsUsername = profile?.username == null;
  // Only checked for accounts without a username. An RPC error leaves the status 'idle' (blocks Continue).
  const usernameStatus = useUsernameAvailability(username, {
    enabled: needsUsername,
    initialStatus: profile?.username ? 'ok' : 'idle',
    errorStatus: 'idle',
  });

  // Tracks whether user has manually edited macros — if not, we auto-fill from TDEE
  const macrosTouched = useRef(false);
  const scrollRef = useRef<ScrollViewType | null>(null);

  // Reset scroll to top whenever the step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const onUsernameChange = (value: string) => {
    setUsername(cleanUsernameInput(value));
  };

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
        if (needsUsername && usernameStatus !== 'ok') return false;
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
  }, [step, needsUsername, usernameStatus, gender, activity, age, height, weight, calories, protein, carbs, fat, water, creatine, goalWeight]);

  const handleFinish = useCallback(async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        ...(needsUsername ? { username: username.trim() } : {}),
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
    profile, saving, needsUsername, username, gender, age, height, weight,
    calories, protein, carbs, fat,
    water, creatine, goalWeight,
    updateProfile, updateGoals, updateSupplementGoals,
  ]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <DetailsStep
            needsUsername={needsUsername}
            username={username}
            onUsernameChange={onUsernameChange}
            usernameStatus={usernameStatus}
            gender={gender}
            onGenderChange={setGender}
            age={age}
            onAgeChange={setAge}
            height={height}
            onHeightChange={setHeight}
            weight={weight}
            onWeightChange={setWeight}
            activity={activity}
            onActivityChange={setActivity}
          />
        );

      case 2:
        return (
          <GoalsStep
            recommendation={recommendation}
            goalWeight={goalWeight}
            onGoalWeightChange={setGoalWeight}
            calories={calories}
            onCaloriesChange={onMacroChange(setCalories)}
            protein={protein}
            onProteinChange={onMacroChange(setProtein)}
            carbs={carbs}
            onCarbsChange={onMacroChange(setCarbs)}
            fat={fat}
            onFatChange={onMacroChange(setFat)}
            water={water}
            onWaterChange={setWater}
            creatine={creatine}
            onCreatineChange={setCreatine}
          />
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
        ref={scrollRef}
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
