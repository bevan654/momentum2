import React, { useMemo } from 'react';
import { View } from 'react-native';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { useThemeStore } from '../../stores/useThemeStore';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import { calculateMuscleVolume } from '../../utils/muscleVolume';

/* Brighter palettes so the body is visible at small scale */
const PALETTES = {
  dark: [
    '#1A1A1E', '#2E2E32', '#505054', '#747478', '#A0A0A4', '#D0D0D2', '#FFFFFF',
  ],
  light: [
    '#DCDCDE', '#B4B4B8', '#8E8E92', '#6A6A6E', '#484850', '#2A2A2E', '#1A1A1A',
  ],
};

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

function MiniBodyMap({ exercises, bodyData: precomputed, colors, borderColor, scale = DEFAULT_SCALE, side = 'front', backColor }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const WIDTH = 200 * scale;
  const HEIGHT = 400 * scale;

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
        colors={colors || PALETTES[mode]}
        border={borderColor || BORDERS[mode]}
        backColor={backColor}
      />
    </View>
  );
}

export default React.memo(MiniBodyMap);
