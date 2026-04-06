import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';

export default function WaterCard() {
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore();
  const userId = useAuthStore((s) => s.user?.id);
  const progress = Math.min(water / waterGoal, 1);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const handleAdd = (ml: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addWater(userId, ml);
  };

  const handleUndo = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  const isOver = water > waterGoal && waterGoal > 0;
  const remaining = Math.max(0, waterGoal - water);
  const overAmount = Math.max(0, water - waterGoal);
  const pct = waterGoal > 0 ? Math.round((water / waterGoal) * 100) : 0;

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={() => setExpanded(true)} activeOpacity={0.7}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <Ionicons name="water-outline" size={ms(13)} color={colors.water} />
            </View>
            <Text style={styles.title}>Water</Text>
          </View>
          {water > 0 && (
            <TouchableOpacity onPress={handleUndo} hitSlop={8} activeOpacity={0.6}>
              <Ionicons name="arrow-undo" size={ms(13)} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.current}>{water}</Text>
          <Text style={styles.goal}>/{waterGoal}ml</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(250)} activeOpacity={0.7}>
            <Text style={styles.addButtonText}>+250</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(500)} activeOpacity={0.7}>
            <Text style={styles.addButtonText}>+500</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Detail modal */}
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
        <Pressable style={styles.backdrop} onPress={() => setExpanded(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Water hero */}
              <View style={styles.sheetHeroRow}>
                <View>
                  <Text style={[styles.sheetHeroNumber, isOver && { color: colors.water }]}>
                    {water.toLocaleString()}
                    <Text style={styles.sheetHeroUnit}> ml</Text>
                  </Text>
                  <Text style={styles.sheetHeroLabel}>
                    {isOver ? `${overAmount}ml over goal` : `${remaining}ml remaining`}
                  </Text>
                </View>
                <View style={styles.sheetHeroRight}>
                  <View style={styles.sheetStatItem}>
                    <Text style={styles.sheetStatValue}>{waterGoal.toLocaleString()}</Text>
                    <Text style={styles.sheetStatLabel}>Goal</Text>
                  </View>
                  <View style={styles.sheetStatDivider} />
                  <View style={styles.sheetStatItem}>
                    <Text style={styles.sheetStatValue}>{pct}%</Text>
                    <Text style={styles.sheetStatLabel}>Done</Text>
                  </View>
                </View>
              </View>

              {/* Water progress bar */}
              <Text style={styles.sheetSectionLabel}>Water</Text>
              <View style={styles.sheetBarTrack}>
                <View style={[styles.sheetBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: colors.water }]} />
              </View>

              {/* Quick add buttons */}
              <Text style={[styles.sheetSectionLabel, { marginTop: sw(16) }]}>Quick Add</Text>
              <View style={styles.sheetButtons}>
                {[100, 250, 330, 500, 750, 1000].map((ml) => (
                  <TouchableOpacity
                    key={ml}
                    style={styles.sheetAddBtn}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (userId) addWater(userId, ml); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sheetAddBtnText}>+{ml}ml</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Undo + Close */}
              <View style={styles.sheetFooter}>
                {water > 0 && (
                  <TouchableOpacity style={styles.undoBtn} onPress={handleUndo} activeOpacity={0.7}>
                    <Ionicons name="arrow-undo" size={ms(14)} color={colors.textSecondary} />
                    <Text style={styles.undoBtnText}>Undo</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.closeBtn, { flex: 1 }]} onPress={() => setExpanded(false)} activeOpacity={0.7}>
                  <Text style={styles.closeBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(12),
    justifyContent: 'space-between',
    gap: sw(8),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: colors.water + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    color: colors.textPrimary,
    fontSize: ms(26),
    lineHeight: ms(30),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  goal: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.regular,
  },
  progressTrack: {
    height: sw(5),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.water,
    borderRadius: sw(2),
  },
  buttons: {
    flexDirection: 'row',
    gap: sw(6),
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingVertical: sw(7),
    alignItems: 'center',
    minHeight: sw(32),
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.semiBold,
  },

  /* ─── Modal ──────────────────────────────────────────── */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: sw(20),
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(20),
    gap: sw(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '80%',
  },
  sheetHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: sw(16),
  },
  sheetHeroNumber: {
    color: colors.textPrimary,
    fontSize: ms(42),
    lineHeight: ms(46),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1.5,
  },
  sheetHeroUnit: {
    fontSize: ms(18),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },
  sheetHeroLabel: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginTop: sw(-2),
  },
  sheetHeroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    marginBottom: sw(4),
  },
  sheetStatItem: {
    alignItems: 'flex-end',
  },
  sheetStatValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  sheetStatLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  sheetStatDivider: {
    width: sw(1),
    height: sw(26),
    backgroundColor: colors.ring?.track ?? colors.surface,
  },
  sheetSectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sw(8),
  },
  sheetBarTrack: {
    height: sw(6),
    borderRadius: sw(3),
    backgroundColor: colors.ring?.track ?? colors.surface,
    overflow: 'hidden',
  },
  sheetBarFill: {
    height: '100%',
    borderRadius: sw(3),
  },

  /* Quick add buttons */
  sheetButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    justifyContent: 'center',
  },
  sheetAddBtn: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  sheetAddBtnText: {
    color: colors.water,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },

  /* Footer */
  sheetFooter: {
    flexDirection: 'row',
    gap: sw(8),
    marginTop: sw(4),
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    paddingHorizontal: sw(16),
  },
  undoBtnText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  closeBtn: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
});
