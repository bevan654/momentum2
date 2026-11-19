import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore, type SupplementConfig } from '../../stores/useSupplementStore';
import { useProteinPowderStore, PROTEIN_POWDER_KEY } from '../../stores/useProteinPowderStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';
import AddSupplementModal from './AddSupplementModal';
import SupplementDetailModal, { formatIncrement } from './SupplementDetailModal';
import ProteinPowderModal from './ProteinPowderModal';

const GRID_GAP = sw(10);
const COLUMNS = 2;

/* ─── Supplement Cell (half-width card) ───────────────── */

interface CellProps {
  config: SupplementConfig;
  total: number;
  onAdd: (key: string, amount: number) => void;
  /** Removes the most recent add (not the whole day). */
  onReset: (key: string) => void;
  /** When true, renders without own bg/shadow/width (used inside splitCard) */
  embedded?: boolean;
}

const SupplementCell = React.memo(function SupplementCell({
  config, total, onAdd, onReset, embedded,
}: CellProps) {
  const colors = useColors();
  const styles = useMemo(() => createCellStyles(colors), [colors]);
  const progress = config.dailyGoal > 0 ? Math.min(total / config.dailyGoal, 1) : 0;
  const complete = total >= config.dailyGoal;
  const [expanded, setExpanded] = useState(false);
  const handleClose = useCallback(() => setExpanded(false), []);
  // Protein powder always opens its picker (choose the powder and servings).
  const isPowder = config.key === PROTEIN_POWDER_KEY;
  const shown = Math.round(total * 100) / 100;

  return (
      <TouchableOpacity
        style={embedded ? styles.cellEmbedded : styles.cell}
        onPress={() => setExpanded(true)}
        activeOpacity={0.7}
      >
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
          <Text style={styles.cellCurrent}>{shown}</Text>
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
        {isPowder ? (
          <View style={styles.cellButtons}>
            <TouchableOpacity style={styles.cellAddBtn} onPress={() => setExpanded(true)} activeOpacity={0.7}>
              <Text style={styles.cellAddBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
        ) : !complete && (
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
        {/* Detail modal (portalled; builds nothing while closed) */}
        {isPowder ? (
          <ProteinPowderModal visible={expanded} onClose={handleClose} config={config} />
        ) : (
          <SupplementDetailModal
            visible={expanded}
            onClose={handleClose}
            config={config}
            total={total}
            onAdd={onAdd}
            onReset={onReset}
          />
        )}
      </TouchableOpacity>
    );
});

/* ─── Supplements Card ────────────────────────────────── */

function SupplementsCard() {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const totals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const undoLastSupplement = useSupplementStore((s) => s.undoLastSupplement);
  const userId = useAuthStore((s) => s.user?.id);
  const powderServings = useProteinPowderStore((s) => s.todayServings);
  const hasPowder = configs.some((c) => c.key === PROTEIN_POWDER_KEY);

  // Protein powder's servings load only for users who track it: now, and when the app returns.
  useEffect(() => {
    if (!userId || !hasPowder) return;
    useProteinPowderStore.getState().fetchToday(userId);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') useProteinPowderStore.getState().fetchToday(userId);
    });
    return () => sub.remove();
  }, [userId, hasPowder]);
  const colors = useColors();
  const styles = useMemo(() => createCardStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);

  const handleAdd = useCallback((key: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addSupplement(userId, key, amount);
  }, [userId, addSupplement]);

  const handleReset = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!userId) return;
    if (key === PROTEIN_POWDER_KEY) useProteinPowderStore.getState().undoLast(userId);
    else undoLastSupplement(userId, key);
  }, [userId, undoLastSupplement]);
  // Protein powder's count comes from its own log (each add is also a diary snack).
  const totalFor = (key: string) => (key === PROTEIN_POWDER_KEY ? powderServings : totals[key] || 0);

  let body: React.ReactNode;

  if (configs.length === 0) {
    // 0 supplements → full-width empty state with add button
    body = (
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
    );
  } else if (configs.length === 1) {
    // 1 supplement → full-width card split in half (supplement | add button)
    const config = configs[0];
    body = (
      <View style={styles.splitCard}>
        <View style={styles.splitLeft}>
          <SupplementCell
            config={config}
            total={totalFor(config.key)}
            onAdd={handleAdd}
            onReset={handleReset}
            embedded
          />
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
    );
  } else {
    // 2+ supplements → two per row, as many rows as needed. The rows share the card's real width
    // (fixed widths from the screen size could add up to a hair too wide and wrap to one column),
    // and an odd one out on the last row stretches to the full width.
    const rows: SupplementConfig[][] = [];
    for (let i = 0; i < configs.length; i += COLUMNS) rows.push(configs.slice(i, i + COLUMNS));
    body = (
      <View style={gridStyles.grid}>
        {rows.map((row) => (
          <View key={row[0].key} style={gridStyles.row}>
            {row.map((config) => (
              <View key={config.key} style={gridStyles.item}>
                <SupplementCell
                  config={config}
                  total={totalFor(config.key)}
                  onAdd={handleAdd}
                  onReset={handleReset}
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  // Same position in every layout, so the modal keeps its state (and exit animation) when the count changes.
  return (
    <>
      {body}
      <AddSupplementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

/* ─── Grid styles (static) ────────────────────────────── */

const gridStyles = StyleSheet.create({
  grid: {
    gap: GRID_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  item: {
    flex: 1,
    minWidth: 0,
  },
});

/* ─── Card styles (empty state, split card) ───────────── */

const createCardStyles = (colors: ThemeColors) => StyleSheet.create({
  /* Empty state (0 supplements) */
  emptyCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: sw(20),
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
  },
  emptyLabel: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.semiBold,
  },

  /* Split card (full-width, 1 supplement + add) */
  splitCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
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
    borderRadius: sw(8),
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
});

/* ─── Cell styles ─────────────────────────────────────── */

const createCellStyles = (colors: ThemeColors) => StyleSheet.create({
  /* Cell (standalone half-width card) */
  cell: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(12),
    gap: sw(6),
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

export default React.memo(SupplementsCard);
