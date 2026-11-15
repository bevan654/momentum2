import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

/**
 * One goal in the macro / micronutrient / supplement editors: icon, name, an editable number, its
 * unit and a remove button. The editor decides what a typed value means when the field loses focus.
 */
interface Props {
  icon: string;
  color: string;
  label: string;
  unit: string;
  /** The saved goal. */
  value: number;
  keyboardType: KeyboardTypeOptions;
  /** Width of the unit column (micronutrient units are longer). */
  unitWidth?: number;
  /** Reset the text whenever the saved goal changes (the supplement editor doesn't). */
  followValue?: boolean;
  /** Called with the typed text on blur; returns the text to show afterwards. */
  onCommit: (text: string) => string;
  onRemove: () => void;
}

function GoalEditorRow({ icon, color, label, unit, value, keyboardType, unitWidth, followValue = true, onCommit, onRemove }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createGoalEditorStyles(colors), [colors]);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (followValue) setText(String(value));
  }, [value, followValue]);

  const handleBlur = useCallback(() => setText(onCommit(text)), [onCommit, text]);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={ms(13)} color={color} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={[styles.unitText, unitWidth != null && { width: unitWidth }]}>{unit}</Text>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
        <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(GoalEditorRow);

/** Styles the three goal editors share: the row, plus the "Add …" toggle and the preset rows under it. */
export const createGoalEditorStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    gap: sw(8),
  },
  rowIcon: {
    width: sw(26),
    height: sw(26),
    borderRadius: sw(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  goalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  input: {
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
    width: sw(24),
  },
  removeBtn: {
    marginLeft: sw(2),
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(12),
    marginTop: sw(4),
  },
  addText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(10),
    paddingHorizontal: sw(4),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  presetIcon: {
    width: sw(28),
    height: sw(28),
    borderRadius: sw(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  presetDefault: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
});
