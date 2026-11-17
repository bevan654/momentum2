/**
 * Cleans what was typed into a food number field: a comma becomes the decimal mark ("1,5" → "1.5"),
 * and anything else that isn't a digit or the first decimal mark is dropped. Android's numeric
 * keyboard also offers "-", spaces and extra dots, which would save negative or NaN values.
 */
export function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}
