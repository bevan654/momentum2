import React, { useCallback, useMemo } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useProteinPowderStore } from '../../../stores/useProteinPowderStore';
import { useProfileSettingsStore } from '../../../stores/useProfileSettingsStore';

/* ─── Protein Powder Toggle ─────────────────────────────── */

export function ProteinPowderToggle() {
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
        trackColor={{ false: colors.accentRed + '60', true: colors.accentGreen + '60' }}
        thumbColor={enabled ? colors.accentGreen : colors.accentRed}
      />
    </View>
  );
}

/* ─── Progress Charts Toggle ────────────────────────────── */

export function ProgressChartsToggle() {
  const enabled = useProfileSettingsStore((s) => s.showProgressCharts);
  const setEnabled = useProfileSettingsStore((s) => s.setShowProgressCharts);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.switchRow}>
      <Text style={styles.fieldLabel}>Show Progress Charts</Text>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ false: colors.accentRed + '60', true: colors.accentGreen + '60' }}
        thumbColor={enabled ? colors.accentGreen : colors.accentRed}
      />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(8),
  },
});
