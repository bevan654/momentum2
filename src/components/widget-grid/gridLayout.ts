import { GRID_COLUMNS, GRID_GAP, slotToPixelX, widgetPixelWidth, SIZE_COLUMNS } from './gridConstants';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetConfig, WidgetPosition } from '../../types/widget';

interface RowItem {
  widget: WidgetConfig;
  cols: number;
  actualCols: number;
}

/**
 * Flow-based layout: pack widgets into rows left-to-right in order.
 *
 * When `fillRows` is true the last widget in each row stretches to fill
 * remaining columns, and all widgets in a row share the tallest height.
 *
 * When `fillRows` is false widgets keep their declared size and only
 * row-height equalisation is applied.
 */
export function computeFlowLayout(
  widgets: WidgetConfig[],
  measuredHeights: Record<string, number>,
  fillRows = true,
): WidgetPosition[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  // Build rows greedily
  const rows: RowItem[][] = [];
  let currentRow: RowItem[] = [];
  let currentRowCols = 0;

  for (const widget of sorted) {
    const cols = SIZE_COLUMNS[widget.size];

    if (currentRowCols + cols > GRID_COLUMNS && currentRow.length > 0) {
      rows.push(fillRows ? stretchLastInRow(currentRow) : currentRow);
      currentRow = [];
      currentRowCols = 0;
    }

    currentRow.push({ widget, cols, actualCols: cols });
    currentRowCols += cols;

    if (currentRowCols === GRID_COLUMNS) {
      rows.push(currentRow); // already full, no stretch needed
      currentRow = [];
      currentRowCols = 0;
    }
  }

  if (currentRow.length > 0) {
    rows.push(fillRows ? stretchLastInRow(currentRow) : currentRow);
  }

  // Position widgets
  const positions: WidgetPosition[] = [];
  let y = 0;

  for (const row of rows) {
    // Compute each widget's height (custom override > measured > default)
    const heights: number[] = row.map((item) => {
      const meta = WIDGET_REGISTRY[item.widget.type];
      return item.widget.customHeight ?? measuredHeights[item.widget.id] ?? meta?.defaultHeight ?? 100;
    });

    // Row advances by the tallest widget so nothing overlaps
    const maxHeight = Math.max(...heights);

    let colX = 0;
    for (let i = 0; i < row.length; i++) {
      const item = row[i];
      // Fill mode: all widgets in the row share the tallest height
      // Fixed mode: each widget keeps its own natural height
      const h = fillRows ? maxHeight : heights[i];

      positions.push({
        id: item.widget.id,
        x: slotToPixelX(colX),
        y,
        width: widgetPixelWidth(item.actualCols),
        height: h,
        cols: item.actualCols,
      });
      colX += item.actualCols;
    }

    y += maxHeight + GRID_GAP;
  }

  return positions;
}

/** Stretch the last widget in a row to fill remaining columns */
function stretchLastInRow(row: RowItem[]): RowItem[] {
  const totalCols = row.reduce((sum, item) => sum + item.cols, 0);
  const extra = GRID_COLUMNS - totalCols;
  if (extra > 0 && row.length > 0) {
    const last = row[row.length - 1];
    return [
      ...row.slice(0, -1),
      { ...last, actualCols: last.cols + extra },
    ];
  }
  return row;
}

/**
 * Free-roam layout: each widget uses its stored freeX/freeY position.
 * No snapping, no row packing — widgets sit exactly where the user placed them.
 */
export function computeFreeLayout(
  widgets: WidgetConfig[],
  measuredHeights: Record<string, number>,
): WidgetPosition[] {
  return widgets.map((w) => {
    const meta = WIDGET_REGISTRY[w.type];
    const cols = SIZE_COLUMNS[w.size];
    return {
      id: w.id,
      x: w.freeX ?? 0,
      y: w.freeY ?? 0,
      width: widgetPixelWidth(cols),
      height: w.customHeight ?? measuredHeights[w.id] ?? meta?.defaultHeight ?? 100,
      cols,
    };
  });
}

/** Total pixel height of the grid */
export function getGridHeight(positions: WidgetPosition[]): number {
  let maxBottom = 0;
  for (const p of positions) {
    const bottom = p.y + p.height;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom;
}

/**
 * After a drag-drop, compute the new order based on drop Y position.
 */
export function reorderAfterDrop(
  widgets: WidgetConfig[],
  movedId: string,
  dropY: number,
  measuredHeights: Record<string, number>,
  fillRows = true,
): WidgetConfig[] {
  const moved = widgets.find((w) => w.id === movedId);
  if (!moved) return widgets;

  const others = widgets
    .filter((w) => w.id !== movedId)
    .sort((a, b) => a.order - b.order)
    .map((w, i) => ({ ...w, order: i }));

  const tempPositions = computeFlowLayout(others, measuredHeights, fillRows);

  let insertIndex = others.length;
  for (let i = 0; i < tempPositions.length; i++) {
    const midY = tempPositions[i].y + tempPositions[i].height / 2;
    if (dropY < midY) {
      insertIndex = i;
      break;
    }
  }

  const result: WidgetConfig[] = [];
  for (let i = 0; i < others.length; i++) {
    if (i === insertIndex) {
      result.push({ ...moved, order: result.length });
    }
    result.push({ ...others[i], order: result.length });
  }
  if (insertIndex >= others.length) {
    result.push({ ...moved, order: result.length });
  }

  return result;
}
