import React, { useMemo } from 'react';
import { View, Text, Pressable, type ViewStyle, type StyleProp } from 'react-native';
import {
  Canvas,
  Path,
  Picture,
  Line as SkiaLine,
  Skia,
  TileMode,
  createPicture,
  vec,
} from '@shopify/react-native-skia';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { createTrendStyles } from './trendStyles';
import { CHART_H, Y_LABEL_W, GRID_STEPS, BAR_RADIUS, CARD_INNER_W, type TrendBar } from './trendConfig';
import type { TrendLayout } from './useTrendLayout';

export interface TrendLegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

interface Props {
  entries: readonly TrendBar[];
  layout: TrendLayout;
  /** Colour of the EMA trend line. */
  trendColor: string;
  /** Legend after "Daily". */
  legend: TrendLegendItem[];
  animStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  onPress: () => void;
  /** Extra Skia layers drawn above the trend line. */
  canvasOverlay?: React.ReactNode;
  /** Extra views over the chart area (above the canvas). */
  chartOverlay?: React.ReactNode;
}

/**
 * Bar chart of daily values with a grid, y labels, the EMA trend line, x labels and a legend.
 * The bars are recorded into one Skia picture (one draw node instead of one per entry, ~365 on 1Y),
 * each keeping its own top-to-bottom gradient, so it draws exactly what per-bar RoundedRects did.
 */
function TrendChart({ entries, layout, trendColor, legend, animStyle, onPress, canvasOverlay, chartOverlay }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createTrendStyles(colors), [colors]);
  const { slotW, barW, yScale, peakIndex, emaPath } = layout;

  const barsPicture = useMemo(() => {
    const peakColors = [Skia.Color(colors.accent), Skia.Color(colors.accent + '90')];
    const barColors = [Skia.Color(colors.accent + '60'), Skia.Color(colors.accent + '20')];
    return createPicture((canvas) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      entries.forEach((entry, i) => {
        const x = Y_LABEL_W + i * slotW + (slotW - barW) / 2;
        const barH = Math.max(BAR_RADIUS * 2, ((entry.value - yScale.yMin) / yScale.yRange) * CHART_H);
        const y = CHART_H - barH;
        paint.setShader(Skia.Shader.MakeLinearGradient(
          vec(0, y), vec(0, CHART_H), i === peakIndex ? peakColors : barColors, null, TileMode.Clamp,
        ));
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, barW, barH), BAR_RADIUS, BAR_RADIUS), paint);
      });
    }, Skia.XYWHRect(0, 0, CARD_INNER_W, CHART_H));
  }, [entries, slotW, barW, yScale, peakIndex, colors.accent]);

  // Only the labelled slots get a view; runs of unlabelled slots become one spacer of the same width.
  const labelEvery = entries.length <= 7 ? 1 : entries.length <= 14 ? 2 : Math.ceil(entries.length / 7);
  const xLabels = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    let gap = 0;
    entries.forEach((entry, i) => {
      if (i % labelEvery === 0 || i === entries.length - 1) {
        if (gap > 0) nodes.push(<View key={`gap${i}`} style={{ width: gap * slotW }} />);
        gap = 0;
        nodes.push(
          <View key={i} style={{ width: slotW, alignItems: 'center' }}>
            <Text style={styles.xLabel} numberOfLines={1}>{new Date(entry.date + 'T00:00:00').getDate()}</Text>
          </View>,
        );
      } else {
        gap++;
      }
    });
    return nodes;
  }, [entries, labelEvery, slotW, styles]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={animStyle}>
        <View style={{ height: CHART_H }}>
          {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
            const val = yScale.yMax - (i / GRID_STEPS) * yScale.yRange;
            return (
              <Text key={i} style={[styles.yLabel, { position: 'absolute', top: (i / GRID_STEPS) * CHART_H - ms(6), left: 0, width: Y_LABEL_W - sw(4) }]}>
                {val.toFixed(1)}
              </Text>
            );
          })}
          <Canvas style={{ position: 'absolute', left: 0, top: 0, width: CARD_INNER_W, height: CHART_H }}>
            {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
              const y = (i / GRID_STEPS) * CHART_H;
              return <SkiaLine key={i} p1={vec(Y_LABEL_W, y)} p2={vec(CARD_INNER_W, y)} color={colors.cardBorder} strokeWidth={0.5} />;
            })}
            <Picture picture={barsPicture} />
            {emaPath && <Path path={emaPath} style="stroke" strokeWidth={sw(1.5)} color={trendColor} strokeCap="round" />}
            {canvasOverlay}
          </Canvas>
          {chartOverlay}
        </View>
        <View style={[styles.xAxisRow, { paddingLeft: Y_LABEL_W }]}>
          {xLabels}
        </View>
      </Animated.View>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Daily</Text>
        </View>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={item.dashed ? [styles.legendDash, { borderColor: item.color }] : [styles.legendLine, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default React.memo(TrendChart);
