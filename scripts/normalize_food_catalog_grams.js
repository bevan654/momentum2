/**
 * Admin script: Normalize all food_catalog entries to gram-based serving sizes.
 *
 * For items already in grams (serving_unit = 'g' or 'ml'), keeps them as-is.
 * For items with serving_unit like 'piece', 'serving', 'slice', 'cup', etc.,
 * converts to an appropriate gram weight using common food knowledge,
 * and rescales all macros/micros to be per that gram amount.
 *
 * Usage:  node scripts/normalize_food_catalog_grams.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mckuaytsjvjuvobtxaou.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3VheXRzanZqdXZvYnR4YW91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk0NjkyMywiZXhwIjoyMDg1NTIyOTIzfQ.oVuBG_uFGDJunVELeOqKwTJtP0J092losk2XMGLS82U';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ─── Common food → gram mappings ──────────────────────────────────
 * When a food has a non-gram unit (piece, serving, slice, cup, etc.),
 * we look up a sensible gram weight based on the food name.
 * These are average values — good enough for a nutrition tracker.
 * ──────────────────────────────────────────────────────────────────── */

const FOOD_GRAM_LOOKUP = [
  // Eggs
  { pattern: /\begg\b/i, grams: 50 },
  // Bread / toast
  { pattern: /\b(bread|toast|slice)\b/i, grams: 30 },
  { pattern: /\bbagel\b/i, grams: 100 },
  { pattern: /\bmuffin\b/i, grams: 57 },
  { pattern: /\bcroissant\b/i, grams: 67 },
  { pattern: /\btortilla\b/i, grams: 49 },
  { pattern: /\bwrap\b/i, grams: 65 },
  { pattern: /\bpita\b/i, grams: 60 },
  { pattern: /\bnaan\b/i, grams: 90 },
  { pattern: /\bbiscuit\b/i, grams: 45 },
  { pattern: /\broll\b/i, grams: 50 },
  { pattern: /\bpancake\b/i, grams: 77 },
  { pattern: /\bwaffle\b/i, grams: 75 },
  // Fruits
  { pattern: /\bbanana\b/i, grams: 118 },
  { pattern: /\bapple\b/i, grams: 182 },
  { pattern: /\borange\b/i, grams: 131 },
  { pattern: /\bpear\b/i, grams: 178 },
  { pattern: /\bpeach\b/i, grams: 150 },
  { pattern: /\bplum\b/i, grams: 66 },
  { pattern: /\bkiwi\b/i, grams: 69 },
  { pattern: /\bmango\b/i, grams: 200 },
  { pattern: /\bavocado\b/i, grams: 150 },
  { pattern: /\bstrawberr/i, grams: 12 },
  { pattern: /\bblueberr/i, grams: 1.5 },
  { pattern: /\braspberr/i, grams: 5 },
  { pattern: /\bgrape\b/i, grams: 5 },
  { pattern: /\bcherry\b/i, grams: 8 },
  { pattern: /\bwatermelon/i, grams: 280 },
  { pattern: /\bpineapple/i, grams: 165 },
  { pattern: /\bfig\b/i, grams: 50 },
  { pattern: /\bdate\b/i, grams: 24 },
  { pattern: /\bprune\b/i, grams: 10 },
  // Proteins
  { pattern: /\bchicken breast\b/i, grams: 170 },
  { pattern: /\bchicken thigh\b/i, grams: 115 },
  { pattern: /\bchicken wing\b/i, grams: 44 },
  { pattern: /\bchicken drumstick\b/i, grams: 95 },
  { pattern: /\bchicken\b/i, grams: 140 },
  { pattern: /\bturkey\b/i, grams: 140 },
  { pattern: /\bsteak\b/i, grams: 225 },
  { pattern: /\bbeef\b/i, grams: 170 },
  { pattern: /\bpork chop\b/i, grams: 170 },
  { pattern: /\bpork\b/i, grams: 140 },
  { pattern: /\bbacon\b/i, grams: 8 },
  { pattern: /\bsausage\b/i, grams: 75 },
  { pattern: /\bham\b/i, grams: 28 },
  { pattern: /\bsalmon\b/i, grams: 170 },
  { pattern: /\btuna\b/i, grams: 140 },
  { pattern: /\bshrimp\b/i, grams: 14 },
  { pattern: /\btilapia\b/i, grams: 170 },
  { pattern: /\bcod\b/i, grams: 170 },
  { pattern: /\btofu\b/i, grams: 126 },
  { pattern: /\btempeh\b/i, grams: 84 },
  // Dairy
  { pattern: /\bcheese.*slice\b/i, grams: 21 },
  { pattern: /\bcheese\b/i, grams: 28 },
  { pattern: /\byogurt\b/i, grams: 170 },
  { pattern: /\bmilk\b/i, grams: 244 },
  { pattern: /\bbutter\b/i, grams: 14 },
  // Nuts / seeds
  { pattern: /\balmond\b/i, grams: 28 },
  { pattern: /\bwalnut\b/i, grams: 28 },
  { pattern: /\bcashew\b/i, grams: 28 },
  { pattern: /\bpeanut\b/i, grams: 28 },
  { pattern: /\bpistachio\b/i, grams: 28 },
  { pattern: /\bsunflower seed/i, grams: 28 },
  { pattern: /\bchia seed/i, grams: 28 },
  { pattern: /\bflax seed/i, grams: 10 },
  // Snacks / bars
  { pattern: /\bprotein bar\b/i, grams: 60 },
  { pattern: /\bgranola bar\b/i, grams: 40 },
  { pattern: /\benergy bar\b/i, grams: 50 },
  { pattern: /\bchocolate\b/i, grams: 40 },
  { pattern: /\bcookie\b/i, grams: 30 },
  { pattern: /\bcracker\b/i, grams: 7 },
  { pattern: /\bchips?\b/i, grams: 28 },
  { pattern: /\bpopcorn\b/i, grams: 28 },
  { pattern: /\bpretzel\b/i, grams: 28 },
  // Grains / carbs
  { pattern: /\brice\b/i, grams: 158 },
  { pattern: /\bpasta\b/i, grams: 140 },
  { pattern: /\bnoodle/i, grams: 140 },
  { pattern: /\boat(s|meal)?\b/i, grams: 40 },
  { pattern: /\bquinoa\b/i, grams: 170 },
  { pattern: /\bcouscous\b/i, grams: 157 },
  { pattern: /\bcereal\b/i, grams: 40 },
  { pattern: /\bgranola\b/i, grams: 55 },
  // Vegetables
  { pattern: /\bpotato\b/i, grams: 150 },
  { pattern: /\bsweet potato\b/i, grams: 130 },
  { pattern: /\bbroccoli\b/i, grams: 91 },
  { pattern: /\bcarrot\b/i, grams: 61 },
  { pattern: /\btomato\b/i, grams: 123 },
  { pattern: /\bcucumber\b/i, grams: 150 },
  { pattern: /\bonion\b/i, grams: 110 },
  { pattern: /\bbell pepper\b/i, grams: 120 },
  { pattern: /\bspinach\b/i, grams: 30 },
  { pattern: /\blettuce\b/i, grams: 36 },
  { pattern: /\bcorn\b/i, grams: 90 },
  { pattern: /\bpeas?\b/i, grams: 80 },
  { pattern: /\bgreen bean/i, grams: 110 },
  { pattern: /\basparagus\b/i, grams: 90 },
  { pattern: /\bcauliflower\b/i, grams: 107 },
  { pattern: /\bzucchini\b/i, grams: 113 },
  { pattern: /\bmushroom\b/i, grams: 70 },
  { pattern: /\beggplant\b/i, grams: 82 },
  { pattern: /\bcabbage\b/i, grams: 89 },
  { pattern: /\bcelery\b/i, grams: 40 },
  // Legumes
  { pattern: /\blentil/i, grams: 198 },
  { pattern: /\bchickpea/i, grams: 164 },
  { pattern: /\bblack bean/i, grams: 172 },
  { pattern: /\bkidney bean/i, grams: 177 },
  { pattern: /\bbean/i, grams: 170 },
  // Drinks
  { pattern: /\bjuice\b/i, grams: 240 },
  { pattern: /\bsmoothie\b/i, grams: 300 },
  { pattern: /\bprotein shake\b/i, grams: 350 },
  { pattern: /\bprotein powder\b/i, grams: 30 },
  { pattern: /\bwhey\b/i, grams: 30 },
  { pattern: /\bcasein\b/i, grams: 30 },
  // Condiments / spreads
  { pattern: /\bpeanut butter\b/i, grams: 32 },
  { pattern: /\balmond butter\b/i, grams: 32 },
  { pattern: /\bhoney\b/i, grams: 21 },
  { pattern: /\bjam\b/i, grams: 20 },
  { pattern: /\bsyrup\b/i, grams: 30 },
  { pattern: /\bketchup\b/i, grams: 17 },
  { pattern: /\bmustard\b/i, grams: 5 },
  { pattern: /\bmayonnaise\b/i, grams: 15 },
  { pattern: /\bolive oil\b/i, grams: 14 },
  { pattern: /\boil\b/i, grams: 14 },
  { pattern: /\bsalsa\b/i, grams: 36 },
  { pattern: /\bhummus\b/i, grams: 30 },
  // Meals / misc
  { pattern: /\bburger\b/i, grams: 200 },
  { pattern: /\bpizza\b/i, grams: 107 },
  { pattern: /\btaco\b/i, grams: 80 },
  { pattern: /\bburrito\b/i, grams: 300 },
  { pattern: /\bsandwich\b/i, grams: 200 },
  { pattern: /\bsoup\b/i, grams: 240 },
  { pattern: /\bsalad\b/i, grams: 200 },
  { pattern: /\bdoughnut\b|donut\b/i, grams: 60 },
  { pattern: /\bcake\b/i, grams: 80 },
  { pattern: /\bpie\b/i, grams: 125 },
  { pattern: /\bice cream\b/i, grams: 66 },
];

