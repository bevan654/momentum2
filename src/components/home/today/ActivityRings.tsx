import React, { useEffect, useMemo } from 'react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { sw } from '../../../theme/responsive';

export interface RingItem {
  key: string;
  /** 0..1 (values above 1 are drawn as a full ring). */
  progress: number;
  color: string;
}

interface Props {
  rings: RingItem[];
  size: number;
  stroke?: number;
  gap?: number;
}

const Ring = React.memo(function Ring({ item, radius, center, stroke }: {
  item: RingItem; radius: number; center: number; stroke: number;
}) {
  const end = useSharedValue(0);
  const target = Math.max(0, Math.min(item.progress, 1));
  useEffect(() => {
    end.value = withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [target]);

  const path = useMemo(() => {
    const p = Skia.Path.Make();
    p.addArc(Skia.XYWHRect(center - radius, center - radius, radius * 2, radius * 2), -90, 360);
    return p;
  }, [center, radius]);

  return (
    <>
      <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" color={item.color + '2E'} />
      <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" end={end} color={item.color} />
    </>
  );
});

/** Concentric progress rings (outermost first), drawn with Skia and animated on the UI thread. */
function ActivityRings({ rings, size, stroke = sw(14), gap = sw(4) }: Props) {
  const center = size / 2;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      {rings.map((r, i) => (
        <Ring
          key={r.key}
          item={r}
          center={center}
          stroke={stroke}
          radius={center - stroke / 2 - i * (stroke + gap)}
        />
      ))}
    </Canvas>
  );
}

export default React.memo(ActivityRings);
