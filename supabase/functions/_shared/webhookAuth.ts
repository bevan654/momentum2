// Shared-secret check for database-webhook functions (S05).
//
// These functions run with the service role and act on whatever record they
// are sent. With JWT verification alone, ANY signed-in user's token passed the
// gateway, so anyone could POST a fake record (e.g. push arbitrary text to any
// user). The database triggers now send `x-webhook-secret`; nothing else knows
// it. Functions are deployed with verify_jwt = false and rely on this check.
const encoder = new TextEncoder();
function timingSafeEqual(a, b) {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for(let i = 0; i < ab.length; i++)diff |= ab[i] ^ bb[i];
  return diff === 0;
}
/** Returns an error Response if the caller isn't our database webhook, else null. */ export function rejectUnlessWebhook(req) {
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected) {
    console.error("WEBHOOK_SECRET is not configured");
    return new Response("server misconfigured", {
      status: 500
    });
  }
  const got = req.headers.get("x-webhook-secret") ?? "";
  if (!timingSafeEqual(got, expected)) {
    return new Response("unauthorized", {
      status: 401
    });
  }
  return null;
}
