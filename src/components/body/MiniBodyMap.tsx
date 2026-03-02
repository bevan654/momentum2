import React, { useMemo } from 'react';
import { View } from 'react-native';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { useThemeStore } from '../../stores/useThemeStore';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import { calculateMuscleVolume } from '../../utils/muscleVolume';

/* Brighter palettes so the body is visible at small scale */
const PALETTES = {
  dark: [
    '#1C2A3A', '#263E55', '#255A80', '#3678A3', '#5BA3CC', '#88E3FA', '#56D4F4',
  ],
  light: [
    '#BCC4CE', '#8AB0D0', '#6090B8', '#4078A8', '#2868A0', '#1656A0', '#1D8FE1',
  ],
};

const BORDERS = { dark: '#3A4A5A', light: '#98A0AC' };

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
