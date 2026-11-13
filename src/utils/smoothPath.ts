import { Skia, type SkPath } from '@shopify/react-native-skia';

/**
 * Build a smooth Catmull-Rom style cubic path through the given points.
 * Ignores NaN/Infinity points. Returns null when fewer than 2 valid points.
 */
export function buildSmoothPath(points: { x: number; y: number }[]): SkPath | null {
  const valid = points.filter((p) => !isNaN(p.y) && isFinite(p.y));
  if (valid.length < 2) return null;
  const path = Skia.Path.Make();
  path.moveTo(valid[0].x, valid[0].y);
  if (valid.length === 2) {
    path.lineTo(valid[1].x, valid[1].y);
    return path;
  }
  for (let i = 1; i < valid.length; i++) {
    const p0 = valid[Math.max(0, i - 2)];
    const p1 = valid[i - 1];
    const p2 = valid[i];
    const p3 = valid[Math.min(valid.length - 1, i + 1)];
    path.cubicTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y,
    );
  }
  return path;
}
