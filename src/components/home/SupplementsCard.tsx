import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore, type SupplementConfig } from '../../stores/useSupplementStore';
import { useProteinPowderStore } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import AddSupplementModal from './AddSupplementModal';
import ProteinPowderCell from './ProteinPowderCell';
import PowderSelectSheet from './PowderSelectSheet';
import type { ProteinPowder } from '../../stores/useProteinPowderStore';

const GRID_GAP = sw(10);
const GRID_PADDING = sw(16);
const FULL_WIDTH = SCREEN_WIDTH - GRID_PADDING * 2;
const CELL_WIDTH = Math.floor((FULL_WIDTH - GRID_GAP) / 2);
const MAX_SUPPLEMENTS = 2;

function formatIncrement(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}k`;
  return String(value);
}

/* ─── Supplement Cell (half-width card) ───────────────── */

interface CellProps {
  config: SupplementConfig;
  total: number;
  onAdd: (key: string, amount: number) => void;
  onReset: (key: string) => void;
  /** When true, renders without own bg/shadow/width (used inside splitCard) */
  embedded?: boolean;
}

const SupplementCell = React.memo(function SupplementCell({
  config, total, onAdd, onReset, embedded,
}: CellProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = config.dailyGoal > 0 ? Math.min(total / config.dailyGoal, 1) : 0;
  const complete = total >= config.dailyGoal;

  return (
    <View style={embedded ? styles.cellEmbedded : styles.cell}>
      {/* Header */}
      <View style={styles.cellHeader}>
        <View style={[styles.iconWrap, { backgroundColor: config.color + '15' }]}>
          <Ionicons name={config.icon as any} size={ms(12)} color={config.color} />
        </View>
        <Text style={styles.cellName} numberOfLines={1}>{config.name}</Text>
        {total > 0 && (
          <TouchableOpacity onPress={() => onReset(config.key)} hitSlop={8}>
            <Ionicons name="arrow-undo" size={ms(12)} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Value */}
      <View style={styles.cellValueRow}>
        <Text style={styles.cellCurrent}>{total}</Text>
        <Text style={styles.cellGoal}>/{config.dailyGoal}{config.unit}</Text>
        {complete && (
          <Ionicons name="checkmark-circle" size={ms(14)} color={config.color} style={{ marginLeft: sw(4) }} />
        )}
      </View>

      {/* Progress */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: config.color }]}
        />
      </View>

      {/* Buttons */}
      {!complete && (
        <View style={styles.cellButtons}>
          {config.increments.map((inc) => (
            <TouchableOpacity
              key={inc}
              style={styles.cellAddBtn}
              onPress={() => onAdd(config.key, inc)}
              activeOpacity={0.7}
            >
              <Text style={styles.cellAddBtnText}>+{formatIncrement(inc)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

/* ─── Supplements Card ────────────────────────────────── */

export default function SupplementsCard() {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const totals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const resetSupplement = useSupplementStore((s) => s.resetSupplement);
  const scoopGoal = useProteinPowderStore((s) => s.scoopGoal);
  const powders = useProteinPowderStore((s) => s.powders);
  const logScoop = useProteinPowderStore((s) => s.logScoop);
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const [powderSheetVisible, setPowderSheetVisible] = useState(false);
  const [pendingScoopAmount, setPendingScoopAmount] = useState(1);

  const handlePickPowder = useCallback((amount: number) => {
    setPendingScoopAmount(amount);
    setPowderSheetVisible(true);
  }, []);

  const handleSelectPowder = useCallback((powder: ProteinPowder) => {
    if (userId) logScoop(userId, powder, pendingScoopAmount);
    setPowderSheetVisible(false);
  }, [userId, logScoop, pendingScoopAmount]);

  const showProteinPowder = scoopGoal > 0;
  const totalCells = configs.length + (showProteinPowder ? 1 : 0);

  const handleAdd = useCallback((key: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addSupplement(userId, key, amount);
  }, [userId, addSupplement]);

  const handleReset = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) resetSupplement(userId, key);
  }, [userId, resetSupplement]);

  // 0 cells → full-width empty state with add button
  if (totalCells === 0) {
    return (
      <>
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.addIconWrap}>
            <Ionicons name="add" size={ms(20)} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyLabel}>Add Supplement</Text>
        </TouchableOpacity>

        <AddSupplementModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      </>
    );
  }

  // 1 cell → full-width card split in half (cell | add button)
  if (totalCells === 1) {
    const hasSupp = configs.length === 1;
    return (
      <>
        <View style={styles.splitCard}>
          <View style={styles.splitLeft}>
            {hasSupp ? (
              <SupplementCell
                config={configs[0]}
                total={totals[configs[0].key] || 0}
                onAdd={handleAdd}
                onReset={handleReset}
                embedded
              />
            ) : (
              <ProteinPowderCell embedded onPickPowder={handlePickPowder} />
            )}
          </View>
          <View style={styles.splitDivider} />
          <TouchableOpacity
            style={styles.splitRight}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.addIconWrap}>
              <Ionicons name="add" size={ms(20)} color={colors.textTertiary} />
            </View>
            <Text style={styles.addLabel}>Add</Text>
          </TouchableOpacity>
        </View>

        <AddSupplementModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
        <PowderSelectSheet
          visible={powderSheetVisible}
          onClose={() => setPowderSheetVisible(false)}
          powders={powders}
          onSelect={handleSelectPowder}
        />
      </>
    );
  }

  // 2+ cells → grid layout
  return (
    <>
      <View style={gridStyles.grid}>
        {configs.map((config) => (
          <SupplementCell
            key={config.key}
            config={config}
            total={totals[config.key] || 0}
            onAdd={handleAdd}
            onReset={handleReset}
          />
        ))}
        {showProteinPowder && <ProteinPowderCell onPickPowder={handlePickPowder} />}
      </View>

      <AddSupplementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
      <PowderSelectSheet
        visible={powderSheetVisible}
        onClose={() => setPowderSheetVisible(false)}
        powders={powders}
        onSelect={handleSelectPowder}
      />
    </>
  );
}

/* ─── Grid styles (static) ────────────────────────────── */

const gridStyles = StyleSheet.create({
  grid: {
    width: FULL_WIDTH,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: GRID_GAP,
  },
});

/* ─── Theme-dependent styles ──────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  /* Empty state (0 supplements) */
  emptyCard: {
    width: FULL_WIDTH,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    paddingVertical: sw(20),
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
    ...colors.cardShadow,
  },
  emptyLabel: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.semiBold,
  },

  /* Split card (full-width, 1 supplement + add) */
  splitCard: {
    width: FULL_WIDTH,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: sw(14),
    overflow: 'hidden',
    ...colors.cardShadow,
  },
  splitLeft: {
    width: '50%',
  },
  splitDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(12),
  },
  splitRight: {
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
  },
  addIconWrap: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },

  /* Cell (standalone half-width card) */
  cell: {
    width: CELL_WIDTH,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(12),
    gap: sw(6),
    ...colors.cardShadow,
  },
  /* Cell embedded inside splitCard (no bg/shadow/width) */
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
});
