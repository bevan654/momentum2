export type Mode = 'camera' | 'context' | 'analyzing' | 'results' | 'empty' | 'error';

export const MAX_CONTEXT_CHARS = 300;

export interface ScanItem {
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  serving_size: number;
  serving_unit: string;
  vitamin_a: number | null; vitamin_c: number | null;
  vitamin_d: number | null; vitamin_e: number | null;
  vitamin_k: number | null; vitamin_b6: number | null;
  vitamin_b12: number | null; folate: number | null;
  calcium: number | null; iron: number | null;
  magnesium: number | null; potassium: number | null;
  zinc: number | null; sodium: number | null;
}

export const STATUS_PHRASES = [
  'Identifying food...',
  'Estimating portion...',
  'Calculating macros...',
];
