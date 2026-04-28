// Permanent account deletion. Deletes ALL of the calling user's data + auth row.
// The user_id is taken from the JWT — the request body is ignored for safety,
// so a compromised client can never delete another user's account.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service role bypasses RLS — used only after JWT-based caller verification.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Verify the caller from the JWT — never trust a user_id in the body.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = userData.user.id;

  try {
    await deleteAllUserData(admin, userId);

    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("auth.admin.deleteUser failed:", deleteUserErr);
      return json({ error: "Could not finalize account deletion. Please try again." }, 500);
    }

    return json({ success: true });
  } catch (err) {
    console.error("delete-account fatal:", err);
    return json({ error: "Could not delete account. Please try again." }, 500);
  }
});

/* ─── Deletion sequence ─────────────────────────────────────
   Order matters: rows that have FKs into other tables must be
   removed before their parents. Tables that may not exist yet
   (recent feature work) are wrapped with safeDelete so a missing
   table doesn't abort the run. The auth.users row is deleted last
   in the caller. Each delete is naturally idempotent — retrying
   after a partial failure is safe.
──────────────────────────────────────────────────────────── */

async function deleteAllUserData(db: SupabaseClient, userId: string): Promise<void> {
  // Pre-fetch parent IDs we need for child-row cleanup.
  const workoutIds = await collectIds(db, "workouts", "id", "user_id", userId);
  const routineIds = await collectIds(db, "routines", "id", "user_id", userId);
  const activityIds = await collectIds(db, "activity_feed", "id", "user_id", userId);
  const programIds = await collectIds(db, "programs", "id", "user_id", userId);
  const programDayIds = programIds.length > 0
    ? await collectIdsIn(db, "program_days", "id", "program_id", programIds)
    : [];
  const exerciseIds = workoutIds.length > 0
    ? await collectIdsIn(db, "exercises", "id", "workout_id", workoutIds)
    : [];

  // 1. Reactions / comments / bookmarks — clear before activity_feed + workouts.
  //    Both directions: this user's reactions on others' posts AND others' on this user's.
  await safeDelete(db.from("reactions").delete().eq("user_id", userId));
  if (activityIds.length > 0) {
    await safeDelete(db.from("reactions").delete().in("activity_id", activityIds));
  }
  await safeDelete(db.from("comments").delete().eq("user_id", userId));
  if (activityIds.length > 0) {
    await safeDelete(db.from("comments").delete().in("activity_id", activityIds));
  }
  await safeDelete(db.from("bookmarks").delete().eq("user_id", userId));
  if (activityIds.length > 0) {
    await safeDelete(db.from("bookmarks").delete().in("activity_id", activityIds));
  }

  // 2. activity_feed (FK → workouts, so must clear before workouts)
  await safeDelete(db.from("activity_feed").delete().eq("user_id", userId));

  // 3. Workout chain: sets → exercises → workouts
  if (exerciseIds.length > 0) {
    await safeDelete(db.from("sets").delete().in("exercise_id", exerciseIds));
  }
  if (workoutIds.length > 0) {
    await safeDelete(db.from("exercises").delete().in("workout_id", workoutIds));
  }
  await safeDelete(db.from("workouts").delete().eq("user_id", userId));

  // 4. Routines: routine_exercises → routines
  if (routineIds.length > 0) {
    await safeDelete(db.from("routine_exercises").delete().in("routine_id", routineIds));
  }
  await safeDelete(db.from("routines").delete().eq("user_id", userId));

  // 5. Programs: program_day_exercises → program_days → programs
  if (programDayIds.length > 0) {
    await safeDelete(db.from("program_day_exercises").delete().in("day_id", programDayIds));
  }
  if (programIds.length > 0) {
    await safeDelete(db.from("program_days").delete().in("program_id", programIds));
  }
  await safeDelete(db.from("programs").delete().eq("user_id", userId));

  // 6. Social: friendships + nudges (both directions), notifications, leaderboard
  await safeDelete(
    db.from("friendships").delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`),
  );
  await safeDelete(
    db.from("nudges").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
  );
  await safeDelete(db.from("notifications").delete().eq("user_id", userId));
  await safeDelete(db.from("leaderboard_entries").delete().eq("user_id", userId));

  // 7. Nutrition + supplements + powders. protein_powder_log → food_entries (SET NULL).
  await safeDelete(db.from("protein_powder_log").delete().eq("user_id", userId));
  await safeDelete(db.from("food_entries").delete().eq("user_id", userId));
  await safeDelete(db.from("nutrition_goals").delete().eq("user_id", userId));
  await safeDelete(db.from("meal_config").delete().eq("user_id", userId));
  await safeDelete(db.from("supplement_entries").delete().eq("user_id", userId));
  await safeDelete(db.from("supplement_goals").delete().eq("user_id", userId));
  await safeDelete(db.from("user_supplements").delete().eq("user_id", userId));
  await safeDelete(db.from("protein_powders").delete().eq("user_id", userId));
  await safeDelete(db.from("user_created_foods").delete().eq("created_by", userId));
  await safeDelete(db.from("barcode_foods").delete().eq("scanned_by", userId));

  // 8. Body / lab data
  await safeDelete(db.from("weight_entries").delete().eq("user_id", userId));
  await safeDelete(db.from("body_fat_entries").delete().eq("user_id", userId));
  await safeDelete(db.from("measurement_entries").delete().eq("user_id", userId));

  // 9. Direct messages: messages → conversations (both blocking FKs to auth.users).
  //    Messages may FK conversation_id, so wipe messages from any conversation
  //    the user is in, then drop the conversations themselves.
  const conversationIds = await collectConversationIds(db, userId);
  if (conversationIds.length > 0) {
    await safeDelete(db.from("messages").delete().in("conversation_id", conversationIds));
  }
  // Defensive: messages this user sent in any other conversation
  await safeDelete(db.from("messages").delete().eq("sender_id", userId));
  await safeDelete(
    db.from("conversations").delete().or(`participant_1.eq.${userId},participant_2.eq.${userId}`),
  );

  // 10. Feature flags (per-user overrides)
  await safeDelete(db.from("feature_flags").delete().eq("user_id", userId));

  // 11. Misc per-user state
  await safeDelete(db.from("user_streaks").delete().eq("user_id", userId));
  await safeDelete(db.from("user_exercises").delete().eq("user_id", userId));
  await safeDelete(db.from("user_ranks").delete().eq("user_id", userId));
  await safeDelete(db.from("ai_coach_messages").delete().eq("user_id", userId));

  // 12. Waitlist — keyed by email, not user_id. Remove for privacy.
  const email = await getUserEmail(db, userId);
  if (email) {
    await safeDelete(db.from("waitlist").delete().eq("email", email));
  }

  // 13. Profile (FK to auth.users via id)
  await safeDelete(db.from("profiles").delete().eq("id", userId));
}

async function getUserEmail(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await db.from("profiles").select("email").eq("id", userId).single();
  if (error || !data) return null;
  return data.email ?? null;
}

async function collectConversationIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await db
    .from("conversations")
    .select("id")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
  if (error) {
    if (!isMissingTable(error)) console.warn("collectConversationIds:", error.message);
    return [];
  }
  return (data ?? []).map((row: { id: string }) => row.id).filter(Boolean);
}

async function collectIds(
  db: SupabaseClient,
  table: string,
  idCol: string,
  filterCol: string,
  filterVal: string,
): Promise<string[]> {
  const { data, error } = await db.from(table).select(idCol).eq(filterCol, filterVal);
  if (error) {
    if (!isMissingTable(error)) console.warn(`collectIds(${table}):`, error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, string>) => row[idCol]).filter(Boolean);
}

async function collectIdsIn(
  db: SupabaseClient,
  table: string,
  idCol: string,
  filterCol: string,
  filterVals: string[],
): Promise<string[]> {
  if (filterVals.length === 0) return [];
  const { data, error } = await db.from(table).select(idCol).in(filterCol, filterVals);
  if (error) {
    if (!isMissingTable(error)) console.warn(`collectIdsIn(${table}):`, error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, string>) => row[idCol]).filter(Boolean);
}

async function safeDelete(query: PromiseLike<{ error: { code?: string; message?: string } | null }>): Promise<void> {
  const { error } = await query;
  if (error && !isMissingTable(error)) {
    console.warn("delete row failed:", error.message ?? error);
  }
}

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error?.code === "42P01" || /does not exist/i.test(error?.message ?? "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
