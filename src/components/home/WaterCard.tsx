import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useShallow } from 'zustand/shallow';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';
import CardDetailSheet, {
  CardDetailHero,
  CardDetailSectionLabel,
  CardDetailBar,
  CardDetailFooter,
  QuickAddGrid,
  QuickAddButton,
  useCardDetailStyles,
} from './CardDetailSheet';

function WaterCard() {
  // Only these fields: a whole-store subscription re-rendered the card on any supplement change.
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore(
    useShallow((s) => ({ water: s.water, waterGoal: s.waterGoal, addWater: s.addWater, undoLastWater: s.undoLastWater })),
  );
  const userId = useAuthStore((s) => s.user?.id);
  const progress = Math.min(water / waterGoal, 1);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const detailStyles = useCardDetailStyles();
  const [expanded, setExpanded] = useState(false);
  const handleClose = useCallback(() => setExpanded(false), []);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const customInputRef = useRef<TextInput>(null);

  const handleAdd = (ml: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addWater(userId, ml);
  };

  const handleUndo = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  const handleCustomAdd = useCallback(() => {
    const ml = parseInt(customAmount, 10);
    if (!isNaN(ml) && ml > 0 && userId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addWater(userId, ml);
      setCustomAmount('');
      setShowCustom(false);
    }
  }, [customAmount, userId, addWater]);

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
      <CardDetailSheet
        visible={expanded}
        onClose={handleClose}
        onDismiss={() => { setShowCustom(false); setCustomAmount(''); }}
      >
        {/* Water hero */}
        <CardDetailHero
          value={water.toLocaleString()}
          valueColor={isOver ? colors.water : undefined}
          unit="ml"
          label={isOver ? `${overAmount}ml over goal` : `${remaining}ml remaining`}
          stats={[
            { value: waterGoal.toLocaleString(), label: 'Goal' },
            { value: `${pct}%`, label: 'Done' },
          ]}
          dividerColor={colors.ring.track}
        />

        {/* Water progress bar */}
        <CardDetailSectionLabel>Water</CardDetailSectionLabel>
        <CardDetailBar pct={pct} color={colors.water} trackColor={colors.ring.track} />

        {/* Quick add buttons */}
        <CardDetailSectionLabel spaced>Quick Add</CardDetailSectionLabel>
        <QuickAddGrid>
          {[100, 250, 330, 500, 750, 1000].map((ml) => (
            <QuickAddButton
              key={ml}
              label={`+${ml}ml`}
              color={colors.water}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (userId) addWater(userId, ml); }}
            />
          ))}
          {!showCustom ? (
            <QuickAddButton
              label="Custom"
              color={colors.water}
              style={styles.sheetCustomBtn}
              icon="pencil-outline"
              onPress={() => {
                setShowCustom(true);
                setTimeout(() => customInputRef.current?.focus(), 100);
              }}
            />
          ) : (
            <View style={[detailStyles.quickBtn, styles.sheetCustomInputRow]}>
              <TextInput
                ref={customInputRef}
                style={styles.customInput}
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="number-pad"
                placeholder="ml"
                placeholderTextColor={colors.textTertiary}
                onSubmitEditing={handleCustomAdd}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.customAddBtn, (!customAmount || parseInt(customAmount, 10) <= 0) && { opacity: 0.4 }]}
                onPress={handleCustomAdd}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={ms(16)} color={colors.textOnAccent} />
              </TouchableOpacity>
            </View>
          )}
        </QuickAddGrid>

        {/* Undo + Close */}
        <CardDetailFooter onClose={handleClose} onUndo={handleUndo} showUndo={water > 0} />
      </CardDetailSheet>
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

  /* Detail popup: custom add (the rest of the popup is CardDetailSheet) */
  sheetCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCustomInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: sw(4),
    gap: sw(6),
  },
  customInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    paddingVertical: sw(10),
  },
  customAddBtn: {
    backgroundColor: colors.water,
    borderRadius: sw(8),
    width: sw(30),
    height: sw(30),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(WaterCard);
