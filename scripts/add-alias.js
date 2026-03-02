/**
 * Add a global exercise alias.
 *
 * Usage:
 *   node scripts/add-alias.js "Pull Up (Assisted)" "assisted pull up"
 *
 * The canonical_name must exist in exercises_catalog.
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const [, , alias, canonicalName] = process.argv;

if (!alias || !canonicalName) {
  console.error('Usage: node scripts/add-alias.js "<alias>" "<canonical_name>"');
  console.error('Example: node scripts/add-alias.js "Pull Up (Assisted)" "assisted pull up"');
  process.exit(1);
}

async function main() {
  // 1. Validate canonical_name exists in exercises_catalog
  const { data: catalogEntry, error: catErr } = await supabase
    .from("exercises_catalog")
    .select("name")
    .eq("name", canonicalName)
    .single();

  if (catErr || !catalogEntry) {
    console.error(`Catalog exercise "${canonicalName}" not found.`);

    // Show similar names to help
    const { data: all } = await supabase
      .from("exercises_catalog")
      .select("name")
      .ilike("name", `%${canonicalName.split(" ")[0]}%`);

    if (all && all.length > 0) {
      console.log("\nDid you mean one of these?");
      all.forEach((e) => console.log(`  - ${e.name}`));
    }
    process.exit(1);
  }

  // 2. Insert alias
  const { error: insertErr } = await supabase
    .from("exercise_aliases")
    .insert({ alias, canonical_name: canonicalName });

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.error(`Alias "${alias}" already exists.`);
    } else {
      console.error("Failed to insert alias:", insertErr.message);
    }
    process.exit(1);
  }

  console.log(`Added alias: "${alias}" → "${canonicalName}"`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
