import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import type { ScanItem } from './macroLensTypes';

/** Scan results: total calories and macros, then one row per detected item (tap to log it). */
function ResultsSheet({ items, totals, onRetake, onPickItem }: {
  items: ScanItem[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
  onRetake: () => void;
  onPickItem: (item: ScanItem) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={styles.resultsSheet}
    >
      <View style={styles.sheetGrabber} />

      {/* Header row */}
      <View style={styles.resultsHeader}>
        <View style={styles.brandBadge}>
          <Ionicons name="aperture" size={ms(11)} color={colors.textOnAccent} />
          <Text style={styles.brandBadgeText}>MacroLens</Text>
        </View>
        <TouchableOpacity onPress={onRetake} hitSlop={8} style={styles.retakeChip}>
          <Ionicons name="refresh" size={ms(12)} color={colors.textSecondary} />
          <Text style={styles.retakeChipText}>Retake</Text>
        </TouchableOpacity>
      </View>

      {/* Hero — total calories + macro bars */}
      <Animated.View
        entering={FadeInDown.delay(80).springify().damping(20)}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroLabelWrap}>
            <Text style={styles.heroLabel}>Total estimated</Text>
            <Text style={styles.heroItemCount}>
              {items.length} {items.length === 1 ? 'item' : 'items'} detected
            </Text>
          </View>
          <View style={styles.heroCalWrap}>
            <Text style={styles.heroCalNumber}>{Math.round(totals.calories)}</Text>
            <Text style={styles.heroCalUnit}>kcal</Text>
          </View>
        </View>
        <View style={styles.macroRow}>
          <MacroPill label="Protein" value={totals.protein} color={colors.protein} />
          <MacroPill label="Carbs" value={totals.carbs} color={colors.carbs} />
          <MacroPill label="Fat" value={totals.fat} color={colors.fat} />
        </View>
      </Animated.View>

      <Text style={styles.itemsHint}>Tap an item to log it</Text>

      <ScrollView
        style={styles.resultsList}
        contentContainerStyle={styles.resultsListContent}
        showsVerticalScrollIndicator={false}
      >
        {items.map((it, i) => (
          <Animated.View
            key={`${it.name}-${i}`}
            entering={FadeInDown.delay(140 + i * 60).springify().damping(20)}
          >
            <TouchableOpacity
              style={styles.itemCard}
              onPress={() => onPickItem(it)}
              activeOpacity={0.8}
            >
              <View style={styles.itemThumb}>
                <Ionicons name="restaurant" size={ms(16)} color={colors.accent} />
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                {it.brand ? (
                  <Text style={styles.itemBrand} numberOfLines={1}>{it.brand}</Text>
                ) : (
                  <Text style={styles.itemServing}>{it.serving_size}{it.serving_unit}</Text>
                )}
                <View style={styles.itemMacros}>
                  <MacroDot value={Math.round(it.protein)} label="P" color={colors.protein} />
                  <MacroDot value={Math.round(it.carbs)} label="C" color={colors.carbs} />
                  <MacroDot value={Math.round(it.fat)} label="F" color={colors.fat} />
                </View>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemCal}>{Math.round(it.calories)}</Text>
                <Text style={styles.itemCalUnit}>kcal</Text>
                <View style={styles.itemChevWrap}>
                  <Ionicons name="chevron-forward" size={ms(13)} color={colors.textTertiary} />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

export default React.memo(ResultsSheet);

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[macroPillStyles.wrap, { backgroundColor: color + '14', borderColor: color + '33' }]}>
      <View style={[macroPillStyles.dot, { backgroundColor: color }]} />
      <View>
        <Text style={[macroPillStyles.value, { color }]}>{Math.round(value)}g</Text>
        <Text style={macroPillStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const macroPillStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(7),
    paddingHorizontal: sw(10),
    paddingVertical: sw(8),
    borderRadius: sw(10),
    borderWidth: 1,
  },
  dot: {
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
  },
  value: {
    fontSize: ms(13),
    lineHeight: ms(16),
    fontFamily: Fonts.extraBold,
  },
  label: {
    color: '#888',
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

function MacroDot({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={macroDotStyles.wrap}>
      <View style={[macroDotStyles.dot, { backgroundColor: color }]} />
      <Text style={[macroDotStyles.text, { color }]}>{value}{label}</Text>
    </View>
  );
}

const macroDotStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  text: {
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.bold,
  },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  resultsSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(24),
    borderTopRightRadius: sw(24),
    paddingTop: sw(8),
    paddingBottom: sw(28),
    maxHeight: '78%',
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.textTertiary + '50',
    marginBottom: sw(10),
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(14),
    marginBottom: sw(10),
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    backgroundColor: colors.accent,
    paddingHorizontal: sw(9),
    paddingVertical: sw(4),
    borderRadius: sw(11),
  },
  brandBadgeText: {
    color: colors.textOnAccent,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
  },
  retakeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: sw(10),
    paddingVertical: sw(5),
    borderRadius: sw(11),
  },
  retakeChipText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
  },
  heroCard: {
    marginHorizontal: sw(14),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(16),
    padding: sw(14),
    gap: sw(12),
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroLabelWrap: {
    gap: sw(2),
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  heroItemCount: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  heroCalWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(4),
  },
  heroCalNumber: {
    color: colors.textPrimary,
    fontSize: ms(34),
    lineHeight: ms(38),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  heroCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  macroRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  itemsHint: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    paddingHorizontal: sw(18),
    paddingTop: sw(12),
    paddingBottom: sw(6),
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resultsList: {
    flexGrow: 0,
  },
  resultsListContent: {
    paddingHorizontal: sw(14),
    paddingBottom: sw(8),
    gap: sw(8),
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(14),
    padding: sw(12),
    gap: sw(10),
  },
  itemThumb: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(10),
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: sw(2) },
  itemName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.bold,
    letterSpacing: -0.1,
  },
  itemBrand: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  itemServing: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  itemMacros: {
    flexDirection: 'row',
    gap: sw(10),
    marginTop: sw(3),
  },
  itemRight: {
    alignItems: 'flex-end',
    minWidth: sw(48),
  },
  itemCal: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(20),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  itemCalUnit: {
    color: colors.textTertiary,
    fontSize: ms(8),
    lineHeight: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  itemChevWrap: {
    marginTop: sw(2),
  },
});
