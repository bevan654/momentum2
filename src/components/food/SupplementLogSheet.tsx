import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Overlay from '../ui/Overlay';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, sh } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import QuickAmountsEditor from './QuickAmountsEditor';

/** One logged amount (a supplement entry, or a protein powder add with the powder's name). */
export interface LogSheetEntry {
  id: string;
  amount: number;
  created_at: string;
  /** Shown after the amount, e.g. the protein powder's name; deleting it also removes its diary snack. */
  note?: string;
}

interface Props {
  visible: boolean;
  label: string;
  unit: string;
  color: string;
  entries: LogSheetEntry[];
  onDelete: (entry: LogSheetEntry) => void;
  /** Quick amounts (the first is the tile's one-tap amount), edited here. */
  amounts: number[];
  onAmountsChange: (amounts: number[]) => void;
  /** Log an amount now; omitted on past days. */
  onLogAmount?: (amount: number) => void;
  onClose: () => void;
  /** After the fade-out finishes (safe to clear the content then). */
  onClosed?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Water or a supplement: its quick amounts (editable), and the day's log with delete for each entry. */
function SupplementLogSheet({ visible, label, unit, color, entries, onDelete, amounts, onAmountsChange, onLogAmount, onClose, onClosed }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // The bin icon is small and next to the list: ask first, so a stray tap can't delete an entry.
  const confirmDelete = useCallback((e: LogSheetEntry) => {
    const amount = `${Math.round(Number(e.amount) * 100) / 100} ${unit}`;
    Alert.alert(`Delete ${amount} of ${e.note || label}?`, e.note ? "It's also removed from your food diary." : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(e) },
    ]);
  }, [unit, label, onDelete]);

  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose} onDismiss={onClosed}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.title}>{label}</Text>
          </View>

          {amounts.length > 0 && (
            <QuickAmountsEditor amounts={amounts} unit={unit} color={color} onChange={onAmountsChange} onLog={onLogAmount} />
          )}

          <Text style={styles.sectionLabel}>This day</Text>

          {entries.length === 0 ? (
            <Text style={styles.empty}>Nothing logged this day.</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {entries.map((e, i) => (
                <View key={e.id} style={[styles.row, i > 0 && styles.divider]}>
                  <Text style={styles.amount} numberOfLines={1}>
                    {Math.round(Number(e.amount) * 100) / 100} {unit}
                    {e.note ? <Text style={styles.note}> · {e.note}</Text> : null}
                  </Text>
                  <Text style={styles.time}>{formatTime(e.created_at)}</Text>
                  <TouchableOpacity
                    onPress={() => confirmDelete(e)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${e.amount} ${unit} of ${label}`}
                  >
                    <Ionicons name="trash-outline" size={ms(16)} color={colors.accentRed} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Overlay>
  );
}

export default React.memo(SupplementLogSheet);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    sectionLabel: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: sw(4),
    },
    backdrop: {
      flex: 1,
      backgroundColor: colors.backdrop + '99',
      justifyContent: 'center',
      paddingHorizontal: sw(28),
    },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: sw(20),
      padding: sw(18),
      gap: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    dot: {
      width: sw(8),
      height: sw(8),
      borderRadius: sw(4),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      paddingVertical: sw(8),
    },
    list: {
      maxHeight: sh(220),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingVertical: sw(10),
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    amount: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    note: {
      color: colors.textSecondary,
      fontFamily: Fonts.medium,
    },
    time: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    closeBtn: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingVertical: sw(12),
      alignItems: 'center',
    },
    closeText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
  });
