/** Total volume with its unit, compact above 1,000: "1.2k kg", "800 kg". */
export function formatVolumeKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)}k kg` : `${Math.round(kg)} kg`;
}
