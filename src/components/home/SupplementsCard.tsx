import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore, type SupplementConfig } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import AddSupplementModal from './AddSupplementModal';

const GRID_GAP = sw(10);
const GRID_PADDING = sw(16); // matches HomeScreen content paddingHorizontal
const CELL_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

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
}

const SupplementCell = React.memo(function SupplementCell({
  config, total, onAdd, onReset,
}: CellProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progress = config.dailyGoal > 0 ? Math.min(total / config.dailyGoal, 1) : 0;
  const complete = total >= config.dailyGoal;

  return (
    <View style={styles.cell}>
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

/* ─── Add Cell (dashed placeholder) ───────────────────── */

function AddCell({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.addCell} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.addCellInner}>
        <Ionicons name="add" size={ms(22)} color={colors.textTertiary} />
        <Text style={styles.addCellText}>Add</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Supplements Card (grid) ─────────────────────────── */

export default function SupplementsCard() {
  const configs = useSupplementStore((s) => s.supplementConfigs);
  const totals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const resetSupplement = useSupplementStore((s) => s.resetSupplement);
  const userId = useAuthStore((s) => s.user?.id);
  const [modalVisible, setModalVisible] = useState(false);

  const handleAdd = useCallback((key: string, amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addSupplement(userId, key, amount);
  }, [userId, addSupplement]);

  const handleReset = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) resetSupplement(userId, key);
  }, [userId, resetSupplement]);

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
        <AddCell onPress={() => setModalVisible(true)} />
      </View>

      <AddSupplementModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

/* ─── Grid styles (static, no theme dependency) ──────── */

const gridStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
});

/* ─── Theme-dependent styles ──────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  /* Cell (supplement card) */
  cell: {
    width: CELL_WIDTH,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(12),
    gap: sw(6),
    ...colors.cardShadow,
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

  /* Add cell */
  addCell: {
    width: CELL_WIDTH,
    minHeight: sw(100),
    borderRadius: sw(14),
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCellInner: {
    alignItems: 'center',
    gap: sw(4),
  },
  addCellText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
});
