import { DAY_SHORT, MONTH_SHORT } from '../constants/dateNames';

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
