import { sw, SCREEN_WIDTH } from '../../theme/responsive';
import type { WidgetSize } from '../../types/widget';

export const GRID_COLUMNS = 4;
export const GRID_GAP = sw(10);
export const GRID_PADDING_H = sw(16);

export const SLOT_WIDTH =
  (SCREEN_WIDTH - 2 * GRID_PADDING_H - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;

/** Map predefined size names to column counts */
export const SIZE_COLUMNS: Record<WidgetSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
  full: 4,
};

/** Map column count back to the closest WidgetSize */
export function colsToSize(cols: number): WidgetSize {
  if (cols <= 1) return 'small';
  if (cols === 2) return 'medium';
  if (cols === 3) return 'large';
  return 'full';
}

/** Convert grid column index to pixel X */
export function slotToPixelX(gridX: number): number {
  return gridX * (SLOT_WIDTH + GRID_GAP);
}

/** Pixel width for a widget spanning `slots` columns */
export function widgetPixelWidth(slots: number): number {
  return slots * SLOT_WIDTH + (slots - 1) * GRID_GAP;
}

/** Height snap unit — matches column width for a uniform square grid */
export const SNAP_HEIGHT = SLOT_WIDTH;

/** Convert a pixel width to the nearest column count (clamped 1–4) */
export function pixelWidthToSlots(px: number): number {
  const raw = (px + GRID_GAP) / (SLOT_WIDTH + GRID_GAP);
  return Math.max(1, Math.min(GRID_COLUMNS, Math.round(raw)));
}

/** Snap a pixel height to the nearest grid unit (min 1 unit) */
export function snapHeight(px: number): number {
  return Math.max(SNAP_HEIGHT, Math.round(px / SNAP_HEIGHT) * SNAP_HEIGHT);
}
