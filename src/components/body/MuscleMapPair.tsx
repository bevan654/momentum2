import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MuscleMap } from 'momentum-muscle-map';
import type { Level, MuscleMapColors, MuscleValues, PressedRegion } from 'momentum-muscle-map';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { bodyWidth, useBodies } from './useBodyMap';

interface Props {
  /** Same object for both bodies; keep it stable (useMemo). */
  values: MuscleValues;
  level: Level;
  /** Keep it stable (useMuscleMapColors). */
  colors: MuscleMapColors;
  /** Height of each body, in points. */
  height: number;
  /** FRONT / BACK captions above the bodies. */
  captions?: boolean;
  glow?: boolean;
  /** Without it the maps ignore touches. */
  onRegionPress?: (region: PressedRegion) => void;
  gap?: number;
}

/** Front and back body side by side, coloured by `values`, for the signed-in user's gender. */
function MuscleMapPair({ values, level, colors, height, captions, glow, onRegionPress, gap = sw(8) }: Props) {
  const theme = useColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { front, back } = useBodies();
  const width = bodyWidth(front, height);
  const mapStyle = useMemo(() => ({ width, height }), [width, height]);

  const side = (body: typeof front, caption: string, label: string) => (
    <View style={styles.column}>
      {captions && <Text style={styles.caption}>{caption}</Text>}
      <MuscleMap
        body={body}
        values={values}
        level={level}
        colors={colors}
        glow={glow}
        onRegionPress={onRegionPress}
        style={mapStyle}
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <View style={[styles.row, { gap }]}>
      {side(front, 'FRONT', 'Muscle map, front of body')}
      {side(back, 'BACK', 'Muscle map, back of body')}
    </View>
  );
}

export default React.memo(MuscleMapPair);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    column: {
      alignItems: 'center',
      gap: sw(4),
    },
    caption: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.bold,
      letterSpacing: 1.5,
    },
  });
