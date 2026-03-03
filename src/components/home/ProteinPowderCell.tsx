import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { useProteinPowderStore } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';

const POWDER_COLOR = '#86EFAC';
const GRID_GAP = sw(10);
const GRID_PADDING = sw(16);
const FULL_WIDTH = SCREEN_WIDTH - GRID_PADDING * 2;
const CELL_WIDTH = Math.floor((FULL_WIDTH - GRID_GAP) / 2);

interface Props {
  embedded?: boolean;
  onPickPowder?: () => void;
}

const ProteinPowderCell = React.memo(function ProteinPowderCell({ embedded, onPickPowder }: Props) {
  const powders = useProteinPowderStore((s) => s.powders);
  const scoopGoal = useProteinPowderStore((s) => s.scoopGoal);
  const todayScoops = useProteinPowderStore((s) => s.todayScoops);
  const logScoop = useProteinPowderStore((s) => s.logScoop);
  const undoLastScoop = useProteinPowderStore((s) => s.undoLastScoop);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const progress = scoopGoal > 0 ? Math.min(todayScoops / scoopGoal, 1) : 0;
  const complete = todayScoops >= scoopGoal && scoopGoal > 0;

  const handleAdd = useCallback(() => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (powders.length === 0) return;
    if (powders.length === 1) {
      logScoop(userId, powders[0]);
    } else if (onPickPowder) {
      onPickPowder();
    }
  }, [userId, powders, logScoop, onPickPowder]);

  const handleUndo = useCallback(() => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastScoop(userId);
  }, [userId, undoLastScoop]);

  return (
    <View style={embedded ? styles.cellEmbedded : styles.cell}>
      {/* Header */}
      <View style={styles.cellHeader}>
        <View style={styles.iconWrap}>
          <Ionicons name="nutrition-outline" size={ms(12)} color={POWDER_COLOR} />
        </View>
        <Text style={styles.cellName} numberOfLines={1}>Protein Powder</Text>
        {todayScoops > 0 && (
          <TouchableOpacity onPress={handleUndo} hitSlop={8}>
            <Ionicons name="arrow-undo" size={ms(12)} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Value */}
      <View style={styles.cellValueRow}>
        <Text style={styles.cellCurrent}>{todayScoops}</Text>
        <Text style={styles.cellGoal}>/{scoopGoal} scoops</Text>
        {complete && (
          <Ionicons name="checkmark-circle" size={ms(14)} color={POWDER_COLOR} style={{ marginLeft: sw(4) }} />
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: POWDER_COLOR }]}
        />
      </View>

      {/* Button */}
      {!complete && (
        <View style={styles.cellButtons}>
          {powders.length === 0 ? (
            <Text style={styles.setupText}>Set up in Settings</Text>
          ) : (
            <TouchableOpacity
              style={styles.cellAddBtn}
              onPress={handleAdd}
              activeOpacity={0.7}
            >
              <Text style={styles.cellAddBtnText}>+1 scoop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
});

export default ProteinPowderCell;

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cell: {
    width: CELL_WIDTH,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(12),
    gap: sw(6),
    ...colors.cardShadow,
  },
  cellEmbedded: {
    flex: 1,
    padding: sw(12),
    gap: sw(6),
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(20),
    height: sw(20),
    borderRadius: sw(6),
    backgroundColor: POWDER_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.bold,
  },
  cellValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cellCurrent: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(24),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  cellGoal: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.regular,
  },
  progressTrack: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: sw(2),
  },
  cellButtons: {
    flexDirection: 'row',
    gap: sw(6),
  },
  cellAddBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingVertical: sw(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellAddBtnText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  setupText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
});
