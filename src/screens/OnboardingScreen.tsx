import React, { useState, useMemo, useCallback } from 'react';
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

const TOTAL_STEPS = 5;

const STEP_CONFIG = [
  { title: 'What is your gender?', subtitle: 'This helps us personalise your experience' },
  { title: 'How old are you?', subtitle: 'Age is used for accurate fitness calculations' },
  { title: 'What is your height?', subtitle: 'Enter your height in centimetres' },
  { title: 'What is your weight?', subtitle: 'Enter your current weight in kilograms' },
  { title: 'Set your nutrition goals', subtitle: 'Adjust or keep the recommended defaults' },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { profile, updateProfile } = useAuthStore();
  const updateGoals = useFoodLogStore((s) => s.updateGoals);

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

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return gender !== null;
      case 2: {
        const n = Number(age);
        return age !== '' && Number.isInteger(n) && n >= 13 && n <= 100;
      }
      case 3: {
        const n = Number(height);
        return height !== '' && n >= 100 && n <= 250;
      }
      case 4: {
        const n = Number(weight);
        return weight !== '' && n >= 30 && n <= 300;
      }
      case 5: {
        const cal = Number(calories);
        const pro = Number(protein);
        const car = Number(carbs);
        const f = Number(fat);
        return cal > 0 && pro > 0 && car > 0 && f > 0;
      }
      default:
        return false;
    }
  }, [step, gender, age, height, weight, calories, protein, carbs, fat]);

  const handleFinish = useCallback(async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        gender: gender!,
        age: Number(age),
        height: Number(height),
        starting_weight: Number(weight),
      });
      await updateGoals(profile.id, {
        calorie_goal: Number(calories),
        protein_goal: Number(protein),
        carbs_goal: Number(carbs),
        fat_goal: Number(fat),
      });
    } finally {
      setSaving(false);
    }
  }, [profile, saving, gender, age, height, weight, calories, protein, carbs, fat, updateProfile, updateGoals]);

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[styles.genderCard, gender === 'male' && styles.genderCardSelected]}
              onPress={() => setGender('male')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="male"
                size={ms(40)}
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
                size={ms(40)}
                color={gender === 'female' ? colors.accent : colors.textSecondary}
              />
              <Text style={[styles.genderLabel, gender === 'female' && styles.genderLabelSelected]}>
                Female
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="Age"
              placeholderTextColor={colors.textTertiary}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
            />
            <Text style={styles.unitHint}>years (13–100)</Text>
          </View>
        );

      case 3:
        return (
          <View style={styles.inputGroup}>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Height"
                placeholderTextColor={colors.textTertiary}
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                maxLength={3}
                autoFocus
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>cm</Text>
              </View>
            </View>
            <Text style={styles.unitHint}>100–250 cm</Text>
          </View>
        );

      case 4:
        return (
          <View style={styles.inputGroup}>
            <View style={styles.inputWithUnit}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                placeholder="Weight"
                placeholderTextColor={colors.textTertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                maxLength={5}
                autoFocus
              />
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>kg</Text>
              </View>
            </View>
            <Text style={styles.unitHint}>30–300 kg</Text>
          </View>
        );

      case 5:
        return (
          <View style={styles.goalsGrid}>
            {([
              { label: 'Calories', unit: 'kcal', value: calories, setter: setCalories },
              { label: 'Protein', unit: 'g', value: protein, setter: setProtein },
              { label: 'Carbs', unit: 'g', value: carbs, setter: setCarbs },
              { label: 'Fat', unit: 'g', value: fat, setter: setFat },
            ] as const).map((item) => (
              <View key={item.label} style={styles.goalItem}>
                <Text style={styles.goalLabel}>{item.label}</Text>
                <View style={styles.inputWithUnit}>
                  <TextInput
                    style={[styles.input, styles.inputFlex, styles.goalInput]}
                    value={item.value}
                    onChangeText={item.setter}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitBadgeText}>{item.unit}</Text>
                  </View>
                </View>
              </View>
            ))}
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
      marginBottom: sw(32),
    },

    scrollContent: {
      flexGrow: 1,
    },

    /* ─── Gender step ──────────────────────────────────────── */
    genderRow: {
      flexDirection: 'row',
      gap: sw(14),
    },
    genderCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: sw(16),
      paddingVertical: sw(32),
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(12),
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    genderCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    genderLabel: {
      color: colors.textSecondary,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.semiBold,
    },
    genderLabelSelected: {
      color: colors.textPrimary,
    },

    /* ─── Input fields ─────────────────────────────────────── */
    inputGroup: {
      gap: sw(8),
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(16),
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
      paddingVertical: sw(14),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    unitBadgeText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    unitHint: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      marginTop: sw(4),
    },

    /* ─── Nutrition goals step ─────────────────────────────── */
    goalsGrid: {
      gap: sw(16),
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
