import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useThemeStore } from '../../stores/useThemeStore';
import { sanitizeDecimal } from './decimalInput';

const MAX_AMOUNTS = 6;

function formatAmount(v: number): string {
  return v % 1 === 0 ? String(v) : String(Math.round(v * 100) / 100);
}

interface Props {
  amounts: number[];
  unit: string;
  color: string;
  /** Save the new list. The first amount is what one tap on the tile adds. */
  onChange: (amounts: number[]) => void;
  /** Log an amount now; omitted on past days. */
  onLog?: (amount: number) => void;
}

/**
 * The amounts for water or a supplement: the first is the one-tap amount on the tile, the
 * others are quick picks. Tap one to log it, hold one to make it the one-tap amount, × to remove,
 * and type a new one to add it.
 */
function QuickAmountsEditor({ amounts, unit, color, onChange, onLog }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const [draft, setDraft] = useState('');

  const add = useCallback(() => {
    const n = Number(draft);
    if (!(n > 0)) return;
    setDraft('');
    if (amounts.includes(n)) return;
    Haptics.selectionAsync();
    onChange([...amounts, n].slice(0, MAX_AMOUNTS));
  }, [draft, amounts, onChange]);

  const remove = useCallback((n: number) => {
    if (amounts.length <= 1) return; // the tile always needs a one-tap amount
    Haptics.selectionAsync();
    onChange(amounts.filter((a) => a !== n));
  }, [amounts, onChange]);

  const makeOneTap = useCallback((n: number) => {
    if (amounts[0] === n) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange([n, ...amounts.filter((a) => a !== n)]);
  }, [amounts, onChange]);

  const full = amounts.length >= MAX_AMOUNTS;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Quick amounts</Text>
      <View style={styles.chips}>
        {amounts.map((n, i) => (
          <Pressable
            key={n}
            style={[styles.chip, i === 0 && { borderColor: color }]}
            onPress={onLog ? () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLog(n); } : undefined}
            onLongPress={() => makeOneTap(n)}
            accessibilityRole="button"
            accessibilityLabel={`${formatAmount(n)} ${unit}${i === 0 ? ', one-tap amount' : ''}`}
            accessibilityHint={`${onLog ? 'Logs this amount. ' : ''}Long press to make it the one-tap amount`}
          >
            {i === 0 && <Ionicons name="flash" size={ms(11)} color={color} />}
            <Text style={styles.chipText}>+{formatAmount(n)} {unit}</Text>
            {amounts.length > 1 && (
              <Pressable onPress={() => remove(n)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${formatAmount(n)} ${unit}`}>
                <Ionicons name="close" size={ms(13)} color={colors.textTertiary} />
              </Pressable>
            )}
          </Pressable>
        ))}
      </View>
      {!full && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={(v) => setDraft(sanitizeDecimal(v))}
            placeholder={`New amount (${unit})`}
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            keyboardAppearance={isDark ? 'dark' : 'light'}
            returnKeyType="done"
            onSubmitEditing={add}
            accessibilityLabel={`New amount in ${unit}`}
          />
          <Pressable
            style={[styles.addBtn, !(Number(draft) > 0) && styles.addBtnDisabled]}
            onPress={add}
            disabled={!(Number(draft) > 0)}
            accessibilityRole="button"
            accessibilityLabel="Add amount"
          >
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.hint}>
        {onLog ? 'Tap to log. ' : ''}Hold one to make it what a tap on the tile adds (⚡).
      </Text>
    </View>
  );
}

export default React.memo(QuickAmountsEditor);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: sw(8),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(6),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      paddingHorizontal: sw(10),
      paddingVertical: sw(7),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    chipText: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.semiBold,
    },
    addRow: {
      flexDirection: 'row',
      gap: sw(8),
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      paddingHorizontal: sw(12),
      height: sw(40),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    addBtn: {
      paddingHorizontal: sw(16),
      borderRadius: sw(10),
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnDisabled: {
      opacity: 0.4,
    },
    addText: {
      color: colors.textOnAccent,
      fontSize: ms(13),
      fontFamily: Fonts.bold,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
  });
