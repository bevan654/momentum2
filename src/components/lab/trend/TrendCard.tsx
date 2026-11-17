import React, { useMemo } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../theme/useColors';
import { ms } from '../../../theme/responsive';
import { createTrendStyles } from './trendStyles';
import { TREND_RANGES } from './trendConfig';

interface Props {
  title: string;
  /** Appended to the current value and the change, e.g. ' kg' or '%'. */
  unit: string;
  hasData: boolean;
  current: number | null;
  change: number | null;
  /** true when a rise is good (muscle measurements), false when a fall is good. */
  growth?: boolean;
  dateRange: string;
  selectedRange: string;
  rangeIndex: number;
  onShorter: () => void;
  onLonger: () => void;
  onLog: () => void;
  pageIndicator?: React.ReactNode;
  children: React.ReactNode;
}

/** Card chrome of a Lab trend card: title, current value, change badge, log button and range selector. */
function TrendCard({
  title, unit, hasData, current, change, growth = false, dateRange,
  selectedRange, rangeIndex, onShorter, onLonger, onLog, pageIndicator, children,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createTrendStyles(colors), [colors]);
  const lastIndex = TREND_RANGES.length - 1;

  const changeColor = change !== null
    ? (growth ? (change >= 0 ? colors.accentGreen : colors.accentOrange) : (change <= 0 ? colors.accentGreen : colors.accentOrange))
    : colors.textSecondary;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <View style={styles.accentDot} />
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
              {hasData && current !== null && (
                <Text style={styles.currentVal}>{current}{unit}</Text>
              )}
            </View>
            <View style={styles.subtitleRow}>
              <Text style={styles.dateRange}>{dateRange}</Text>
              {hasData && change !== null && (
                <View style={[styles.deltaBadge, { backgroundColor: changeColor + '18' }]}>
                  <Text style={[styles.deltaText, { color: changeColor }]}>
                    {change > 0 ? '+' : ''}{change}{unit}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.logBtn} onPress={onLog} hitSlop={8}>
            <Ionicons name="add" size={ms(16)} color={colors.accent} />
          </Pressable>
          <View style={styles.periodSelector}>
            <Pressable onPress={onShorter} style={[styles.arrowBtn, rangeIndex === 0 && styles.arrowDisabled] as ViewStyle[]} hitSlop={8}>
              <Ionicons name="chevron-back" size={ms(14)} color={rangeIndex === 0 ? colors.textTertiary + '40' : colors.textSecondary} />
            </Pressable>
            <Text style={styles.periodLabel}>{selectedRange}</Text>
            <Pressable onPress={onLonger} style={[styles.arrowBtn, rangeIndex === lastIndex && styles.arrowDisabled] as ViewStyle[]} hitSlop={8}>
              <Ionicons name="chevron-forward" size={ms(14)} color={rangeIndex === lastIndex ? colors.textTertiary + '40' : colors.textSecondary} />
            </Pressable>
          </View>
          {pageIndicator}
        </View>
      </View>
      {children}
    </View>
  );
}

export default React.memo(TrendCard);
