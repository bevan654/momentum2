import React, { useMemo } from 'react';
import { View } from 'react-native';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { useThemeStore } from '../../stores/useThemeStore';
import { useColors } from '../../theme/useColors';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import { calculateMuscleVolume } from '../../utils/muscleVolume';

/* ─── Palette generation ──────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + c(r).toString(16).padStart(2, '0') + c(g).toString(16).padStart(2, '0') + c(b).toString(16).padStart(2, '0');
}

function mixHex(base: string, tint: string, amount: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(tint);
  return rgbToHex(br + (tr - br) * amount, bg + (tg - bg) * amount, bb + (tb - bb) * amount);
}

/** Build a 7-step palette from inactive base → accent color */
function buildAccentPalette(base: string, accent: string): string[] {
  return [0, 0.12, 0.28, 0.45, 0.62, 0.80, 1].map((t) => mixHex(base, accent, t));
}

const BASES = { dark: '#1A1A1E', light: '#DCDCDE' };
const BORDERS = { dark: '#2A2A2E', light: '#A0A0A4' };

const DEFAULT_SCALE = 0.25;

interface Props {
  exercises?: ExerciseWithSets[];
  bodyData?: ExtendedBodyPart[];
  colors?: string[];
  borderColor?: string;
  scale?: number;
  side?: 'front' | 'back';
  backColor?: string;
}

function MiniBodyMap({ exercises, bodyData: precomputed, colors: colorsProp, borderColor, scale = DEFAULT_SCALE, side = 'front', backColor }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const { accent } = useColors();
  const WIDTH = 200 * scale;
  const HEIGHT = 400 * scale;

  const palette = useMemo(
    () => colorsProp || buildAccentPalette(BASES[mode], accent),
    [colorsProp, mode, accent],
  );

  const bodyData = useMemo(
    () => precomputed ?? calculateMuscleVolume(exercises ?? []).bodyData,
    [exercises, precomputed],
  );

  return (
    <View style={{ width: WIDTH, height: HEIGHT, overflow: 'hidden' }} pointerEvents="none">
      <Body
        data={bodyData}
        side={side}
        gender="male"
        scale={scale}
        colors={palette}
        border={borderColor || BORDERS[mode]}
        backColor={backColor}
      />
    </View>
  );
}

export default React.memo(MiniBodyMap);
