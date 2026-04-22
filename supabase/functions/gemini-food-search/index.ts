const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifyUser(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

function buildFoodPrompt(query: string): string {
  return `You are a nutrition database. For the food query "${query}", return a JSON array of 5-8 matching food items. Each item must have exactly these fields:
{ "name": string, "brand": string|null, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number|null, "sugar": number|null, "serving_size": number, "serving_unit": string, "vitamin_a": number|null, "vitamin_c": number|null, "vitamin_d": number|null, "vitamin_e": number|null, "vitamin_k": number|null, "vitamin_b6": number|null, "vitamin_b12": number|null, "folate": number|null, "calcium": number|null, "iron": number|null, "magnesium": number|null, "potassium": number|null, "zinc": number|null, "sodium": number|null }
IMPORTANT: Use realistic serving sizes. For branded/restaurant items (e.g. KFC Zinger Fillet, Big Mac), use the actual item size as one serving (e.g. 1 burger, 1 piece). For raw ingredients (e.g. chicken breast, rice), use a typical serving size in grams. All nutritional values must match the serving_size. Calories in kcal, macros in grams, micronutrients in standard units (mcg/mg as appropriate). Return ONLY the JSON array, no markdown, no explanation.`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not configured");
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json({ error: "Missing auth" }, 401);
  }
  const userId = await verifyUser(token);
  if (!userId) {
    return json({ error: "Invalid auth" }, 401);
  }

  let query: string;
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!query) {
    return json({ error: "Missing query" }, 400);
  }
  if (query.length > 200) {
    return json({ error: "Query too long" }, 400);
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildFoodPrompt(query) }] }],
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini upstream error:", geminiRes.status, errText.slice(0, 300));
      return json({ error: "Upstream error", items: [] }, 502);
    }

    const data = await geminiRes.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    let items: unknown[];
    try {
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) items = [];
    } catch {
      console.error("Failed to parse Gemini output:", cleaned.slice(0, 300));
      items = [];
    }

    return json({ items });
  } catch (err) {
    console.error("gemini-food-search error:", err);
    return json({ error: "Internal error", items: [] }, 500);
  }
});
