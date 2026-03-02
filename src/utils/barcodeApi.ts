import type { FoodDetailData } from '../components/food/FoodDetailModal';
import { supabase } from '../lib/supabase';

export interface BarcodeResult {
  found: boolean;
  food: FoodDetailData | null;
  barcode?: string;
}

/**
 * Look up a barcode via the Open Food Facts API and map the result
 * to the app's FoodDetailData shape.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  const res = await fetch(url);
  if (!res.ok) return { found: false, food: null };

  const json = await res.json();

  if (json.status !== 1 || !json.product) {
    return { found: false, food: null };
  }

  const p = json.product;
  const n = p.nutriments ?? {};

  // Prefer per-serving values; fall back to per-100 g
  const hasServing = n['energy-kcal_serving'] != null;

  // Resolve actual serving size: use serving_quantity from the product when available,
  // even if per-serving nutrient values aren't pre-computed by OFF.
  // Fall back to parsing the serving_size text field (e.g. "72 g", "1 can (72g)").
  const rawServingQty = Number(p.serving_quantity);
  const hasServingQty = Number.isFinite(rawServingQty) && rawServingQty > 0;
  const parsedText = parseServingSizeText(p.serving_size);
  const servingSizeEstimated = !hasServingQty && parsedText == null;
  const servingSize = hasServingQty
    ? rawServingQty
    : parsedText ?? 100;
  const servingUnit = p.serving_quantity_unit || 'g';

  // Scale factor: per-serving values need no scaling;
  // per-100g values get scaled to the actual serving size.
  const scale = hasServing ? 1 : (hasServingQty ? servingSize / 100 : 1);

  const cal = num((hasServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) * scale);
  const protein = num((hasServing ? n.proteins_serving : n.proteins_100g) * scale);
  const carbs = num((hasServing ? n.carbohydrates_serving : n.carbohydrates_100g) * scale);
  const fat = num((hasServing ? n.fat_serving : n.fat_100g) * scale);
  const fiber = optNum(hasServing ? n.fiber_serving : n.fiber_100g, scale);
  const sugar = optNum(hasServing ? n.sugars_serving : n.sugars_100g, scale);
  const sodium = optNum(hasServing ? n.sodium_serving : n.sodium_100g, scale * 1000); // g → mg

  // Micronutrients (always per-100 g in OFF; scale to serving)
  const microScale = hasServingQty ? servingSize / 100 : 1;

  const food: FoodDetailData = {
    name: p.product_name || p.product_name_en || 'Unknown Product',
    brand: p.brands || null,
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
    vitamin_a: optNum(n['vitamin-a_100g'], microScale),        // mcg
    vitamin_c: optNum(n['vitamin-c_100g'], microScale),        // mg
    vitamin_d: optNum(n['vitamin-d_100g'], microScale),        // mcg
    vitamin_e: optNum(n['vitamin-e_100g'], microScale),        // mg
    vitamin_k: optNum(n['vitamin-k_100g'], microScale),        // mcg
    vitamin_b6: optNum(n['vitamin-b6_100g'], microScale),      // mg
    vitamin_b12: optNum(n['vitamin-b12_100g'], microScale),    // mcg
    folate: optNum(n['vitamin-b9_100g'], microScale),          // mcg
    calcium: optNum(n['calcium_100g'], microScale),            // mg
    iron: optNum(n['iron_100g'], microScale),                  // mg
    magnesium: optNum(n['magnesium_100g'], microScale),        // mg
    potassium: optNum(n['potassium_100g'], microScale),        // mg
    zinc: optNum(n['zinc_100g'], microScale),                  // mg
    barcode,
    serving_size_estimated: servingSizeEstimated,
  };

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
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=1&api_key=DEMO_KEY`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { found: false, food: null };

    const json = await res.json();
    const foods = json.foods;
    if (!foods || foods.length === 0) return { found: false, food: null };

    const item = foods[0];
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
    const calcium = optNum(nutrients[1087], scale);
    const iron = optNum(nutrients[1089], scale);
    const potassium = optNum(nutrients[1092], scale);
    const vitA = optNum(nutrients[1106], scale);            // Vitamin A (mcg RAE)
    const vitC = optNum(nutrients[1162], scale);
    const vitD = optNum(nutrients[1114], scale);

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
      vitamin_a: vitA,
      vitamin_c: vitC,
      vitamin_d: vitD,
      barcode,
      serving_size_estimated: servingSizeEstimated,
    };

    return { found: true, food, barcode };
  } catch {
    return { found: false, food: null };
  }
}

/* ── helpers ────────────────────────────────────────────── */

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
function parseServingSizeText(text: unknown): number | null {
  if (typeof text !== 'string' || !text) return null;
  // Try to match a number followed by g/ml
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:g|ml)\b/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Fallback: just grab the first number in the string
  const m2 = text.match(/(\d+(?:\.\d+)?)/);
  if (m2) {
    const n = Number(m2[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

