import React, { useRef, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sw } from '../../theme/responsive';
import { useColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';

const BAR_HEIGHT = sw(36);
const BAR_RADIUS = sw(12);
const THUMB_SIZE = sw(26);

/* ─── HSL / Hex utilities ──────────────────────────────── */

const SATURATION = 80;
const LIGHTNESS = 55;

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c)))
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function hexToHue(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / d + 6) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return (hue * 60 + 360) % 360;
}

/* ─── Build gradient stops using same HSL formula ──────── */

const STOP_COUNT = 13;
const GRADIENT_COLORS = Array.from({ length: STOP_COUNT }, (_, i) =>
  hslToHex((i / (STOP_COUNT - 1)) * 360, SATURATION, LIGHTNESS),
) as [string, string, ...string[]];

/* ─── Component ────────────────────────────────────────── */

export default function AccentColorPicker() {
  const colors = useColors();
  const accentColor = useThemeStore((s) => s.accentColor);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  const barRef = useRef<View>(null);
  const layoutRef = useRef({ x: 0, width: 0 });
  const [barWidth, setBarWidth] = useState(0);

  const fraction = hexToHue(accentColor) / 360;

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setBarWidth(width);
    barRef.current?.measureInWindow((x) => {
      layoutRef.current = { x, width };
    });
  }, []);

  const pickColor = useCallback(
    (pageX: number) => {
      const { x, width } = layoutRef.current;
      if (width === 0) return;
      const t = Math.max(0, Math.min(1, (pageX - x) / width));
      const hue = t * 360;
      setAccentColor(hslToHex(hue, SATURATION, LIGHTNESS));
    },
    [setAccentColor],
  );

  const thumbLeft = Math.max(
    0,
    Math.min(barWidth - THUMB_SIZE, fraction * barWidth - THUMB_SIZE / 2),
  );

  return (
    <View
      ref={barRef}
      style={styles.barWrap}
      onLayout={onBarLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pickColor(e.nativeEvent.pageX)}
      onResponderMove={(e) => pickColor(e.nativeEvent.pageX)}
    >
      <LinearGradient
        colors={GRADIENT_COLORS}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.gradient}
      />

      {barWidth > 0 && (
        <View
          style={[
            styles.thumb,
            { left: thumbLeft, backgroundColor: accentColor, borderColor: colors.textOnAccent },
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────── */

const styles = StyleSheet.create({
  barWrap: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_RADIUS,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
});
