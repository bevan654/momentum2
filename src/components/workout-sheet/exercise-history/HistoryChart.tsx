import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Canvas, Path as SkiaPath, Skia, vec, LinearGradient, Line as SkiaLine } from '@shopify/react-native-skia';
import { useColors } from '../../../theme/useColors';
import { sw } from '../../../theme/responsive';
import { buildSmoothPath } from '../../../utils/smoothPath';
import { CHART_H, CHART_W, Y_LABEL_W, GRID_STEPS, type HistoryStyles } from './historyStyles';
import type { ChartMode, ChartPoint, YScale } from './useExerciseHistory';

/** The PROGRESS section: weight/volume toggle and the Skia line chart with y labels. */
function HistoryChart({ styles, chartPoints, yScale, chartMode, setChartMode, isBodyweight }: {
  styles: HistoryStyles;
  chartPoints: ChartPoint[];
  yScale: YScale;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
  isBodyweight: boolean;
}) {
  const colors = useColors();

  const linePath = useMemo(() => buildSmoothPath(chartPoints), [chartPoints]);
  // All data dots as one path, built when the points change (was one new Skia path per dot per render)
  const dotsPath = useMemo(() => {
    if (chartPoints.length === 0) return null;
    const p = Skia.Path.Make();
    for (const pt of chartPoints) p.addCircle(pt.x, pt.y, sw(3));
    return p;
  }, [chartPoints]);

  const fillPath = useMemo(() => {
    if (!linePath || chartPoints.length < 2) return null;
    const fill = linePath.copy();
    fill.lineTo(chartPoints[chartPoints.length - 1].x, CHART_H);
    fill.lineTo(chartPoints[0].x, CHART_H);
    fill.close();
    return fill;
  }, [linePath, chartPoints]);

  return (
    <View style={styles.section}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.sectionLabel}>PROGRESS</Text>
        {!isBodyweight && (
          <View style={styles.chartToggle}>
            <TouchableOpacity
              style={[styles.chartChip, chartMode === 'weight' && styles.chartChipActive]}
              onPress={() => setChartMode('weight')}
              activeOpacity={0.7}
            >
              <Text style={[styles.chartChipText, chartMode === 'weight' && styles.chartChipTextActive]}>Weight</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chartChip, chartMode === 'volume' && styles.chartChipActive]}
              onPress={() => setChartMode('volume')}
              activeOpacity={0.7}
            >
              <Text style={[styles.chartChipText, chartMode === 'volume' && styles.chartChipTextActive]}>Volume</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Canvas style={{ width: CHART_W, height: CHART_H }}>
          {/* Grid lines */}
          {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
            const y = (CHART_H / GRID_STEPS) * i;
            return (
              <SkiaLine
                key={`grid-${i}`}
                p1={vec(Y_LABEL_W, y)}
                p2={vec(CHART_W, y)}
                color={colors.cardBorder}
                strokeWidth={0.5}
              />
            );
          })}
          {/* Fill gradient */}
          {fillPath && (
            <SkiaPath path={fillPath} style="fill">
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, CHART_H)}
                colors={[colors.accent + '30', colors.accent + '00']}
              />
            </SkiaPath>
          )}
          {/* Line */}
          {linePath && (
            <SkiaPath path={linePath} style="stroke" strokeWidth={sw(2)} color={colors.accent} />
          )}
          {/* Data dots */}
          {dotsPath && <SkiaPath path={dotsPath} color={colors.accent} style="fill" />}
        </Canvas>
        {/* Y-axis labels */}
        <View style={styles.yLabels}>
          {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
            const val = yScale.yMax - (yScale.yRange / GRID_STEPS) * i;
            const label = chartMode === 'weight'
              ? `${Math.round(val)}`
              : val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`;
            return (
              <Text key={`ylabel-${i}`} style={styles.yLabel}>{label}</Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default React.memo(HistoryChart);
