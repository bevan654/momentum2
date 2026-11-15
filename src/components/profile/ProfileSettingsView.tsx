import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import SupplementConfigEditor from './SupplementConfigEditor';
import MacroGoalEditor from './MacroGoalEditor';
import MicroGoalEditor from './MicroGoalEditor';
import DeleteAccountModal from './DeleteAccountModal';
import { SectionHeader, LinkRow } from './settings/SettingsPrimitives';
import { NutritionGoalsEditor } from './settings/NutritionGoalsEditor';
import { BodyStatsEditor } from './settings/BodyStatsEditor';
import { ProgressChartsToggle } from './settings/SettingsToggles';
import { LabTrackersSection, LabTrackersEditor } from './settings/LabTrackersEditor';

interface Props {
  onBack: () => void;
}

export default function ProfileSettingsView({ onBack }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const openDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeleteVisible(true);
  }, []);
  const closeDelete = useCallback(() => setDeleteVisible(false), []);

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

        {/* Workouts */}
        <SectionHeader title="Workouts" />
        <View style={styles.card}>
          <ProgressChartsToggle />
        </View>

        {/* 6. Lab Trackers */}
        <LabTrackersSection />
        <View style={styles.card}>
          <LabTrackersEditor />
        </View>

        {/* 7. Support */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <LinkRow label="Privacy Policy" url="https://momentumfitness.vercel.app/privacy" />
          <LinkRow label="Terms of Service" url="https://momentumfitness.vercel.app/terms" />
          <LinkRow label="Contact Us" url="mailto:support@momentum.app" last />
        </View>

        {/* 8. Danger Zone — account deletion (App Store 5.1.1(v)) */}
        <SectionHeader title="Danger Zone" />
        <TouchableOpacity
          style={[styles.card, styles.dangerRow, { borderColor: colors.accentRed + '55' }]}
          onPress={openDelete}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={ms(20)} color={colors.accentRed} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.accentRed }]}>Delete Account</Text>
            <Text style={styles.dangerHint}>Permanently delete your account and data</Text>
          </View>
          <Ionicons name="chevron-forward" size={ms(18)} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={{ height: sw(40) }} />
      </ScrollView>
      <DeleteAccountModal visible={deleteVisible} onClose={closeDelete} />
    </KeyboardAvoidingView>
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
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(6),
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
  },
  dangerHint: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.regular,
    marginTop: sw(2),
  },
});
