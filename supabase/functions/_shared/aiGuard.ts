// Shared protections for paid AI endpoints (S06 / S07).
//
//  • readJsonBody  — reject oversized bodies before parsing (S07)
//  • reserveUsage  — atomic per-user quota in ai_usage, service-role only (S06)
//  • fetchUpstream — hard deadline on calls to the AI provider (S07)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return _admin;
}
export class HttpError extends Error {
  status;
  constructor(status, message){
    super(message);
    this.status = status;
  }
}
/** Parse a JSON body, refusing anything larger than maxBytes (checked while streaming). */ export async function readJsonBody(req, maxBytes) {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "Request too large");
  if (!req.body) throw new HttpError(400, "Missing body");
  const reader = req.body.getReader();
  const chunks = [];
  let total = 0;
  for(;;){
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch  {}
      throw new HttpError(413, "Request too large");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks){
    buf.set(c, off);
    off += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch  {
    throw new HttpError(400, "Invalid JSON body");
  }
}
/**
 * Reserve one unit of `endpoint` for this user. Returns a release function to
 * refund the unit if the upstream call fails, or null when the user is at
 * their limit (respond 429).
 */ export async function reserveUsage(userId, endpoint, limit, windowHours = 24) {
  const { data, error } = await admin().rpc("reserve_ai_usage", {
    p_user: userId,
    p_endpoint: endpoint,
    p_limit: limit,
    p_window: `${windowHours} hours`
  });
  if (error) {
    // Fail closed: an unknown quota state must not mean unlimited paid calls
    console.error(`[aiGuard] reserve failed for ${endpoint}:`, error.message);
    throw new HttpError(503, "Temporarily unavailable — try again shortly");
  }
  if (data === null || data === undefined) return null;
  const id = data;
  return async ()=>{
    try {
      await admin().rpc("release_ai_usage", {
        p_id: id
      });
    } catch  {}
  };
}
/** fetch() with a hard deadline; throws HttpError(504) on timeout. */ export async function fetchUpstream(url, init, timeoutMs) {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      throw new HttpError(504, "AI provider timed out");
    }
    throw e;
  }
}
