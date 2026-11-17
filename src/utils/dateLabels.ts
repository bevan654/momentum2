import { DAY_SHORT, MONTH_SHORT } from '../constants/dateNames';
import { parseLocalDate } from './localDate';

/** "Sun, Nov 14 · 3:05 PM" (local time). */
export function formatWorkoutDate(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

/** "Nov 14". */
export function formatMonthDay(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Sun, Nov 14". */
export function formatWeekdayMonthDay(d: Date): string {
  return `${DAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 14" from a stored date or timestamp ("2026-11-14" is read as a local date); '' if it can't be read. */
export function formatMonthDayOf(s: string): string {
  const d = parseLocalDate(s);
  return isNaN(d.getTime()) ? '' : formatMonthDay(d);
}
