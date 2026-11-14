import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { MuscleMap, fitBody } from 'momentum-muscle-map';
import type { BodyData, BodyUnit } from 'momentum-muscle-map';
import { useRegionWeightLookup } from '../../hooks/useRegionWeightLookup';
import type { MuscleSource } from '../../utils/muscleVolume';
import { bodyWidth, useBodies, useMuscleMapColors } from './useBodyMap';

/** How much taller the drawn body is than the thumbnail, i.e. the zoom. */
const ZOOM = 2.7;

const unitsByPart = new WeakMap<BodyData, Map<string, BodyUnit>>();

/** A body's part units by unsided slug (one side is enough to find the height of a region). */
function partUnits(body: BodyData): Map<string, BodyUnit> {
  let units = unitsByPart.get(body);
  if (!units) {
    units = new Map();
    for (const unit of body.parts) {
      if (unit.side === 'left') units.set(unit.id.slice(0, -'_left'.length), unit);
    }
    unitsByPart.set(body, units);
  }
  return units;
}

/** Weighted height of the regions an exercise works on one body, and how much of it is there. */
function focusOn(body: BodyData, weights: Record<string, number>): { mass: number; y: number } {
  const units = partUnits(body);
  let mass = 0;
  let y = 0;
  for (const region in weights) {
    const unit = units.get(region);
    if (!unit) continue;
    const m = weights[region]! * weights[region]!; // squared, so the prime movers lead
    mass += m;
    y += m * unit.c[1];
  }
  return { mass, y: mass > 0 ? y / mass : 0 };
}

interface Props {
  exercise: MuscleSource;
  width: number;
  height: number;
  /** Extra style for the clipping frame (radius, opacity, ...). */
  style?: StyleProp<ViewStyle>;
}

/**
 * A close-up of the regions an exercise works, at part level, on whichever side of the body
 * (front or back) carries most of the work. Renders nothing when the exercise has no muscles.
 */
function ExerciseMuscleThumb({ exercise, width, height, style }: Props) {
  const lookup = useRegionWeightLookup();
  const bodies = useBodies();
  const colors = useMuscleMapColors();
  const weights = lookup(exercise);

  const view = useMemo(() => {
    const front = focusOn(bodies.front, weights);
    const back = focusOn(bodies.back, weights);
    if (front.mass === 0 && back.mass === 0) return null;
    const useFront = front.mass >= back.mass;
    const body = useFront ? bodies.front : bodies.back;
    const focusY = useFront ? front.y : back.y;
    const drawnH = height * ZOOM;
    const drawnW = bodyWidth(body, drawnH);
    const { scale, ty } = fitBody(body, drawnW, drawnH);
    const top = Math.min(0, Math.max(height - drawnH, height / 2 - (focusY * scale + ty)));
    return {
      body,
      style: { position: 'absolute' as const, left: (width - drawnW) / 2, top, width: drawnW, height: drawnH },
    };
  }, [bodies, weights, width, height]);

  if (!view) return null;
  return (
    <View style={[styles.clip, { width, height }, style]} pointerEvents="none">
      <MuscleMap
        body={view.body}
        values={weights}
        level="parts"
        colors={colors}
        glow={false}
        animationDuration={0}
        style={view.style}
        accessibilityLabel="Muscles this exercise works"
      />
    </View>
  );
}

export default React.memo(ExerciseMuscleThumb);

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
