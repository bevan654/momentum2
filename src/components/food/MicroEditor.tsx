import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useThemeStore } from '../../stores/useThemeStore';

export interface MicroEditorRow {
  key: string;
  label: string;
  unit: string;
  value: string;
}

interface Props {
  rows: MicroEditorRow[];
  onChange: (key: string, value: string) => void;
}

const MicroInputRow = React.memo(function MicroInputRow({
  row, first, onChange, styles, placeholderColor, keyboard,
}: {
  row: MicroEditorRow;
  first: boolean;
  onChange: (key: string, value: string) => void;
  styles: ReturnType<typeof createStyles>;
  placeholderColor: string;
  keyboard: 'dark' | 'light';
}) {
  return (
    <View style={[styles.row, !first && styles.divider]}>
      <Text style={styles.label}>{row.label}</Text>
      <TextInput
        style={styles.input}
        value={row.value}
        onChangeText={(v) => onChange(row.key, v.replace(',', '.'))}
        keyboardType="numeric"
        keyboardAppearance={keyboard}
        placeholder="0"
        placeholderTextColor={placeholderColor}
        accessibilityLabel={`${row.label} in ${row.unit}`}
      />
      <Text style={styles.unit}>{row.unit}</Text>
    </View>
  );
});

/** Editable micronutrient list (one row per nutrient, value + unit). Renders nothing when empty. */
function MicroEditor({ rows, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const keyboard = useThemeStore((s) => s.mode) === 'dark' ? 'dark' : 'light';
  if (rows.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.title}>Micronutrients</Text>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <MicroInputRow
            key={r.key}
            row={r}
            first={i === 0}
            onChange={onChange}
            styles={styles}
            placeholderColor={colors.textTertiary}
            keyboard={keyboard}
          />
        ))}
      </View>
    </View>
  );
}

export default React.memo(MicroEditor);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    group: {
      gap: sw(8),
    },
    title: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    card: {
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(14),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      minHeight: sw(46),
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    label: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    input: {
      minWidth: sw(60),
      textAlign: 'right',
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.semiBold,
      paddingVertical: sw(8),
    },
    unit: {
      width: sw(34),
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
    },
  });
