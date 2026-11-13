import { supabase } from './supabase';

/** exercises_catalog columns the app uses. The catalog also holds long text (description,
 *  instructions, tips) that the app doesn't show yet, so it isn't downloaded with every row. */
const CATALOG_COLUMNS =
  'id, name, category, primary_muscles, secondary_muscles, is_main_lift, ranking_weight, is_bodyweight, allows_external_weight, exercise_type, is_hidden';
/** PostgREST returns at most 1000 rows per request. */
const PAGE_SIZE = 1000;

/**
 * Fetch every exercises_catalog row, page by page. Falls back to select('*') when the database
 * doesn't have the newer columns yet (before the catalog overhaul migration). Null on failure.
 */
export async function fetchCatalogRows(): Promise<any[] | null> {
  for (const columns of [CATALOG_COLUMNS, '*']) {
    const rows: any[] = [];
    let failed = false;
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('exercises_catalog')
        .select(columns)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) {
        failed = true;
        break;
      }
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    if (!failed) return rows;
  }
  return null;
}
