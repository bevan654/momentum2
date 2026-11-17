import { useMemo } from 'react';
import type { BodyData, Level, MuscleMapColors } from 'momentum-muscle-map';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import { useColors } from '../../theme/useColors';

export interface BodyPair {
  front: BodyData;
  back: BodyData;
}

let male: BodyPair | null = null;
let female: BodyPair | null = null;

/**
 * The front and back body for a profile's gender (male unless 'female'). Each body is 62–72 KB of
 * data, so only the two that are shown are loaded, on first use.
 */
function getBodies(gender: string | null | undefined): BodyPair {
  if (gender === 'female') {
    return (female ??= {
      front: require('momentum-muscle-map/data/female-front').default as BodyData,
      back: require('momentum-muscle-map/data/female-back').default as BodyData,
    });
  }
  return (male ??= {
    front: require('momentum-muscle-map/data/male-front').default as BodyData,
    back: require('momentum-muscle-map/data/male-back').default as BodyData,
  });
}

/** The bodies for the signed-in user's profile gender. */
export function useBodies(): BodyPair {
  const gender = useAuthStore((s) => s.profile?.gender);
  return getBodies(gender);
}

/**
 * Map colours from the theme, stable between renders. `accent` defaults to the theme accent;
 * `body` overrides the silhouette (e.g. 'transparent' on share images).
 */
export function useMuscleMapColors(accent?: string, body?: string): MuscleMapColors {
  const colors = useColors();
  const { rest, inert } = colors.muscleMap;
  const a = accent ?? colors.accent;
  const b = body ?? colors.muscleMap.body;
  return useMemo(() => ({ rest, accent: a, inert, body: b }), [rest, a, inert, b]);
}

/** The body's width at a height, keeping its proportions. */
export function bodyWidth(body: BodyData, height: number): number {
  const [x0, y0, x1, y1] = body.bounds;
  return Math.round((height * (x1 - x0)) / (y1 - y0));
}

/** Detail level of the interactive maps, shared and remembered across screens. */
export function useMuscleMapLevel(): [Level, (level: Level) => void] {
  const level = useProfileSettingsStore((s) => s.muscleMapLevel);
  const setLevel = useProfileSettingsStore((s) => s.setMuscleMapLevel);
  return [level, setLevel];
}
