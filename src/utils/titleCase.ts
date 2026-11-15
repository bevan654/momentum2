/** Capitalise the first letter of every word: "barbell bench press" -> "Barbell Bench Press". */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}
