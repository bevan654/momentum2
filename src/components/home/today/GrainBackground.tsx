import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Rect, FractalNoise, ColorMatrix } from '@shopify/react-native-skia';

// Grey-scale the noise (luminance in all channels), keep its alpha.
const GREY = [
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * Home background: a very fine, faint film-grain texture over the page colour, so the black reads as
 * a matte surface rather than empty space. Drawn once (static), behind everything, untappable.
 */
function GrainBackground({ opacity = 0.11 }: { opacity?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.w} height={size.h} opacity={opacity}>
            <FractalNoise freqX={0.65} freqY={0.65} octaves={3} />
            <ColorMatrix matrix={GREY} />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}

export default React.memo(GrainBackground);
