/** Local calendar date as YYYY-MM-DD, in the device's time zone (not UTC). */
export function toLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A YYYY-MM-DD date (a Postgres `date`, or one picked in a calendar) as local midnight.
 * `new Date('2026-11-14')` is UTC midnight, which is still the 13th in the Americas and shifts
 * comparisons with local days elsewhere. Any other string is parsed as usual.
 */
export function parseLocalDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
}
