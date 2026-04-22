import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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

function getWeekStart(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

function weekLabel(offset: number, start: Date): string {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const range = `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
  if (offset === 0) return `This week (${range})`;
  if (offset === -1) return `Last week (${range})`;
  return `${-offset} weeks ago (${range})`;
}

async function fetchWorkoutContext(userId: string): Promise<string> {
  const now = new Date();
  const thisWeekStart = getWeekStart(now);
  const windowStart = new Date(thisWeekStart);
  windowStart.setUTCDate(windowStart.getUTCDate() - 7 * 5);
  const since = windowStart.toISOString();

  const [{ data: profile }, { data: workouts }, { data: weights }] = await Promise.all([
    admin
      .from("profiles")
      .select("username, age, gender, height")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("workouts")
      .select(`
        id, created_at, duration,
        exercises (
          name, exercise_order,
          sets ( kg, reps, set_type )
        )
      `)
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60),
    admin
      .from("weight_entries")
      .select("weight, date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(8),
  ]);

  const lines: string[] = [];
  lines.push(`Today: ${now.toISOString().slice(0, 10)} (UTC).`);

  if (profile) {
    const parts = [
      profile.username && `name: ${profile.username}`,
      profile.age && `age: ${profile.age}`,
      profile.gender && `gender: ${profile.gender}`,
      profile.height && `height: ${profile.height}cm`,
    ].filter(Boolean);
    if (parts.length) lines.push(`Profile — ${parts.join(", ")}.`);
  }

  if (weights && weights.length > 0) {
    const trend = weights.map((w: any) => `${w.weight}kg`).join(" → ");
    lines.push(`Bodyweight (latest → oldest): ${trend}.`);
  }

  if (!workouts || workouts.length === 0) {
    lines.push("\nNo workouts logged in the last 6 weeks.");
    return lines.join("\n");
  }

  const byWeek = new Map<number, any[]>();
  for (const w of workouts) {
    const wDate = new Date(w.created_at);
    const wStart = getWeekStart(wDate);
    const offset = Math.round(
      (wStart.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    if (!byWeek.has(offset)) byWeek.set(offset, []);
    byWeek.get(offset)!.push(w);
  }

  const workoutVolume = (w: any): number => {
    let total = 0;
    for (const ex of w.exercises ?? []) {
      for (const s of ex.sets ?? []) {
        if (s.set_type === "warmup") continue;
        total += (Number(s.kg) || 0) * (Number(s.reps) || 0);
      }
    }
    return Math.round(total);
  };

  lines.push("\nWEEKLY SUMMARY:");
  const offsets = Array.from(byWeek.keys()).sort((a, b) => b - a);
  for (const offset of offsets) {
    const ws = byWeek.get(offset)!;
    const weekStart = new Date(thisWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + offset * 7);
    const totalVol = ws.reduce((sum, w) => sum + workoutVolume(w), 0);
    const totalMin = Math.round(
      ws.reduce((sum, w) => sum + (Number(w.duration) || 0) / 60, 0),
    );
    lines.push(
      `- ${weekLabel(offset, weekStart)}: ${ws.length} sessions, ${totalVol.toLocaleString()}kg total volume, ${totalMin}min time under bar`,
    );
  }

  lines.push("\nDETAILED LOG (most recent first):");
  for (const w of workouts) {
    const wDate = new Date(w.created_at);
    const date = wDate.toISOString().slice(0, 10);
    const wStart = getWeekStart(wDate);
    const offset = Math.round(
      (wStart.getTime() - thisWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
    const weekTag = offset === 0 ? "this week" : offset === -1 ? "last week" : `${-offset}w ago`;
    const dur = w.duration ? `${Math.round(w.duration / 60)}min` : "?";
    lines.push(`- ${date} [${weekTag}] (${dur})`);
    const exercises = (w.exercises ?? []).sort(
      (a: any, b: any) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0),
    );
    for (const ex of exercises) {
      const working = (ex.sets ?? []).filter((s: any) => s.set_type !== "warmup");
      if (working.length === 0) continue;
      const summary = working.map((s: any) => `${s.kg}×${s.reps}`).join(", ");
      lines.push(`    ${ex.name}: ${summary}`);
    }
  }

  return lines.join("\n");
}

function buildSystemPrompt(context: string): string {
  return `You are an evidence-based strength coach embedded in a fitness app called Momentum. The user is an intermediate-to-advanced lifter focused on progressive overload, volume, and training data.

Style:
- Match response length to the question. A quick question gets a quick answer; an analytical question ("compare this week to last week", "how's my progression") gets a thorough breakdown with specific numbers.
- Always ground answers in the user's actual data — reference exercise names, weights, reps, dates, and weekly totals from the context below. Don't invent numbers.
- Plain prose. Bullet points or short lists are fine. No markdown headers (no #), no "consult a doctor" disclaimers, no hedging fluff.
- For week-over-week comparisons, use the WEEKLY SUMMARY table in the context. That's pre-computed for you — lean on it.
- If the user asks something you genuinely can't answer from the data, say exactly what's missing and ask for it. Don't pad with generic advice.
- When giving programming recommendations, be concrete: exercise, sets × reps, weight if calculable from e1RM.

Accuracy rules (CRITICAL):
- Before ever claiming the user "hasn't trained X" or "hasn't hit X in N days", scan the DETAILED LOG for X. If it appears anywhere in the window they asked about, the claim is wrong — do not make it.
- Do not contradict your own context. If you cite "last benched April 17", you cannot also say "haven't trained chest recently" — April 17 IS recent.
- When recommending a session, open by acknowledging what was recently trained ("Your last chest day was April 17 — time for legs today") rather than fabricating an absence.
- If the user asks "when did I last do X?", scan the DETAILED LOG for X and answer with the actual date. If it's not in the log, say "Not in the last 6 weeks of data."

Completeness rules:
- When asked for multi-part content (e.g. "3-day plan", "full week", "all my exercises", "a list of 10..."), deliver EVERY part in ONE response. Never say "Let me know if you want Day 2" or stop partway — finish the whole thing.
- If the user asks for N items/days/weeks, produce N items/days/weeks fully detailed. Don't summarise remaining parts.
- Only split content across messages if the user explicitly asks you to.

Current user context:
${context}`;
}

async function callGemini(
  messages: ChatMessage[],
  systemPrompt: string,
  continuations = 0,
): Promise<{ text: string; truncated: boolean }> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini error:", res.status, errText.slice(0, 400));
    throw new Error(`Gemini ${res.status}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? "";
  const finishReason: string = candidate?.finishReason ?? "";

  console.log("Gemini finishReason:", finishReason, "len:", text.length, "cont:", continuations);

  if (finishReason === "MAX_TOKENS" && continuations < 2 && text.length > 0) {
    const next = await callGemini(
      [
        ...messages,
        { role: "assistant", content: text },
        {
          role: "user",
          content:
            "Continue from exactly where you left off, mid-sentence if that's where you stopped. No preamble, no 'continuing:', no recap — just continue.",
        },
      ],
      systemPrompt,
      continuations + 1,
    );
    return { text: text + next.text, truncated: next.truncated };
  }

  return { text, truncated: finishReason === "MAX_TOKENS" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!GEMINI_API_KEY) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing auth" }, 401);

  const userId = await verifyUser(token);
  if (!userId) return json({ error: "Invalid auth" }, 401);

  const { data: profileRow } = await admin
    .from("profiles")
    .select("ai_coach_enabled, ai_coach_daily_limit")
    .eq("id", userId)
    .maybeSingle();
  if (!profileRow?.ai_coach_enabled) {
    return json({ error: "AI coach is not enabled for this account" }, 403);
  }

  const userLimit = profileRow.ai_coach_daily_limit;
  if (userLimit !== null && userLimit !== undefined && userLimit > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: userMsgCount } = await admin
      .from("ai_coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", since);

    if ((userMsgCount ?? 0) >= userLimit) {
      console.log(`[ai-coach] rate limit: user ${userId} at ${userMsgCount}/${userLimit}`);
      return json(
        {
          error: `You've hit the daily limit of ${userLimit} AI coach messages. Resets in 24 hours.`,
          limit: userLimit,
          used: userMsgCount,
        },
        429,
      );
    }
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (messages.length === 0) {
    return json({ error: "No messages provided" }, 400);
  }
  for (const m of messages) {
    if (typeof m?.content !== "string") {
      return json({ error: "Invalid message" }, 400);
    }
    if (m.role === "user" && m.content.length > 4000) {
      return json({ error: "User message too long" }, 400);
    }
  }
  if (messages.length > 30) {
    messages = messages.slice(-30);
  }

  try {
    const context = await fetchWorkoutContext(userId);
    const systemPrompt = buildSystemPrompt(context);

    const { text, truncated } = await callGemini(messages, systemPrompt);
    const reply = text.trim();

    if (!reply) {
      console.error("Empty reply from Gemini");
      return json({ error: "No reply" }, 502);
    }

    const final = truncated
      ? `${reply}\n\n(Response was very long — ask "continue" if anything got cut off.)`
      : reply;

    return json({ message: final });
  } catch (err) {
    console.error("ai-coach error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
