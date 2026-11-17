import React, { useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

/* ─── Section Header ─────────────────────────────────────── */

export function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function GoalRow({ label, value, onChange, onBlur, unit }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; unit: string }) {
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

/* ─── Shared Components ──────────────────────────────────── */

export function LinkRow({ label, url, last }: { label: string; url: string; last?: boolean }) {
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
  fieldLabel: {
    color: colors.textPrimary,
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
