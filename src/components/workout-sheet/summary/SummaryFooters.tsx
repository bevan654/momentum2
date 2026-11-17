import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useActiveWorkoutStore } from '../../../stores/useActiveWorkoutStore';
import type { ShareVisibility } from './SharePreviewCard';

/** Edit mode: Cancel / Save. */
export const SummaryEditFooter = React.memo(function SummaryEditFooter({ saving, onCancel, onSave }: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.footerRow}>
      <TouchableOpacity style={styles.cancelEditBtn} onPress={onCancel} activeOpacity={0.7} disabled={saving}>
        <Text style={styles.cancelEditBtnText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.saveEditBtn} onPress={onSave} activeOpacity={0.7} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={styles.saveEditBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

/** Just-completed summary: back to the workout (undo finish), post to feed / save as private, share image. */
export const SummaryCompletedFooter = React.memo(function SummaryCompletedFooter({ shareVisibility, postDisabled, onPost, onShare }: {
  shareVisibility: ShareVisibility;
  postDisabled: boolean;
  onPost: () => void;
  onShare: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.footerRow}>
      <TouchableOpacity style={styles.smallIconBtn} onPress={() => useActiveWorkoutStore.getState().undoFinish()} activeOpacity={0.7}>
        <Ionicons name="pencil" size={ms(18)} color={colors.accent} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.shareBtnMain} onPress={onPost} activeOpacity={0.85} disabled={postDisabled}>
        <Ionicons
          name={shareVisibility === 'private' ? 'lock-closed' : 'paper-plane'}
          size={ms(16)}
          color={colors.textOnAccent}
        />
        <Text style={styles.shareBtnMainText}>
          {shareVisibility === 'private' ? 'Save as private' : 'Post to feed'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.smallIconBtn} onPress={onShare} activeOpacity={0.7}>
        <Ionicons name="share-outline" size={ms(18)} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(6),
  },
  smallIconBtn: {
    width: sw(40),
    height: sw(40),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.accent,
    paddingVertical: sw(12),
  },
  shareBtnMainText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    letterSpacing: 0.3,
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  cancelEditBtnText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(21),
  },
  saveEditBtn: {
    flex: 1,
    backgroundColor: colors.accentGreen,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  saveEditBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
});
