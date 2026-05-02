import React, { useMemo } from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, G } from 'react-native-svg';

export type GradientStop = { offset: number; color: string };

/**
 * One flame "lobe" stacked into the composite fire.
 * - scale: 0..1 size relative to the outer flame
 * - yShift: viewBox units to push this layer upward (toward the tip)
 * - color: solid hex or vertical gradient stops (bottom → top)
 */
export type FlameLayer = {
  scale: number;
  yShift: number;
  color: string | GradientStop[];
};

// Heroicons "fire" (solid) — outer silhouette only (no inner cut-out).
// Asymmetric, wavy flame shape; bottom-center sits around (10.5, 18).
const FLAME_PATH =
  'M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03z';

let gradCounter = 0;

interface Props {
  size: number;
  /** A solid color or gradient renders a single-layer flame. An array stacks layers (cool/big → hot/small). */
  color?: string | GradientStop[];
  layers?: FlameLayer[];
}

function SolidFlame({ size, color, layers }: Props) {
  const id = useMemo(() => ++gradCounter, []);

  // Normalize: if `layers` not provided, derive a single layer from `color`.
  const resolved: FlameLayer[] = useMemo(() => {
    if (layers && layers.length > 0) return layers;
    return [{ scale: 1, yShift: 0, color: color ?? '#FFFFFF' }];
  }, [layers, color]);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        {resolved.map((layer, i) =>
          Array.isArray(layer.color) ? (
            <LinearGradient key={i} id={`fl-${id}-${i}`} x1="0" y1="1" x2="0" y2="0">
              {layer.color.map((s, j) => (
                <Stop key={j} offset={s.offset} stopColor={s.color} />
              ))}
            </LinearGradient>
          ) : null,
        )}
      </Defs>
      {resolved.map((layer, i) => {
        const fill = Array.isArray(layer.color) ? `url(#fl-${id}-${i})` : (layer.color as string);
        // Heroicons fire's visual mass anchors at (10.5, 18). Re-center it to
        // the canvas center (x=12) so the rendered flame is symmetric in its
        // box and aligns with anything centered below it.
        const transform = `translate(12 ${18 - layer.yShift}) scale(${layer.scale}) translate(-10.5 -18)`;
        return (
          <G key={i} transform={transform}>
            <Path d={FLAME_PATH} fill={fill} />
          </G>
        );
      })}
    </Svg>
  );
}

export default React.memo(SolidFlame);
