import React, { useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export interface ExerciseAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  actions: ExerciseAction[];
  onClose: () => void;
}

/** Bottom action sheet for an exercise card's "⋯" menu. */
function ExerciseActionsSheet({ visible, title, actions, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + sw(12) }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {actions.map((a) => {
            const tint = a.destructive ? colors.accentRed : colors.textPrimary;
            return (
              <TouchableOpacity
                key={a.key}
                style={[styles.row, a.disabled && styles.rowDisabled]}
                disabled={a.disabled}
                activeOpacity={0.6}
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
              >
                <Ionicons name={a.icon} size={ms(18)} color={tint} />
                <Text style={[styles.rowText, { color: tint }]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(ExerciseActionsSheet);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    paddingHorizontal: sw(16),
    paddingTop: sw(8),
  },
  handle: {
    alignSelf: 'center',
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.cardBorder,
    marginBottom: sw(12),
  },
  title: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
    marginBottom: sw(6),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    paddingVertical: sw(13),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  rowDisabled: {
    opacity: 0.35,
  },
  rowText: {
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
});
