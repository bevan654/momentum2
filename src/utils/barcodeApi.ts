import type { FoodDetailData } from '../components/food/FoodDetailModal';
import { supabase } from '../lib/supabase';

interface BarcodeResult {
  found: boolean;
  food: FoodDetailData | null;
  barcode?: string;
  /** The lookup itself failed (offline, timeout, server error), so "not found" isn't known. */
  error?: boolean;
}

const LOOKUP_TIMEOUT_MS = 10000;

/** fetch with a timeout, so a hung request can't leave the scanner spinning forever. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open Food Facts nutrient name → our field, and the factor from OFF's unit to ours. OFF stores
 * every nutrient value in grams (per 100 g and per serving), so mg fields need × 1000 and mcg
 * fields × 1,000,000.
 */
const OFF_MICROS: [MicroField, string, number][] = [
  ['vitamin_a', 'vitamin-a', 1e6],     // mcg
  ['vitamin_c', 'vitamin-c', 1e3],     // mg
  ['vitamin_d', 'vitamin-d', 1e6],     // mcg
  ['vitamin_e', 'vitamin-e', 1e3],     // mg
  ['vitamin_k', 'vitamin-k', 1e6],     // mcg
  ['vitamin_b6', 'vitamin-b6', 1e3],   // mg
  ['vitamin_b12', 'vitamin-b12', 1e6], // mcg
  ['folate', 'vitamin-b9', 1e6],       // mcg
  ['calcium', 'calcium', 1e3],         // mg
  ['iron', 'iron', 1e3],               // mg
  ['magnesium', 'magnesium', 1e3],     // mg
  ['potassium', 'potassium', 1e3],     // mg
  ['zinc', 'zinc', 1e3],               // mg
  ['sodium', 'sodium', 1e3],           // mg
  ['caffeine', 'caffeine', 1e3],       // mg
];

type MicroField =
  | 'vitamin_a' | 'vitamin_c' | 'vitamin_d' | 'vitamin_e' | 'vitamin_k' | 'vitamin_b6' | 'vitamin_b12'
  | 'folate' | 'calcium' | 'iron' | 'magnesium' | 'potassium' | 'zinc' | 'sodium' | 'caffeine';

const KJ_PER_KCAL = 4.184;

/**
 * Look up a barcode via the Open Food Facts API and map the result
 * to the app's FoodDetailData shape.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  let json: any;
  try {
    const res = await fetchWithTimeout(url);
    // OFF answers an unknown barcode with 404; anything else that isn't OK is a failed lookup.
    if (res.status === 404) return { found: false, food: null };
    if (!res.ok) return { found: false, food: null, error: true };
    json = await res.json();
  } catch {
    return { found: false, food: null, error: true };
  }

  if (json?.status !== 1 || !json.product) {
    return { found: false, food: null };
  }

  const p = json.product;
  const n = p.nutriments ?? {};
  const val = (key: string): number | null => {
    if (n[key] == null) return null;
    const v = Number(n[key]);
    return Number.isFinite(v) ? v : null;
  };
  // Energy in kcal for a basis ('100g' or 'serving'): the kcal field, else kJ converted.
  const kcal = (basis: string): number | null => {
    const k = val(`energy-kcal_${basis}`);
    if (k != null) return k;
    const kj = val(`energy-kj_${basis}`) ?? val(`energy_${basis}`); // OFF's plain "energy" is kJ
    return kj != null ? kj / KJ_PER_KCAL : null;
  };

  // Resolve actual serving size: use serving_quantity from the product when available.
  // Fall back to parsing the serving_size text field (e.g. "72 g", "1 can (72g)").
  const rawServingQty = Number(p.serving_quantity);
  const hasServingQty = Number.isFinite(rawServingQty) && rawServingQty > 0;
  const parsedText = parseServingSizeText(p.serving_size);
  const hasServingSize = hasServingQty || parsedText != null;

  const has100g = kcal('100g') != null || ['proteins', 'carbohydrates', 'fat'].some((k) => val(`${k}_100g`) != null);
  const hasServingData = kcal('serving') != null || ['proteins', 'carbohydrates', 'fat'].some((k) => val(`${k}_serving`) != null);

  // Every value must be for the same serving, so pick one basis:
  // - known serving size: per-100 g values scaled to it (per-serving values fill any gaps);
  // - no serving size but per-100 g data: a 100 g serving the user can correct from the label;
  // - only per-serving data: "1 serving".
  let servingSize: number;
  let servingUnit: string;
  let servingSizeEstimated = false;
  let get: (key: string) => number | null;
  if (hasServingSize) {
    servingSize = hasServingQty ? rawServingQty : parsedText!.size;
    servingUnit = p.serving_quantity_unit || (!hasServingQty && parsedText ? parsedText.unit : 'g');
    const factor = servingSize / 100;
    get = (key) => {
      const per100 = key === 'energy' ? kcal('100g') : val(`${key}_100g`);
      if (per100 != null) return per100 * factor;
      return key === 'energy' ? kcal('serving') : val(`${key}_serving`);
    };
  } else if (has100g || !hasServingData) {
    servingSize = 100;
    servingUnit = 'g';
    servingSizeEstimated = true;
    get = (key) => (key === 'energy' ? kcal('100g') : val(`${key}_100g`));
  } else {
    servingSize = 1;
    servingUnit = 'serving';
    get = (key) => (key === 'energy' ? kcal('serving') : val(`${key}_serving`));
  }

  const nutritionMissing = !has100g && !hasServingData;

  const food: FoodDetailData = {
    name: p.product_name || p.product_name_en || 'Unknown Product',
    brand: p.brands || null,
    food_catalog_id: null,
    calories: num(get('energy')),
    protein: num(get('proteins')),
    carbs: num(get('carbohydrates')),
    fat: num(get('fat')),
    fiber: optNum(get('fiber')),
    sugar: optNum(get('sugars')),
    serving_size: servingSize,
    serving_unit: servingUnit,
    barcode,
    serving_size_estimated: servingSizeEstimated,
    nutrition_missing: nutritionMissing || undefined,
  };
  for (const [field, offKey, factor] of OFF_MICROS) {
    food[field] = optNum(get(offKey), factor);
  }

  return { found: true, food, barcode };
}

/**
 * Upsert a barcode-scanned food into the shared barcode_foods table.
 * Fire-and-forget — errors are silently ignored so the main flow is never blocked.
 */
