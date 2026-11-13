/**
 * Helpers for the exercise catalog's alias table (exercise_aliases: alias → canonical_name).
 * Aliases hold old catalog names and names imported from other apps, so they can still find
 * the exercise they refer to.
 */

/** Invert alias → canonical into canonical → aliases. */
export function aliasesByCanonical(aliasMap: Record<string, string>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    (out[canonical] ||= []).push(alias);
  }
  return out;
}
