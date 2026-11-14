import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { MiniMuscleMap } from 'momentum-muscle-map';
import { useRegionWeightLookup } from '../../hooks/useRegionWeightLookup';
import { heatValues, regionVolume, type VolumeExercise } from '../../utils/muscleVolume';
import { bodyWidth, useBodies, useMuscleMapColors } from './useBodyMap';

interface Props {
  exercises: readonly VolumeExercise[];
  /** Height of each body, in points. */
  height: number;
  style?: StyleProp<ViewStyle>;
  /** Wraps each body (and its caption). */
  columnStyle?: StyleProp<ViewStyle>;
  /** With a style, FRONT / BACK captions are drawn above the bodies. */
  captionStyle?: StyleProp<TextStyle>;
  /** No silhouette behind the muscles, for share images over a photo. */
  transparentBody?: boolean;
}

/**
 * Static front and back maps of one workout's heat, at group level, for feed cards and share
 * images. Cheap enough for many in a list.
 */
function WorkoutMiniMaps({ exercises, height, style, columnStyle, captionStyle, transparentBody }: Props) {
  const lookup = useRegionWeightLookup();
  const values = useMemo(() => heatValues(regionVolume(exercises, lookup)), [exercises, lookup]);
  const { front, back } = useBodies();
  const colors = useMuscleMapColors(undefined, transparentBody ? 'transparent' : undefined);
  const width = bodyWidth(front, height);

  return (
    <View style={[styles.row, style]} pointerEvents="none">
      <View style={columnStyle}>
        {captionStyle ? <Text style={captionStyle}>FRONT</Text> : null}
        <MiniMuscleMap body={front} values={values} colors={colors} width={width} height={height} accessibilityLabel="Muscles trained, front" />
      </View>
      <View style={columnStyle}>
        {captionStyle ? <Text style={captionStyle}>BACK</Text> : null}
        <MiniMuscleMap body={back} values={values} colors={colors} width={width} height={height} accessibilityLabel="Muscles trained, back" />
      </View>
    </View>
  );
}

export default React.memo(WorkoutMiniMaps);

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
