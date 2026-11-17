import type { ThemeColors } from '../../theme/useColors';

/** Badge letter for each non-working set type, the same everywhere a set type is shown. */
export const SET_TYPE_LABEL: Readonly<Record<string, string>> = { warmup: 'W', drop: 'D', failure: 'F' };

/**
 * Badge letter and colour for a non-working set type (warm-up W, drop D, failure F), as the live
 * workout and the summary editor show it. null for a working set.
 */
export function setTypeStyle(colors: ThemeColors, setType: string | null | undefined): { label: string; color: string } | null {
  switch (setType) {
    case 'warmup': return { label: SET_TYPE_LABEL.warmup, color: colors.accentOrange };
    case 'drop': return { label: SET_TYPE_LABEL.drop, color: colors.accentBabyBlue };
    case 'failure': return { label: SET_TYPE_LABEL.failure, color: colors.accentRed };
    default: return null;
  }
}
