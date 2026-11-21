import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Circle } from '@shopify/react-native-skia';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useWeightStore } from '../../../stores/useWeightStore';
import { buildSmoothPath } from '../../../utils/smoothPath';
import { useAuthStore } from '../../../stores/useAuthStore';
import { isPlausibleBodyweight } from '../../../utils/muscleLoad';
import { BODYWEIGHT_RANGE_KG } from '../../../constants/muscleMap';
import NumberLogModal from '../../lab/trend/NumberLogModal';
import { Ionicons } from '@expo/vector-icons';

const WEIGHT_INVALID = `Enter a weight between ${BODYWEIGHT_RANGE_KG.min} and ${BODYWEIGHT_RANGE_KG.max} kg`;

const CHART_H = sw(52);
const PAD_Y = sw(6);

interface Props {
  onOpen: () => void;
}

/**
 * Plain weight graph for the Home hero (beside the macro rings): current weight, 30-day change and a
 * small chart of the weigh-ins (dots) under the smoothed trend line. Opens the Recovery tab.
 */
function WeightGraph({ onOpen }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { current, change, entries, emaPoints } = useWeightStore(
    useShallow((st) => ({ current: st.current, change: st.change, entries: st.entries, emaPoints: st.emaPoints })),
  );
  const userId = useAuthStore((st) => st.user?.id);
  const logWeight = useWeightStore((st) => st.logWeight);
  const [showLog, setShowLog] = useState(false);
  const handleLog = useCallback(
    async (weight: number) => (userId ? logWeight(userId, weight, 30) : { error: 'Not logged in' }),
    [userId, logWeight],
  );
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const chart = useMemo(() => {
    if (width <= 0 || entries.length < 2) return null;
    const values = [...entries.map((e) => e.weight), ...emaPoints.map((p) => p.value)];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const t0 = new Date(entries[0].date).getTime();
    const t1 = new Date(entries[entries.length - 1].date).getTime();
    const tSpan = t1 - t0 || 1;
    const x = (date: string) => ((new Date(date).getTime() - t0) / tSpan) * width;
    const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (CHART_H - PAD_Y * 2);
    return {
      dots: entries.map((e) => ({ key: e.date, cx: x(e.date), cy: y(e.weight) })),
      line: buildSmoothPath(emaPoints.map((p) => ({ x: x(p.date), y: y(p.value) }))),
    };
  }, [width, entries, emaPoints]);

  // Teaser when there's nothing to plot yet: a made-up, gently falling trend, drawn faint.
  const sample = useMemo(() => {
    if (width <= 0 || chart) return null;
    const ys = [0.1, 0.28, 0.05, 0.3, 0.42, 0.25, 0.55, 0.48, 0.75, 0.66, 0.92];
    const n = ys.length - 1;
    const pts = ys.map((v, i) => ({ x: (i / n) * width, y: PAD_Y + v * (CHART_H - PAD_Y * 2) }));
    const trend = ys.map((_, i) => ({ x: (i / n) * width, y: PAD_Y + (0.12 + (i / n) * 0.72) * (CHART_H - PAD_Y * 2) }));
    return { dots: pts, line: buildSmoothPath(trend) };
  }, [width, chart]);

  const changeText =
    change == null || entries.length < 2 ? null : `${change > 0 ? '+' : change < 0 ? '\u2212' : '\u00b1'}${Math.abs(change).toFixed(1)} kg`;

  return (
    <TouchableOpacity style={s.wrap} onPress={onOpen} activeOpacity={0.85} accessibilityLabel="Weight trend">
      <View style={s.labelRow}>
        <Text style={s.label}>Weight</Text>
        <TouchableOpacity style={s.logBtn} onPress={() => setShowLog(true)} hitSlop={8} activeOpacity={0.6} accessibilityLabel="Log weight">
          <Ionicons name="add" size={ms(13)} color={colors.accent} />
          <Text style={s.logText}>Log</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.value} numberOfLines={1}>
        {current != null ? current.toFixed(1) : '\u2013'}
        <Text style={s.unit}> kg</Text>
      </Text>
      {changeText && <Text style={s.change}>{changeText} · 30 days</Text>}

      <View style={s.chart} onLayout={onLayout}>
        {chart ? (
          <Canvas style={{ width, height: CHART_H }} pointerEvents="none">
            {chart.dots.map((d) => (
              <Circle key={d.key} cx={d.cx} cy={d.cy} r={sw(2)} color={colors.textTertiary + '66'} />
            ))}
            {chart.line && (
              <Path path={chart.line} style="stroke" strokeWidth={sw(2.5)} strokeCap="round" strokeJoin="round" color={colors.accent} />
            )}
          </Canvas>
        ) : (
          <>
            {sample && (
              <Canvas style={[StyleSheet.absoluteFill, s.sample]} pointerEvents="none">
                {sample.dots.map((d, i) => (
                  <Circle key={i} cx={d.x} cy={d.y} r={sw(2)} color={colors.textTertiary} />
                ))}
                {sample.line && (
                  <Path path={sample.line} style="stroke" strokeWidth={sw(2.5)} strokeCap="round" color={colors.accent} />
                )}
              </Canvas>
            )}
          </>
        )}
      </View>
      {!chart && <Text style={s.empty}>Log weigh-ins to see your trend</Text>}

      <NumberLogModal
        visible={showLog}
        onClose={() => setShowLog(false)}
        onSave={handleLog}
        title="Log Weight"
        placeholder="Weight (kg)"
        isValid={isPlausibleBodyweight}
        invalidMessage={WEIGHT_INVALID}
      />
    </TouchableOpacity>
  );
}

export default React.memo(WeightGraph);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
      height: sw(24),
      paddingHorizontal: sw(8),
      borderRadius: sw(12),
      backgroundColor: colors.accent + '1F',
    },
    logText: { color: colors.accent, fontSize: ms(11), lineHeight: ms(14), fontFamily: Fonts.bold },
    label: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
    value: { color: colors.textPrimary, fontSize: ms(22), lineHeight: ms(27), fontFamily: Fonts.extraBold, letterSpacing: -0.5, marginTop: sw(2) },
    unit: { color: colors.textTertiary, fontSize: ms(12), fontFamily: Fonts.semiBold, letterSpacing: 0 },
    change: { color: colors.textTertiary, fontSize: ms(11), lineHeight: ms(14), fontFamily: Fonts.medium },
    chart: { height: CHART_H, marginTop: sw(8), justifyContent: 'center' },
    sample: { opacity: 0.5 },
    empty: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.medium, marginTop: sw(4) },
  });
