import { toLocalDateString } from '../../../utils/localDate';

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ─── Grid cell type ─────────────────────────────────── */

export type GridCell = { day: number; key: string } | null;

export type MonthData = { name: string; cells: GridCell[]; rows: number };

/* ─── helpers ────────────────────────────────────────── */

export function buildMonthCells(year: number, month: number): { cells: GridCell[]; rows: number } {
  const dim = new Date(year, month + 1, 0).getDate();
  const sd = new Date(year, month, 1).getDay();
  const cells: GridCell[] = [];
  for (let i = 0; i < sd; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    cells.push({ day: d, key: toLocalDateString(new Date(year, month, d)) });
  }
  const rows = Math.ceil(cells.length / 7);
  return { cells, rows };
}
