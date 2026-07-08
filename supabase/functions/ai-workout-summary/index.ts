// Called from the client right after a workout finishes (WorkoutSummaryModal,
// just-completed mode). Takes the exercises/sets the user just logged plus the
// prevMap snapshot already computed client-side (previous best sets per
// exercise, captured at finish time), computes exact volume/weight deltas
// server-side for every exercise, and asks DeepSeek to write one short note
// per exercise plus an overall headline. No DB reads — the client already has
// everything needed.
//
// Deltas and PR flags are computed here, not by the model — DeepSeek only
// ever writes prose against numbers it's handed, never does its own math.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function verifyUser(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

interface InSet {
  kg: number;
  reps: number;
  completed: boolean;
  set_type: string;
}

interface InExercise {
  name: string;
  exercise_type: string;
  sets: InSet[];
}

interface ExerciseFact {
  name: string;
  line: string;
  hasKg: boolean;
  deltaPct: number | null;
  isWeightPR: boolean;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** One deterministic fact per exercise — exact numbers only, plus a plain-text
 * line for the prompt. deltaPct and isWeightPR are computed here and returned
 * to the client as-is; the model never touches them. */
function buildExerciseFacts(
  exercises: InExercise[],
  prevMap: Record<string, { kg: number; reps: number }[]>,
): ExerciseFact[] {
  const facts: ExerciseFact[] = [];

  for (const ex of exercises) {
    const completed = ex.sets.filter((s) => s.completed && s.set_type !== "warmup");
    if (completed.length === 0) continue;

    const timed = ex.exercise_type === "duration";
    const hasKg = ex.exercise_type === "weighted" || ex.exercise_type === "weighted+bodyweight" || !ex.exercise_type;

    let line = `${ex.name}: ${completed.length} sets`;
    let deltaPct: number | null = null;
    let isWeightPR = false;

    if (timed) {
      const totalSecs = completed.reduce((s, x) => s + x.reps, 0);
      line += `, ${totalSecs}s total`;
    } else if (hasKg) {
      const volume = completed.reduce((s, x) => s + x.kg * x.reps, 0);
      const topSet = completed.reduce((best, x) => (x.kg * x.reps > best.kg * best.reps ? x : best), completed[0]);
      line += `, top set ${topSet.kg}kg x${topSet.reps}, total volume ${round(volume)}kg`;

      const prev = prevMap[ex.name];
      if (prev && prev.length > 0) {
        const prevVolume = prev.reduce((s, p) => s + p.kg * p.reps, 0);
        const prevTop = prev.reduce((best, p) => (p.kg * p.reps > best.kg * best.reps ? p : best), prev[0]);
        deltaPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
        isWeightPR = topSet.kg > prevTop.kg;
        line += ` (previous session: top set ${prevTop.kg}kg x${prevTop.reps}, volume ${round(prevVolume)}kg`;
        if (deltaPct !== null) line += `, ${deltaPct >= 0 ? "+" : ""}${deltaPct}% volume`;
        if (isWeightPR) line += ", NEW TOP WEIGHT";
        line += ")";
      } else {
        line += " (no previous session on file for this exercise)";
      }
    } else {
      const totalReps = completed.reduce((s, x) => s + x.reps, 0);
      line += `, ${totalReps} reps total`;
    }

    facts.push({ name: ex.name, line, hasKg, deltaPct, isWeightPR });
  }

  return facts;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!DEEPSEEK_API_KEY) {
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Missing auth" }, 401);
  const userId = await verifyUser(token);
  if (!userId) return json({ error: "Invalid auth" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const exercises: InExercise[] = Array.isArray(body?.exercises) ? body.exercises : [];
  const prevMap: Record<string, { kg: number; reps: number }[]> = body?.prevMap ?? {};
  const duration: number = Number(body?.duration) || 0;
  const totalSets: number = Number(body?.totalSets) || 0;
  const totalExercises: number = Number(body?.totalExercises) || exercises.length;

  if (exercises.length === 0) return json({ error: "No exercises provided" }, 400);
  if (exercises.length > 30) return json({ error: "Too many exercises" }, 400);

  const facts = buildExerciseFacts(exercises, prevMap);
  if (facts.length === 0) return json({ error: "Nothing to summarize" }, 400);

  const minutes = Math.round(duration / 60);
  const factsBlock = `Session: ${minutes} min, ${totalExercises} exercises, ${totalSets} sets.\n${facts.map((f) => `- ${f.line}`).join("\n")}`;
  const nameList = facts.map((f) => f.name).join(", ");

  const system = `You are the hype coach inside a fitness app called Momentum, reacting right after the user finishes a workout. This is the moment they open the app for — it should feel like a reward, not a report card. The user is an intermediate-to-advanced lifter who cares about progressive overload.

Return ONLY a JSON object: {"headline": "...", "exercises": [{"name": "...", "note": "..."}, ...]}.
- headline: max 50 characters. A hype, badge-worthy verdict on the SESSION AS A WHOLE — the kind of line that makes someone want to screenshot it. Exactly one emoji is allowed if it genuinely fits (🔥💪⚡🏆) — never more than one, never forced.
- exercises: exactly one entry per exercise listed below, in this exact order, using these exact names: ${nameList}
- note: max 100 characters per exercise. Reference the SPECIFIC numbers given for that exercise — never invent a number that isn't in its facts. Call out a genuine win (a new top weight, a volume increase, most reps) where the facts support one; if an exercise regressed, say so plainly and briefly rather than spinning it — the honesty is on a per-exercise basis, the hype is reserved for the headline and for exercises that actually earned it.
- Energetic where earned, factual where it isn't — like a coach who actually watched the session, not a hype machine that congratulates everything equally. No hedging, no generic "great job!" filler.
- Plain text only inside the JSON strings — no markdown.

Facts:
${factsBlock}`;

  const dsRes = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Write the coach's take for this session." },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500,
    }),
  });

  if (!dsRes.ok) {
    console.error("DeepSeek error:", dsRes.status, await dsRes.text());
    return json({ error: "Failed to generate summary" }, 502);
  }

  const dsData = await dsRes.json();
  const raw = dsData?.choices?.[0]?.message?.content;
  if (!raw) return json({ error: "Empty response" }, 502);

  try {
    const parsed = JSON.parse(raw);
    const headline = String(parsed.headline ?? "").trim().slice(0, 80);
    const rawNotes: any[] = Array.isArray(parsed.exercises) ? parsed.exercises : [];

    // Match returned notes back to our deterministic facts by name — the model
    // supplies prose, we supply every number the client renders.
    const noteByName = new Map<string, string>();
    for (const entry of rawNotes) {
      const name = String(entry?.name ?? "").trim();
      const note = String(entry?.note ?? "").trim();
      if (name && note) noteByName.set(name.toLowerCase(), note.slice(0, 140));
    }

    const resultExercises = facts
      .map((f) => ({
        name: f.name,
        note: noteByName.get(f.name.toLowerCase()) ?? "",
        deltaPct: f.deltaPct,
        isPR: f.isWeightPR,
        hasKg: f.hasKg,
      }))
      .filter((e) => e.note.length > 0);

    if (!headline || resultExercises.length === 0) {
      return json({ error: "Incomplete response" }, 502);
    }

    return json({ headline, exercises: resultExercises });
  } catch {
    console.error("DeepSeek returned non-JSON:", raw);
    return json({ error: "Failed to parse summary" }, 502);
  }
});
