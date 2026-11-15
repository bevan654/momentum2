import React, { useMemo } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useProfileSettingsStore } from '../../../stores/useProfileSettingsStore';

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
