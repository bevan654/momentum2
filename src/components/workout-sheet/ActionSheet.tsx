import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import Overlay from '../ui/Overlay';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

export interface ActionSheetItem {
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
  actions: ActionSheetItem[];
  onClose: () => void;
}

/** Bottom action sheet for "⋯" menus (exercise cards, workout header). */
function ActionSheet({ visible, title, actions, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // The tapped action runs once this sheet has finished animating out, so
  // whatever it opens (e.g. the exercise picker for "Replace") appears on top
  // of a settled screen rather than mid-transition.
  const pendingRef = useRef<(() => void) | null>(null);
  const runPending = useCallback(() => {
    const fn = pendingRef.current;
    pendingRef.current = null;
    fn?.();
  }, []);

  return (
    <Overlay
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={runPending}
    >
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
                accessibilityRole="button"
                accessibilityState={{ disabled: !!a.disabled }}
                onPress={() => {
                  pendingRef.current = a.onPress;
                  onClose();
                }}
              >
                <Ionicons name={a.icon} size={ms(18)} color={tint} />
                <Text style={[styles.rowText, { color: tint }]}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

export default React.memo(ActionSheet);

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
