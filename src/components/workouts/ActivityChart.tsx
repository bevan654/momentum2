import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';

const CHART_HEIGHT = sw(115);
const CHART_PADDING_LEFT = sw(6);
const CHART_PADDING_RIGHT = sw(6);
const CHART_PADDING_TOP = sw(8);
const CHART_PADDING_BOTTOM = sw(20);
const BAR_WIDTH = sw(9);
const BAR_RADIUS = sw(3);

/* ── Mock hourly data (replace with real watch data later) ── */
const MOCK_HOURLY = [
  { hour: 0,  steps: 0,    calories: 0 },
  { hour: 1,  steps: 0,    calories: 0 },
  { hour: 2,  steps: 0,    calories: 0 },
  { hour: 3,  steps: 0,    calories: 0 },
  { hour: 4,  steps: 0,    calories: 0 },
  { hour: 5,  steps: 40,   calories: 2 },
  { hour: 6,  steps: 320,  calories: 14 },
  { hour: 7,  steps: 1450, calories: 62 },
  { hour: 8,  steps: 2100, calories: 88 },
  { hour: 9,  steps: 680,  calories: 30 },
  { hour: 10, steps: 420,  calories: 18 },
  { hour: 11, steps: 550,  calories: 24 },
  { hour: 12, steps: 1800, calories: 76 },
  { hour: 13, steps: 1200, calories: 52 },
  { hour: 14, steps: 380,  calories: 16 },
  { hour: 15, steps: 500,  calories: 22 },
  { hour: 16, steps: 450,  calories: 20 },
  { hour: 17, steps: 1650, calories: 70 },
  { hour: 18, steps: 2400, calories: 102 },
  { hour: 19, steps: 900,  calories: 38 },
  { hour: 20, steps: 350,  calories: 15 },
  { hour: 21, steps: 180,  calories: 8 },
  { hour: 22, steps: 60,   calories: 3 },
  { hour: 23, steps: 20,   calories: 1 },
];

const MOCK_TOTAL_STEPS = MOCK_HOURLY.reduce((s, d) => s + d.steps, 0);

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12a';
  if (h === 12) return '12p';
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}

interface Props {
  activeMinutes: number;
}

function ActivityChart({ activeMinutes }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const data = MOCK_HOURLY;
  const chartWidth = SCREEN_WIDTH - sw(64);
  const drawWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const drawHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const maxSteps = Math.max(...data.map((d) => d.steps));
  const maxCals = Math.max(...data.map((d) => d.calories));
  const stepsceil = Math.ceil(maxSteps / 500) * 500;
  const calsCeil = Math.ceil(maxCals / 25) * 25;

  const xForIndex = (i: number) =>
    CHART_PADDING_LEFT + (drawWidth / (data.length - 1)) * i;

  const yForSteps = (s: number) =>
    CHART_PADDING_TOP + drawHeight - (s / stepsceil) * drawHeight;

  const yForCals = (c: number) =>
    CHART_PADDING_TOP + drawHeight - (c / calsCeil) * drawHeight;

  const calLinePoints = data
    .map((d, i) => `${xForIndex(i)},${yForCals(d.calories)}`)
    .join(' ');

  const labelHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const baselineY = CHART_PADDING_TOP + drawHeight;

  const gridY1 = CHART_PADDING_TOP + drawHeight * (1 / 3);
  const gridY2 = CHART_PADDING_TOP + drawHeight * (2 / 3);

  return (
    <View style={[styles.card, colors.cardShadow]}>
      <Text style={styles.sectionLabel}>ACTIVITY</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="footsteps-outline" size={ms(13)} color={colors.accentBlue} />
          <Text style={styles.statValue}>{MOCK_TOTAL_STEPS.toLocaleString()}</Text>
          <Text style={styles.statLabel}>steps</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="timer-outline" size={ms(13)} color={colors.accentGreen} />
          <Text style={styles.statValue}>{activeMinutes}</Text>
          <Text style={styles.statLabel}>active min</Text>
        </View>
      </View>

      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {/* Grid lines */}
        <Line
          x1={CHART_PADDING_LEFT} y1={gridY1}
          x2={chartWidth - CHART_PADDING_RIGHT} y2={gridY1}
          stroke={colors.cardBorder + '40'} strokeWidth={1}
        />
        <Line
          x1={CHART_PADDING_LEFT} y1={gridY2}
          x2={chartWidth - CHART_PADDING_RIGHT} y2={gridY2}
          stroke={colors.cardBorder + '40'} strokeWidth={1}
        />
        <Line
          x1={CHART_PADDING_LEFT} y1={baselineY}
          x2={chartWidth - CHART_PADDING_RIGHT} y2={baselineY}
          stroke={colors.cardBorder + '60'} strokeWidth={1}
        />

        {/* Step bars */}
        {data.map((d, i) => {
          const x = xForIndex(i);
          const barTop = yForSteps(d.steps);
          const barHeight = Math.max(baselineY - barTop, 1);
          return (
            <Rect
              key={`bar-${d.hour}`}
              x={x - BAR_WIDTH / 2}
              y={barTop}
              width={BAR_WIDTH}
              height={barHeight}
              rx={BAR_RADIUS}
              fill={colors.accentBlue + '30'}
            />
          );
        })}

        {/* Calorie line */}
        <Polyline
          points={calLinePoints}
          fill="none"
          stroke={colors.accentRed}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Calorie dots */}
        {data.map((d, i) => (
          <Circle
            key={`dot-${d.hour}`}
            cx={xForIndex(i)}
            cy={yForCals(d.calories)}
            r={sw(2)}
            fill={colors.accentRed}
          />
        ))}

        {/* X-axis hour labels */}
        {labelHours.map((h) => {
          const idx = data.findIndex((d) => d.hour === h);
          if (idx === -1) return null;
          return (
            <SvgText
              key={`lbl-${h}`}
              x={xForIndex(idx)}
              y={baselineY + sw(12)}
              fill={colors.textTertiary}
              fontSize={ms(8)}
              fontFamily={Fonts.medium}
              textAnchor="middle"
            >
              {formatHour(h)}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentBlue }]} />
          <Text style={styles.legendText}>Steps</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentRed }]} />
          <Text style={styles.legendText}>Calories</Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(ActivityChart);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(12),
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    marginBottom: sw(6),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sw(6),
    gap: sw(16),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  statDivider: {
    width: 1,
    height: sw(14),
    backgroundColor: colors.cardBorder,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(16),
    marginTop: sw(4),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  legendDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  legendText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
});
