import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import Sheet from '../../ui/Sheet';
import { formatMonthDayOf } from '../../../utils/dateLabels';
import { createTrendStyles } from './trendStyles';

const DELETE_THRESHOLD = -80;

/* ─── Swipeable Row ──────────────────────────────────────── */

const SwipeableRow = React.memo(function SwipeableRow({
  rowKey, date, valueText, onDelete, colors, styles,
}: {
  rowKey: string; date: string; valueText: string; onDelete: (key: string) => void;
  colors: ThemeColors; styles: ReturnType<typeof createStyles>;
}) {
  const translateX = useSharedValue(0);
  const handleDelete = useCallback(() => { onDelete(rowKey); }, [rowKey, onDelete]);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10]).failOffsetY([-5, 5])
    .onUpdate((e) => { if (e.translationX < 0) translateX.value = Math.max(e.translationX, DELETE_THRESHOLD - 20); })
    .onEnd((e) => {
      if (e.translationX < DELETE_THRESHOLD) { runOnJS(handleDelete)(); }
      translateX.value = withTiming(0, { duration: 200 });
    }), [handleDelete, translateX]);
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const delStyle = useAnimatedStyle(() => ({ opacity: translateX.value < -20 ? 1 : 0 }));
  const dateStr = formatMonthDayOf(date);

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.deleteBackground, delStyle]}><Ionicons name="trash-outline" size={ms(20)} color={colors.textOnColor} /></Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.historyRow, rowStyle]}>
          <Text style={styles.historyDate}>{dateStr}</Text>
          <Text style={styles.historyValue}>{valueText}</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

/* ─── History Sheet ──────────────────────────────────────── */

interface Props<T extends { date: string }> {
  visible: boolean;
  onClose: () => void;
  title: string;
  emptyText: string;
  /** Oldest first; shown newest first. */
  entries: T[];
  /** Row key, also what onDelete receives. */
  keyOf: (item: T) => string;
  valueText: (item: T) => string;
  onDelete: (key: string) => void;
}

/** Bottom sheet listing a trend card's entries, newest first; swipe a row left to delete it. */
function EntryHistorySheet<T extends { date: string }>({
  visible, onClose, title, emptyText, entries, keyOf, valueText, onDelete,
}: Props<T>) {
  const reversed = useMemo(() => [...entries].reverse(), [entries]);
  const colors = useColors();
  const trendStyles = useMemo(() => createTrendStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderItem = useCallback(({ item }: { item: T }) => (
    <SwipeableRow rowKey={keyOf(item)} date={item.date} valueText={valueText(item)} onDelete={onDelete} colors={colors} styles={styles} />
  ), [keyOf, valueText, onDelete, colors, styles]);

  return (
    <Sheet visible={visible} onClose={onClose} height="70%" bgColor={colors.card}>
      <View style={trendStyles.sheetHeader}>
        <Text style={trendStyles.sheetTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose}><Text style={trendStyles.sheetDone}>Done</Text></TouchableOpacity>
      </View>
      {reversed.length === 0 ? (
        <View style={styles.historyEmpty}><Text style={styles.historyEmptyText}>{emptyText}</Text></View>
      ) : (
        <FlatList
          data={reversed}
          keyExtractor={keyOf}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
        />
      )}
    </Sheet>
  );
}

export default React.memo(EntryHistorySheet) as typeof EntryHistorySheet;

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    historyList: { paddingHorizontal: sw(20), paddingTop: sw(12), paddingBottom: sw(34) },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: sw(14), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder, backgroundColor: colors.card },
    historyDate: { color: colors.textSecondary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.medium },
    historyValue: { color: colors.textPrimary, fontSize: ms(16), lineHeight: ms(22), fontFamily: Fonts.semiBold },
    historyEmpty: { padding: sw(40), alignItems: 'center' },
    historyEmptyText: { color: colors.textTertiary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.medium },
    swipeContainer: { overflow: 'hidden' },
    deleteBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.accentRed, justifyContent: 'center', alignItems: 'flex-end', paddingRight: sw(20), borderRadius: sw(8) },
  });
