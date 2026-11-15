import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Overlay from '../ui/Overlay';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, sh } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { SupplementEntry } from '../../stores/useSupplementStore';

interface Props {
  visible: boolean;
  label: string;
  unit: string;
  color: string;
  entries: SupplementEntry[];
  onDelete: (entry: SupplementEntry) => void;
  onClose: () => void;
  /** After the fade-out finishes (safe to clear the content then). */
  onClosed?: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** The day's log for one of water / a supplement, with delete for each entry. */
function SupplementLogSheet({ visible, label, unit, color, entries, onDelete, onClose, onClosed }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose} onDismiss={onClosed}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.title}>{label}</Text>
          </View>

          {entries.length === 0 ? (
            <Text style={styles.empty}>Nothing logged this day.</Text>
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {entries.map((e, i) => (
                <View key={e.id} style={[styles.row, i > 0 && styles.divider]}>
                  <Text style={styles.amount}>
                    {Math.round(Number(e.amount) * 10) / 10} {unit}
                  </Text>
                  <Text style={styles.time}>{formatTime(e.created_at)}</Text>
                  <TouchableOpacity
                    onPress={() => onDelete(e)}
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
    </Overlay>
  );
}

export default React.memo(SupplementLogSheet);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
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
      maxHeight: sh(320),
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
