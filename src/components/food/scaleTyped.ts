/** A value the user typed, the serving scale it was typed at, and what is shown now. */
interface TypedBase {
  typed: string;
  scale: number;
  shown: string;
}

export type TypedBases = Record<string, TypedBase>;

/**
 * Scales a hand-typed value (Food detail) to a new serving scale. It works from what the user
 * typed and the scale at that moment, not from the last rounded value, so stepping the serving
 * through small numbers (100 → 10 → 1 → 50 while retyping) doesn't round the value down to 0.
 * `bases` is kept by the caller across calls (one entry per field); blank stays blank.
 */
export function scaleTyped(
  bases: TypedBases,
  key: string,
  current: string,
  fromScale: number,
  toScale: number,
  decimals: number,
): string {
  let base = bases[key];
  // Different from what was last shown: the user typed it, at `fromScale`.
  if (!base || base.shown !== current) base = { typed: current, scale: fromScale, shown: current };
  const n = Number(base.typed);
  if (base.typed === '' || !Number.isFinite(n) || !(base.scale > 0)) {
    bases[key] = base;
    return current;
  }
  const f = 10 ** decimals;
  const shown = String(Math.round(n * (toScale / base.scale) * f) / f);
  bases[key] = { ...base, shown };
  return shown;
}