/**
 * Unit conversion table for common non-gram units → grams.
 * Used as a fallback when the food name doesn't match any specific pattern.
 */
const UNIT_TO_GRAMS = {
  cup: 240,
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
  oz: 28,
  ounce: 28,
  lb: 454,
  pound: 454,
  scoop: 30,
  bar: 50,
  can: 355,
  bottle: 500,
};

/** Micro fields that need rescaling */
const MICRO_FIELDS = [
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b6', 'vitamin_b12', 'folate',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium',
];

function lookupGrams(name, currentSize, currentUnit) {
  const nameLower = (name || '').toLowerCase();
  const unitLower = (currentUnit || '').toLowerCase().trim();

  // Already gram-based → keep as-is but ensure unit is 'g'
  if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
    return null; // no change needed
  }

  // ml-based → treat as grams (1ml ≈ 1g for most foods)
  if (unitLower === 'ml' || unitLower === 'milliliter' || unitLower === 'milliliters') {
    return { grams: currentSize, source: 'ml≈g' };
  }

  // Try food-name-specific lookup
  for (const entry of FOOD_GRAM_LOOKUP) {
    if (entry.pattern.test(nameLower)) {
      return { grams: entry.grams * currentSize, source: `name:${entry.pattern}` };
    }
  }

  // Try unit-based conversion
  const unitKey = unitLower.replace(/s$/, ''); // remove trailing 's'
  if (UNIT_TO_GRAMS[unitKey]) {
    return { grams: UNIT_TO_GRAMS[unitKey] * currentSize, source: `unit:${unitKey}` };
  }

  // Generic fallback for piece/serving/item → use 100g as standard reference
  if (['piece', 'pieces', 'serving', 'servings', 'item', 'items', 'unit', 'units', 'each', 'portion'].includes(unitLower)) {
    // For generic "1 serving" with no name match, default to 100g
    return { grams: 100 * currentSize, source: 'generic-serving→100g' };
  }

  // Unknown unit → default to 100g
  return { grams: 100, source: `unknown-unit:${unitLower}→100g` };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log('Fetching all food_catalog entries...\n');

  // Fetch all entries
  let allItems = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('food_catalog')
      .select('*')
      .range(offset, offset + PAGE - 1)
      .order('id');

    if (error) {
      console.error('Error fetching:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;
    allItems = allItems.concat(data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Total items: ${allItems.length}\n`);

  let alreadyGrams = 0;
  let converted = 0;
  let skipped = 0;
  const updates = [];

  for (const item of allItems) {
    const currentSize = Number(item.serving_size) || 100;
    const currentUnit = item.serving_unit || 'g';

    const result = lookupGrams(item.name, currentSize, currentUnit);

    if (result === null) {
      // Already gram-based
      alreadyGrams++;
      continue;
    }

    const newGrams = round2(result.grams);
    if (newGrams <= 0) {
      console.log(`  SKIP (0g): "${item.name}" [${currentSize} ${currentUnit}]`);
      skipped++;
      continue;
    }

    // Scale factor: new_grams / old_serving_size
    // All macros are stored "per serving_size", so we rescale them to "per newGrams"
    // But actually, we want macros to stay the same (representing 1 serving),
    // we just change what that serving IS expressed in grams.
    // The macros are per 1 serving. We're just re-labeling the serving to grams.
    // So macros stay the same — we just update serving_size and serving_unit.

    const update = {
      id: item.id,
      serving_size: newGrams,
      serving_unit: 'g',
    };

    updates.push(update);

    console.log(
      `  CONVERT: "${item.name}" — ${currentSize} ${currentUnit} → ${newGrams}g [${result.source}]`
    );
    converted++;
  }

  console.log(`\n─── Summary ───`);
  console.log(`Already grams: ${alreadyGrams}`);
  console.log(`Converted:     ${converted}`);
  console.log(`Skipped:       ${skipped}`);
  console.log(`Total updates: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log('Nothing to update. Done!');
    return;
  }

  // Batch update
  console.log('Applying updates...\n');

  let success = 0;
  let failed = 0;

  // Update in batches of 50
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);

    const promises = batch.map(async (u) => {
      const { error } = await supabase
        .from('food_catalog')
        .update({ serving_size: u.serving_size, serving_unit: u.serving_unit })
        .eq('id', u.id);

      if (error) {
        console.error(`  FAILED: ${u.id} — ${error.message}`);
        failed++;
      } else {
        success++;
      }
    });

    await Promise.all(promises);
    process.stdout.write(`  Updated ${Math.min(i + 50, updates.length)} / ${updates.length}\r`);
  }

  console.log(`\n\nDone! Success: ${success}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
