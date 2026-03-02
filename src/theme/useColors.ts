import { useMemo } from 'react';
import { useThemeStore, ThemeMode } from '../stores/useThemeStore';

/** Brand accents — derived from the monochrome app icon */
const BRAND_ACCENT_DARK = '#FFFFFF';   // White — ring & M highlights
const BRAND_ACCENT_LIGHT = '#3A3A3C';  // Charcoal — logo background

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  surface: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  accent: string;
  accentMuted: string;
  accentBlue: string;
  accentGreen: string;
  accentOrange: string;
  accentRed: string;
  accentPink: string;

  protein: string;
  carbs: string;
  fat: string;

  water: string;
  creatine: string;

  streak: string;

  tabInactive: string;
  tabActive: string;

  textOnAccent: string;

  ring: { track: string; progress: string };

  cardShadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  actionTintGreen: string;
  actionTintOrange: string;
  diaryPage: string;
}

/* ─── Hex color utilities ──────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  ).toUpperCase();
}

/** Blend `tint` into `base` by `amount` (0 = pure base, 1 = pure tint) */
function mix(base: string, tint: string, amount: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(tint);
  return rgbToHex(
    br + (tr - br) * amount,
    bg + (tg - bg) * amount,
    bb + (tb - bb) * amount,
  );
}

/* ─── Shared semantic colors (theme-independent) ───────── */

const shared = {
  accentBlue: '#3B82F6',
  accentGreen: '#34D399',
  accentOrange: '#F59E0B',
  accentRed: '#EF4444',
  accentPink: '#D946EF',

  protein: '#86EFAC',
  carbs: '#93C5FD',
  fat: '#E9A8F2',

  water: '#60A5FA',
  creatine: '#FBBF24',

  streak: '#F59E0B',
};

/* ─── Base palette values (before accent tinting) ──────── */

interface BasePalette {
  background: string;
  card: string;
  cardBorder: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  tabInactive: string;
  ringTrack: string;
  /** How strongly the accent tints surfaces (0–1) */
  tintBackground: number;
  tintCard: number;
  tintSurface: number;
  tintBorder: number;
  tintRingTrack: number;
  /** Muted accent opacity for subtle accent-tinted elements */
  accentMutedAmount: number;
  /** Shadow config */
  shadowColor: string;
  shadowOffsetY: number;
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const darkBase: BasePalette = {
  background: '#000000',
  card: '#0E0E0E',
  cardBorder: '#1C1C1E',
  surface: '#141414',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  tabInactive: '#636366',
  ringTrack: '#1C1C1E',
  tintBackground: 0.00,
  tintCard: 0.02,
  tintSurface: 0.02,
  tintBorder: 0.03,
  tintRingTrack: 0.02,
  accentMutedAmount: 0.10,
  shadowColor: '#000000',
  shadowOffsetY: 0,
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

const lightBase: BasePalette = {
  background: '#F8F6F2',
  card: '#FFFFFF',
  cardBorder: '#EEECE8',
  surface: '#F0EDE8',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6F',
  textTertiary: '#A5A5AA',
  tabInactive: '#A5A5AA',
  ringTrack: '#EEECE8',
  tintBackground: 0.04,
  tintCard: 0.02,
  tintSurface: 0.05,
  tintBorder: 0.04,
  tintRingTrack: 0.06,
  accentMutedAmount: 0.10,
  shadowColor: '#8B8680',
  shadowOffsetY: 2,
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};

const bases: Record<ThemeMode, BasePalette> = {
  dark: darkBase,
  light: lightBase,
};

/* ─── Build final themed palette (module-level cache) ──── */

let _cacheKey = '';
let _cached: ThemeColors | null = null;

export function getThemeColors(mode: ThemeMode): ThemeColors {
  if (mode === _cacheKey && _cached) return _cached;

  const b = bases[mode];
  const accent = mode === 'dark' ? BRAND_ACCENT_DARK : BRAND_ACCENT_LIGHT;

  const cardColor = mix(b.card, accent, b.tintCard);

  const colors: ThemeColors = {
    ...shared,

    background: mix(b.background, accent, b.tintBackground),
    card: cardColor,
    cardBorder: mix(b.cardBorder, accent, b.tintBorder),
    surface: mix(b.surface, accent, b.tintSurface),

    textPrimary: b.textPrimary,
    textSecondary: b.textSecondary,
    textTertiary: b.textTertiary,
    tabInactive: b.tabInactive,

    accent,
    fat: shared.fat,
    accentMuted: mix(b.background, accent, b.accentMutedAmount),
    textOnAccent: mode === 'dark' ? '#1A1A1A' : '#FFFFFF',
    tabActive: accent,

    ring: {
      track: mix(b.ringTrack, accent, b.tintRingTrack),
      progress: '#34D399',
    },

    cardShadow: {
      shadowColor: b.shadowColor,
      shadowOffset: { width: 0, height: b.shadowOffsetY },
      shadowOpacity: b.shadowOpacity,
      shadowRadius: b.shadowRadius,
      elevation: b.elevation,
    },
    actionTintGreen: mode === 'light' ? '#E8F5E9' : cardColor,
    actionTintOrange: mode === 'light' ? '#FFF3E0' : cardColor,
    diaryPage: mode === 'light' ? '#FAF4EB' : '#0A0A08',
  };

  _cacheKey = mode;
  _cached = colors;
  return colors;
}

/* ─── React hook ───────────────────────────────────────── */

export function useColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  return useMemo(() => getThemeColors(mode), [mode]);
}
