import React, { useMemo } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import type { ProteinPowder } from '../../stores/useProteinPowderStore';

const POWDER_COLOR = '#86EFAC';

interface Props {
  visible: boolean;
  onClose: () => void;
  powders: ProteinPowder[];
  onSelect: (powder: ProteinPowder) => void;
}

export default function PowderSelectSheet({ visible, onClose, powders, onSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Powder</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={ms(22)} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Powder list */}
          {powders.map((powder, index) => (
            <TouchableOpacity
              key={powder.id}
              style={[styles.powderRow, index < powders.length - 1 && styles.powderRowBorder]}
              onPress={() => onSelect(powder)}
              activeOpacity={0.7}
            >
              <View style={styles.powderIcon}>
                <Ionicons name="nutrition-outline" size={ms(16)} color={POWDER_COLOR} />
              </View>
              <View style={styles.powderInfo}>
                <Text style={styles.powderName}>{powder.name}</Text>
                <Text style={styles.powderMacros}>
                  {powder.calories} cal · {powder.protein}g P · {powder.carbs}g C · {powder.fat}g F
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={ms(16)} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}

          <View style={{ height: sw(20) }} />
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    paddingHorizontal: sw(20),
    paddingBottom: sw(34),
  },
  handleBar: {
    width: sw(36),
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    alignSelf: 'center',
    marginTop: sw(10),
    marginBottom: sw(6),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  powderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    paddingVertical: sw(14),
  },
  powderRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  powderIcon: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(10),
    backgroundColor: POWDER_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powderInfo: {
    flex: 1,
  },
  powderName: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
  powderMacros: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.regular,
  },
});