export async function saveBarcodeFoodToDb(
  barcode: string,
  food: FoodDetailData,
  userId: string,
): Promise<void> {
  // A product with no nutrition data would only add an all-zero row for everyone.
  if (food.nutrition_missing) return;
  try {
    // Try insert first; on conflict bump scan_count
    const { error: insertError } = await supabase
      .from('barcode_foods')
      .insert({
        barcode,
        name: food.name,
        brand: food.brand ?? null,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber ?? null,
        sugar: food.sugar ?? null,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        vitamin_a: food.vitamin_a ?? null,
        vitamin_c: food.vitamin_c ?? null,
        vitamin_d: food.vitamin_d ?? null,
        vitamin_e: food.vitamin_e ?? null,
        vitamin_k: food.vitamin_k ?? null,
        vitamin_b6: food.vitamin_b6 ?? null,
        vitamin_b12: food.vitamin_b12 ?? null,
        folate: food.folate ?? null,
        calcium: food.calcium ?? null,
        iron: food.iron ?? null,
        magnesium: food.magnesium ?? null,
        potassium: food.potassium ?? null,
        zinc: food.zinc ?? null,
        sodium: food.sodium ?? null,
        caffeine: food.caffeine ?? null,
        scanned_by: userId,
      });

    // If duplicate barcode, bump the scan_count via raw SQL increment
    if (insertError?.code === '23505') {
      const { data: existing } = await supabase
        .from('barcode_foods')
        .select('id, scan_count')
        .eq('barcode', barcode)
        .single();

      if (existing) {
        await supabase
          .from('barcode_foods')
          .update({
            scan_count: (existing.scan_count ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      }
    }
  } catch {
    // Silently ignore — saving to barcode_foods is best-effort
  }
}

/**
 * Look up a barcode via the USDA FoodData Central API (alternate source).
 * Uses the free DEMO_KEY — rate-limited but functional.
 */
export async function lookupBarcodeUSDA(barcode: string): Promise<BarcodeResult> {
  // A text search, so ask for a few hits and keep only one whose UPC really is this barcode.
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=5&api_key=DEMO_KEY`;

  try {
    const res = await fetchWithTimeout(url);
    // DEMO_KEY is shared and rate-limited (429): that's a failed lookup, not "not found".
    if (!res.ok) return { found: false, food: null, error: true };

    const json = await res.json();
    const foods: any[] = json.foods || [];
    const target = stripLeadingZeros(barcode);
    const item = foods.find((f) => f.gtinUpc && stripLeadingZeros(String(f.gtinUpc)) === target);
    if (!item) return { found: false, food: null };

    const nutrients: Record<string, number> = {};
    for (const n of item.foodNutrients || []) {
      nutrients[n.nutrientId] = n.value ?? 0;
    }

    const servingSizeEstimated = item.servingSize == null;
    const servingSize = num(item.servingSize || 100);
    const servingUnit = item.servingSizeUnit?.toLowerCase() || 'g';

    // USDA nutrients are per 100g — scale to per-serving
    const scale = servingSize / 100;

    // USDA nutrient IDs (scaled from per-100g → per-serving)
    const cal = num((nutrients[1008] ?? 0) * scale);       // Energy (kcal)
    const protein = num((nutrients[1003] ?? 0) * scale);   // Protein
    const carbs = num((nutrients[1005] ?? 0) * scale);     // Carbohydrates
    const fat = num((nutrients[1004] ?? 0) * scale);       // Total lipid (fat)
    const fiber = optNum(nutrients[1079], scale);           // Fiber
    const sugar = optNum(nutrients[2000], scale);           // Total Sugars
    const sodium = optNum(nutrients[1093], scale);          // Sodium (mg)
    const calcium = optNum(nutrients[1087], scale);         // Calcium (mg)
    const iron = optNum(nutrients[1089], scale);            // Iron (mg)
    const potassium = optNum(nutrients[1092], scale);       // Potassium (mg)
    const magnesium = optNum(nutrients[1090], scale);       // Magnesium (mg)
    const zinc = optNum(nutrients[1095], scale);            // Zinc (mg)
    const vitA = optNum(nutrients[1106], scale);            // Vitamin A (mcg RAE)
    const vitC = optNum(nutrients[1162], scale);            // Vitamin C (mg)
    const vitD = optNum(nutrients[1114], scale);            // Vitamin D (mcg)
    const vitE = optNum(nutrients[1109], scale);            // Vitamin E (mg)
    const vitK = optNum(nutrients[1185], scale);            // Vitamin K (mcg)
    const vitB6 = optNum(nutrients[1175], scale);           // Vitamin B6 (mg)
    const vitB12 = optNum(nutrients[1178], scale);          // Vitamin B12 (mcg)
    const folateVal = optNum(nutrients[1177], scale);       // Folate (mcg DFE)
    const caffeineVal = optNum(nutrients[1057], scale);    // Caffeine (mg)

    const food: FoodDetailData = {
      name: item.description || item.brandName || 'Unknown Product',
      brand: item.brandName || item.brandOwner || null,
      food_catalog_id: null,
      calories: cal,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      serving_size: servingSize,
      serving_unit: servingUnit,
      sodium,
      calcium,
      iron,
      potassium,
      magnesium,
      zinc,
      vitamin_a: vitA,
      vitamin_c: vitC,
      vitamin_d: vitD,
      vitamin_e: vitE,
      vitamin_k: vitK,
      vitamin_b6: vitB6,
      vitamin_b12: vitB12,
      folate: folateVal,
      caffeine: caffeineVal,
      barcode,
      serving_size_estimated: servingSizeEstimated,
    };

    return { found: true, food, barcode };
  } catch {
    return { found: false, food: null, error: true };
  }
}

/* ── helpers ────────────────────────────────────────────── */

/** EAN-13 / UPC-A / GTIN-14 forms of one code differ only by leading zeros. */
function stripLeadingZeros(code: string): string {
  return code.replace(/^0+/, '');
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

function optNum(v: unknown, scale = 1): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * scale * 10) / 10;
}

/** Extract a numeric gram value from OFF's serving_size text field.
 *  Handles formats like "72 g", "72g", "1 can (72g)", "100 ml", etc. */
function parseServingSizeText(text: unknown): { size: number; unit: 'g' | 'ml' } | null {
  if (typeof text !== 'string' || !text) return null;
  // Only trust a number with a g/ml unit ("30 g", "1 can (330 ml)", "12,5 g"). A bare count
  // like "2 biscuits" or "1 cup" isn't a weight, so leave the serving as an estimated 100 g.
  // A comma is a decimal mark only with 1–2 digits after it ("12,5 g"), not "1,000 ml".
  const m = text.match(/(?<![\d.,])(\d+(?:[.,]\d{1,2})?)(?!\d)\s*(g|ml)\b/i);
  if (m) {
    const n = Number(m[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return { size: n, unit: m[2].toLowerCase() === 'ml' ? 'ml' : 'g' };
  }
  return null;
}

