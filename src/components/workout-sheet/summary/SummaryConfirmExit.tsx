import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Overlay from '../../ui/Overlay';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

/** "Don't forget to post!" dialog shown when closing a just-finished workout without sharing. */
function SummaryConfirmExit({ colors, onPost, onDiscard, onCancel }: {
  colors: ThemeColors;
  onPost: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Overlay
      visible
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.confirmExitOverlay}
        onPress={onCancel}
      >
        <Pressable style={styles.confirmExitCard} onPress={() => {}}>
          <View style={[styles.confirmExitIconWrap, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="paper-plane" size={ms(24)} color={colors.accent} />
          </View>
          <Text style={styles.confirmExitTitle}>Don't forget to post!</Text>
          <Text style={styles.confirmExitBody}>
            Your workout is saved. Share it to the feed so your friends can see your progress?
          </Text>
          <TouchableOpacity
            style={styles.confirmExitPrimaryBtn}
            onPress={onPost}
            activeOpacity={0.85}
          >
            <Ionicons name="paper-plane" size={ms(16)} color={colors.textOnAccent} />
            <Text style={styles.confirmExitPrimaryText}>Post to feed</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmExitGhostBtn}
            onPress={onDiscard}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmExitGhostText}>Exit anyway</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmExitCancelBtn}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmExitCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

export default React.memo(SummaryConfirmExit);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  confirmExitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sw(28),
  },
  confirmExitCard: {
    width: '100%',
    maxWidth: sw(360),
    backgroundColor: colors.card,
    borderRadius: ms(20),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
    paddingTop: sw(22),
    paddingBottom: sw(14),
    paddingHorizontal: sw(20),
    alignItems: 'center',
  },
  confirmExitIconWrap: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sw(14),
  },
  confirmExitTitle: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: sw(6),
  },
  confirmExitBody: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: ms(18),
    marginBottom: sw(18),
    paddingHorizontal: sw(4),
  },
  confirmExitPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.accent,
    paddingVertical: sw(13),
    borderRadius: ms(12),
    marginBottom: sw(8),
  },
  confirmExitPrimaryText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  confirmExitGhostBtn: {
    width: '100%',
    paddingVertical: sw(12),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginBottom: sw(4),
  },
  confirmExitGhostText: {
    color: colors.accentRed,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
  confirmExitCancelBtn: {
    width: '100%',
    paddingVertical: sw(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmExitCancelText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
  },
});
