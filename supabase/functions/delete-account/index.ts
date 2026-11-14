// Permanent account deletion. Deletes ALL of the calling user's data + auth row.
// The user_id is taken from the JWT — the request body is ignored for safety,
// so a compromised client can never delete another user's account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
// Service role bypasses RLS — used only after JWT-based caller verification.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
Deno.serve(async (req)=>{
  if (req.method !== "POST") {
    return json({
      error: "Method not allowed"
    }, 405);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({
      error: "Unauthorized"
    }, 401);
  }
  // Verify the caller from the JWT — never trust a user_id in the body.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return json({
      error: "Unauthorized"
    }, 401);
  }
  const userId = userData.user.id;
  const email = userData.user.email ?? null;
  try {
    // 1. Owned storage objects first. If this fails we stop before touching
    //    the account, so the user can simply retry.
    await deleteOwnedPhotos(admin, userId);
    // 2. Waitlist is keyed by email (no FK) — remove for privacy.
    if (email) {
      const { error } = await admin.from("waitlist").delete().eq("email", email);
      if (error && !isMissingTable(error)) throw new Error(`waitlist: ${error.message}`);
    }
    // 3. Deleting the auth user cascades to every user-owned table in ONE
    //    transaction (migration 20261019_account_deletion_cascades). Either all
    //    rows go, or nothing does and we report failure — never a partial
    //    cleanup reported as success.
    const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("auth.admin.deleteUser failed:", deleteUserErr);
      return json({
        error: "Could not finalize account deletion. Please try again."
      }, 500);
    }
    return json({
      success: true
    });
  } catch (err) {
    console.error("delete-account failed:", err);
    return json({
      error: "Could not delete account. Please try again."
    }, 500);
  }
});
const PHOTO_BUCKET = "workout_photos";
/** Remove every object under workout_photos/<userId>/, paging through the listing. */ async function deleteOwnedPhotos(db, userId) {
  for(let guard = 0; guard < 100; guard++){
    const { data, error } = await db.storage.from(PHOTO_BUCKET).list(userId, {
      limit: 100
    });
    if (error) throw new Error(`list photos: ${error.message}`);
    if (!data || data.length === 0) return;
    const paths = data.map((o)=>`${userId}/${o.name}`);
    const { error: rmErr } = await db.storage.from(PHOTO_BUCKET).remove(paths);
    if (rmErr) throw new Error(`remove photos: ${rmErr.message}`);
  }
  throw new Error("remove photos: too many objects");
}
function isMissingTable(error) {
  return error?.code === "42P01" || /does not exist/i.test(error?.message ?? "");
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
