import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Linking, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useProteinPowderStore } from '../../stores/useProteinPowderStore';
import SupplementConfigEditor from './SupplementConfigEditor';
import MacroGoalEditor from './MacroGoalEditor';
import MicroGoalEditor from './MicroGoalEditor';

interface Props {
  onBack: () => void;
}

export default function ProfileSettingsView({ onBack }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? sw(90) : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={ms(22)} color={colors.textPrimary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>

        {/* 1. Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <View style={styles.goalRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Text style={styles.usernameDisplay}>{profile?.username || '—'}</Text>
          </View>
        </View>

        {/* 2. Daily Nutrition Goals */}
        <SectionHeader title="Daily Nutrition Goals" />
        <View style={styles.card}>
          <NutritionGoalsEditor />
        </View>

        {/* 3. Macronutrient Goals */}
        <SectionHeader title="Macronutrient Goals" />
        <View style={styles.card}>
          <MacroGoalEditor />
        </View>

        {/* 4. Micronutrient Goals */}
        <SectionHeader title="Micronutrient Goals" />
        <View style={styles.card}>
          <MicroGoalEditor />
        </View>

        {/* 5. Body Stats */}
        <SectionHeader title="Body Stats" />
        <View style={styles.card}>
          <BodyStatsEditor />
        </View>

        {/* 6. Supplements */}
        <SectionHeader title="Supplements" />
        <View style={styles.card}>
          <SupplementConfigEditor />
        </View>

        {/* 7. Protein Powder */}
        <SectionHeader title="Protein Powder" />
        <View style={styles.card}>
          <ProteinPowderToggle />
        </View>

        {/* 8. Support */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <LinkRow label="Privacy Policy" url="https://momentum.app/privacy" />
          <LinkRow label="Terms of Service" url="https://momentum.app/terms" />
          <LinkRow label="Contact Us" url="mailto:support@momentum.app" last />
        </View>

        <View style={{ height: sw(40) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Section Header ─────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

/* ─── Nutrition Goals Editor ─────────────────────────────── */

function NutritionGoalsEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);

  const [cal, setCal] = useState(String(goals.calorie_goal));
  const [waterText, setWaterText] = useState(String(waterGoal));

  const handleCalBlur = useCallback(() => {
    if (!userId) return;
    const num = parseInt(cal, 10);
    if (!isNaN(num) && num > 0) {
      updateGoals(userId, { calorie_goal: num });
    } else {
      setCal(String(goals.calorie_goal));
    }
  }, [userId, cal, goals.calorie_goal, updateGoals]);

  const handleWaterBlur = useCallback(() => {
    if (!userId) return;
    const val = parseInt(waterText, 10);
    if (!isNaN(val) && val > 0) {
      updateSupplementGoals(userId, { water_goal: val });
    } else {
      setWaterText(String(waterGoal));
    }
  }, [userId, waterText, waterGoal, updateSupplementGoals]);

  return (
    <View>
      <GoalRow label="Calories" value={cal} onChange={setCal} onBlur={handleCalBlur} unit="kcal" />
      <GoalRow label="Water" value={waterText} onChange={setWaterText} onBlur={handleWaterBlur} unit="ml" />
    </View>
  );
}

function GoalRow({ label, value, onChange, onBlur, unit }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; unit: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.goalRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

/* ─── Body Stats Editor ──────────────────────────────────── */

function BodyStatsEditor() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [weight, setWeight] = useState(String(profile?.starting_weight || ''));
  const [goalWeight, setGoalWeight] = useState(String(profile?.goal_weight || ''));

  const handleWeightBlur = useCallback(() => {
    const val = parseFloat(weight);
    if (!isNaN(val) && val > 0) {
      updateProfile({ starting_weight: val });
    } else {
      setWeight(String(profile?.starting_weight || ''));
    }
  }, [weight, profile, updateProfile]);

  const handleGoalWeightBlur = useCallback(() => {
    const val = parseFloat(goalWeight);
    if (!isNaN(val) && val > 0) {
      updateProfile({ goal_weight: val });
    } else {
      setGoalWeight(String(profile?.goal_weight || ''));
    }
  }, [goalWeight, profile, updateProfile]);

  return (
    <View>
      <GoalRow label="Starting Weight" value={weight} onChange={setWeight} onBlur={handleWeightBlur} unit="kg" />
      <GoalRow label="Goal Weight" value={goalWeight} onChange={setGoalWeight} onBlur={handleGoalWeightBlur} unit="kg" />
    </View>
  );
}

/* ─── Protein Powder Toggle ─────────────────────────────── */

function ProteinPowderToggle() {
  const userId = useAuthStore((s) => s.user?.id);
  const enabled = useProteinPowderStore((s) => s.enabled);
  const setEnabled = useProteinPowderStore((s) => s.setEnabled);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleToggle = useCallback((value: boolean) => {
    if (userId) setEnabled(userId, value);
  }, [userId, setEnabled]);

  return (
    <View style={styles.switchRow}>
      <Text style={styles.fieldLabel}>Enable Protein Powder</Text>
      <Switch
        value={enabled}
        onValueChange={handleToggle}
        trackColor={{ false: colors.surface, true: colors.accent + '60' }}
        thumbColor={enabled ? colors.accent : colors.textTertiary}
      />
    </View>
  );
}

/* ─── Shared Components ──────────────────────────────────── */

function LinkRow({ label, url, last }: { label: string; url: string; last?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.linkRow, !last && styles.linkRowBorder]}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="open-outline" size={ms(16)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: sw(20),
    paddingBottom: sw(40),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(16),
  },
  backText: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: sw(20),
    marginBottom: sw(8),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    padding: sw(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  usernameDisplay: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  textInput: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(12),
    paddingVertical: sw(8),
    marginTop: sw(8),
  },
  errorText: {
    color: colors.accentRed,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    marginTop: sw(4),
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(6),
  },
  goalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  goalInput: {
    width: sw(70),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
    textAlign: 'center',
  },
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    width: sw(28),
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(8),
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(12),
  },
  linkRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  linkText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
});
