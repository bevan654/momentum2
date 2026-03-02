/**
 * Fixup script: Correct food_catalog entries that got wrong gram values
 * from the first normalization pass (due to pattern-matching order issues).
 *
 * Usage:  node scripts/fix_serving_sizes.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mckuaytsjvjuvobtxaou.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3VheXRzanZqdXZvYnR4YW91Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk0NjkyMywiZXhwIjoyMDg1NTIyOTIzfQ.oVuBG_uFGDJunVELeOqKwTJtP0J092losk2XMGLS82U';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Exact name → correct gram weight.
 * These override the bad values from the first pass.
 */
const FIXES = {
  // Pizza — matched "slice/bread" (30g) but a pizza slice is ~107g
  'Pizza Slice (pepperoni)': 107,
  'Pizza Slice (cheese)': 107,

  // Naan — matched "bread" (30g) but naan is ~90g
  'Naan Bread': 90,

  // Pita — matched "bread" (30g) but pita is ~60g
  'Pita Bread': 60,

  // Nut butters — matched "butter" (14g) but 1 tbsp is 32g
  'Peanut Butter': 32,
  'Almond Butter': 32,

  // Fast food burgers/sandwiches — matched "cheese" (28g) or generic (100g)
  'Quarter Pounder w/ Cheese': 200,
  'Grilled Cheese Sandwich': 200,
  'Cheeseburger': 156,
  'Hamburger (single patty)': 150,
  'Big Mac': 200,
  'Whopper': 270,
  'McChicken': 147,
  'Hot Dog': 98,

  // Rice Cakes — matched "rice" (158g) but one rice cake is ~9g
  'Rice Cakes': 9,

  // Sushi rolls — matched "roll" for bread roll (50g) but a full sushi roll is ~200g
  'Sushi Roll (Salmon)': 200,
  'Sushi Roll (California)': 200,

  // Wraps — matched tortilla "wrap" (65g) but filled wraps are heavier
  'Chicken Wrap': 250,
  'Chicken Caesar Wrap': 250,

  // Burritos — matched "chicken"/"beef" instead of "burrito"
  'Burrito (chicken)': 300,
  'Burrito (beef)': 300,
  'Burrito Bowl (chicken)': 500,

  // Tacos — matched "beef" (170g) instead of "taco"
  'Taco (beef)': 78,

  // Subs — matched "turkey"/"generic" instead of actual sub weight
  'Footlong Sub (Turkey)': 350,
  'Footlong Sub (Italian BMT)': 350,

  // Beef Jerky — matched "beef" (170g) but 1 serving is ~28g
  'Beef Jerky': 28,

  // Egg items — matched "egg" (50g) but these are composite items
  'Egg McMuffin': 139,
  'Eggs (large)': 50,
  'Scrambled Eggs (2)': 120,
  'Omelette (2 egg, cheese)': 150,
  'Egg Whites': 33,

  // Latte — matched "milk" (244g) but a latte is ~350ml
  'Latte (whole milk)': 350,

  // Chicken items — matched "chicken" generically
  'Chicken McNuggets (6pc)': 96,
  'Chicken Sandwich': 200,

  // Maple Syrup — matched "syrup" (30g) but 1 tbsp is 20g
  'Maple Syrup': 20,
};

async function main() {
  console.log('Fetching items to fix...\n');

  const names = Object.keys(FIXES);

  // Fetch all matching items
  const { data, error } = await supabase
    .from('food_catalog')
    .select('id, name, serving_size, serving_unit')
    .in('name', names);

  if (error) {
    console.error('Error fetching:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('No matching items found. Nothing to fix.');
    return;
  }

  console.log(`Found ${data.length} items to fix:\n`);

  let success = 0;
  let failed = 0;

  for (const item of data) {
    const correctGrams = FIXES[item.name];
    if (correctGrams == null) continue;

    const oldSize = item.serving_size;

    if (Number(oldSize) === correctGrams) {
      console.log(`  SKIP (already correct): "${item.name}" = ${correctGrams}g`);
      continue;
    }

    console.log(`  FIX: "${item.name}" — ${oldSize}g → ${correctGrams}g`);

    const { error: updateError } = await supabase
      .from('food_catalog')
      .update({ serving_size: correctGrams, serving_unit: 'g' })
      .eq('id', item.id);

    if (updateError) {
      console.error(`  FAILED: ${item.name} — ${updateError.message}`);
      failed++;
    } else {
      success++;
    }
  }

  // Check for items in FIXES that weren't found in the database
  const foundNames = new Set(data.map((d) => d.name));
  const missing = names.filter((n) => !foundNames.has(n));
  if (missing.length > 0) {
    console.log(`\n  Not found in DB (${missing.length}):`);
    missing.forEach((n) => console.log(`    - "${n}"`));
  }

  console.log(`\nDone! Fixed: ${success}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
