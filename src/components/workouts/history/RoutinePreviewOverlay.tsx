import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableWithoutFeedback, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import type { ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms, SCREEN_HEIGHT } from '../../../theme/responsive';
import type { Routine } from '../../../stores/useRoutineStore';
import { DISMISS_THRESHOLD, VELOCITY_THRESHOLD } from './historyConstants';

/* ─── Routine Preview Overlay ─────────────────────────── */

const PREVIEW_SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

const RoutinePreviewOverlay = React.memo(function RoutinePreviewOverlay({
  routine, colors, prevMap, onDismiss,
}: {
  routine: Routine;
  colors: ThemeColors;
  prevMap: Record<string, any[]>;
  onDismiss: () => void;
}) {
  const os = useMemo(() => previewStyles(colors), [colors]);

  const translateY = useSharedValue(PREVIEW_SHEET_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
    backdropOpacity.value = 1;
  }, []);

  const dismiss = useCallback(() => {
    translateY.value = PREVIEW_SHEET_HEIGHT;
    backdropOpacity.value = 0;
    onDismiss();
  }, [onDismiss]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => { ctx.value = translateY.value; })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_THRESHOLD || e.velocityY > VELOCITY_THRESHOLD) {
            translateY.value = PREVIEW_SHEET_HEIGHT;
            backdropOpacity.value = 0;
            runOnJS(onDismiss)();
          } else {
            translateY.value = 0;
          }
        }),
    [onDismiss],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysLabel = routine.days.length > 0
    ? routine.days.map((d) => DAY_NAMES[d]).join(', ')
    : null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <View style={os.backdropWrap}>
      <StatusBar barStyle="light-content" />
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[os.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[os.sheetContainer, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={os.handleRow} hitSlop={{ top: 10, bottom: 10 }}>
            <View style={os.handle} />
          </Animated.View>
        </GestureDetector>

        <ScrollView style={os.scroll} contentContainerStyle={os.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={os.header}>
            <View style={os.headerSpacer} />
            <Text style={os.headerTitle}>Workout Summary</Text>
            <View style={os.headerSpacer} />
          </View>

          <View style={os.info}>
            <Text style={os.infoName}>{routine.name}</Text>
            <Text style={os.infoSub}>
              {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
              {daysLabel ? `  ·  ${daysLabel}` : ''}
            </Text>
          </View>

          {routine.exercises.map((ex, i) => {
            const reps = ex.set_reps || Array(ex.default_sets).fill(ex.default_reps);
            const weights = ex.set_weights || Array(ex.default_sets).fill(0);
            const prev = prevMap[ex.name] || [];
            const minR = Math.min(...reps);
            const maxR = Math.max(...reps);
            const repRange = minR === maxR ? `${minR}` : `${minR}-${maxR}`;

            const formatRest = (s: number) => {
              if (s >= 60) {
                const m = Math.floor(s / 60);
                const rem = s % 60;
                return rem > 0 ? `${m}m${rem}s` : `${m}m`;
              }
              return `${s}s`;
            };

            return (
              <View key={i} style={os.card}>
                <Text style={os.exName} numberOfLines={1}>
                  {ex.name.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <Text style={os.exSub}>
                  {reps.length} sets · {repRange} reps · {formatRest(ex.default_rest_seconds)}
                </Text>
                <View style={os.divider} />
                <View style={os.colHeaders}>
                  <Text style={[os.colHeader, os.colSet]}>SET</Text>
                  <Text style={[os.colHeader, os.colPrev]}>PREV</Text>
                  <Text style={[os.colHeader, os.colVal]}>KG</Text>
                  <Text style={[os.colHeader, os.colVal]}>REPS</Text>
                </View>
                {reps.map((r: number, si: number) => {
                  const p = prev[si];
                  const w = weights[si] || 0;
                  return (
                    <View key={si} style={os.setRow}>
                      <Text style={[os.setNum, os.colSet]}>{si + 1}</Text>
                      <Text style={[os.prevText, os.colPrev]}>
                        {p ? `${p.kg}×${p.reps}` : '—'}
                      </Text>
                      <Text style={[os.cellVal, os.colVal]}>{w > 0 ? w : '—'}</Text>
                      <Text style={[os.cellVal, os.colVal]}>{r}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
    </GestureHandlerRootView>
  );
});

const previewStyles = (colors: ThemeColors) => StyleSheet.create({
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.92,
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    overflow: 'hidden',
  },
  handleRow: { alignItems: 'center', paddingVertical: sw(10) },
  handle: { width: sw(36), height: sw(4), borderRadius: sw(2), backgroundColor: colors.textTertiary + '60' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: sw(16), paddingBottom: sw(80) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: sw(12) },
  headerTitle: { flex: 1, color: colors.textPrimary, fontSize: ms(18), lineHeight: ms(24), fontFamily: Fonts.bold, textAlign: 'center' },
  headerSpacer: { width: sw(36), height: sw(36) },
  info: { marginBottom: sw(16), gap: sw(4) },
  infoName: { color: colors.textPrimary, fontSize: ms(16), fontFamily: Fonts.bold, lineHeight: ms(22) },
  infoSub: { color: colors.textTertiary, fontSize: ms(13), fontFamily: Fonts.medium, lineHeight: ms(18) },
  card: { backgroundColor: colors.card, padding: sw(12), marginBottom: sw(10) },
  exName: { color: colors.textPrimary, fontSize: ms(14), fontFamily: Fonts.bold, lineHeight: ms(18) },
  exSub: { color: colors.textTertiary, fontSize: ms(11), fontFamily: Fonts.medium, lineHeight: ms(14), marginTop: sw(4) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginVertical: sw(10) },
  colHeaders: { flexDirection: 'row', alignItems: 'center', paddingVertical: sw(2) },
  colHeader: { color: colors.textTertiary, fontSize: ms(9), fontFamily: Fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  colSet: { width: sw(30) },
  colPrev: { width: sw(60) },
  colVal: { flex: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: sw(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  setNum: { color: colors.textSecondary, fontSize: ms(10), fontFamily: Fonts.semiBold, textAlign: 'center' },
  prevText: { color: colors.textTertiary, fontSize: ms(10), fontFamily: Fonts.medium, textAlign: 'center' },
  cellVal: { color: colors.textPrimary, fontSize: ms(12), fontFamily: Fonts.bold, textAlign: 'center' },
});

export default RoutinePreviewOverlay;
