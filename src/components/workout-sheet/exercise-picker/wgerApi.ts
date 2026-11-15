/* ─── External API search (wger.de) ──────────────────── */

export const WGER_SEARCH_URL = 'https://wger.de/api/v2/exercise/search/?language=2&format=json';

/** Wger muscle IDs → canonical muscle names */
export const WGER_MUSCLE_MAP: Record<number, string> = {
  1: 'biceps',        // Biceps brachii
  2: 'shoulders',     // Anterior deltoid
  3: 'abs',           // Serratus anterior
  4: 'chest',         // Pectoralis major
  5: 'triceps',       // Triceps brachii
  6: 'abs',           // Rectus abdominis
  7: 'calves',        // Gastrocnemius
  8: 'glutes',        // Gluteus maximus
  9: 'traps',         // Trapezius
  10: 'quads',        // Quadriceps femoris
  11: 'hamstrings',   // Biceps femoris
  12: 'lats',         // Latissimus dorsi
  13: 'biceps',       // Brachialis
  14: 'obliques',     // Obliquus externus abdominis
  15: 'calves',       // Soleus
};

/** Wger category IDs → UI category strings */
export const WGER_CATEGORY_MAP: Record<number, string> = {
  8: 'Arms', 9: 'Legs', 10: 'Core', 11: 'Chest',
  12: 'Back', 13: 'Shoulders', 14: 'Legs', 15: 'Cardio',
};

/** Wger equipment IDs → exercise type */
export const WGER_BW_EQUIPMENT = new Set([7]); // 7 = "none (bodyweight)"

export interface WgerSearchResult {
  value: string;  // exercise name
  data: {
    id: number;
    base_id: number;
    name: string;
    category: string;
  };
}

export interface WgerExerciseInfo {
  muscles: { id: number; name_en: string }[];
  muscles_secondary: { id: number; name_en: string }[];
  equipment: { id: number; name: string }[];
  category: { id: number; name: string };
}
