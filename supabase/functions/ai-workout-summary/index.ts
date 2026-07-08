// Called from the client right after a workout finishes (WorkoutSummaryModal,
// just-completed mode). Takes the exercises/sets the user just logged plus the
// prevMap snapshot already computed client-side (previous best sets per
// exercise, captured at finish time), computes exact volume/weight deltas
// server-side, and asks DeepSeek to write a short "coach's take" grounded in
// those numbers. No DB reads — the client already has everything needed.

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

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Builds one deterministic fact line per exercise — exact numbers only, so the
 * model never has to (and never should) do its own arithmetic. */
function buildFactLines(
  exercises: InExercise[],
  prevMap: Record<string, { kg: number; reps: number }[]>,
): string[] {
  const lines: string[] = [];

  for (const ex of exercises) {
    const completed = ex.sets.filter((s) => s.completed && s.set_type !== "warmup");
    if (completed.length === 0) continue;

    const timed = ex.exercise_type === "duration";
    const hasKg = ex.exercise_type === "weighted" || ex.exercise_type === "weighted+bodyweight" || !ex.exercise_type;

    let line = `- ${ex.name}: ${completed.length} sets`;

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
        const volPct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;
        line += ` (previous session: top set ${prevTop.kg}kg x${prevTop.reps}, volume ${round(prevVolume)}kg`;
        if (volPct !== null) line += `, ${volPct >= 0 ? "+" : ""}${volPct}% volume`;
        line += ")";
      } else {
        line += " (no previous session on file for this exercise)";
      }
    } else {
      const totalReps = completed.reduce((s, x) => s + x.reps, 0);
      line += `, ${totalReps} reps total`;
    }

    lines.push(line);
  }

  return lines;
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

  const lines = buildFactLines(exercises, prevMap);
  if (lines.length === 0) return json({ error: "Nothing to summarize" }, 400);

  const minutes = Math.round(duration / 60);
  const factsBlock = `Session: ${minutes} min, ${totalExercises} exercises, ${totalSets} sets.\n${lines.join("\n")}`;

  const system = `You are the hype coach inside a fitness app called Momentum, reacting right after the user finishes a workout. This is the moment they open the app for — it should feel like a reward, not a report card. The user is an intermediate-to-advanced lifter who cares about progressive overload.

Return ONLY a JSON object: {"headline": "...", "summary": "..."}.
- headline: max 50 characters. A hype, badge-worthy callout — the kind of line that makes someone want to screenshot it. Exactly one emoji is allowed if it genuinely fits (🔥💪⚡🏆) — never more than one, never forced.
- summary: max 320 characters, 2-4 sentences. Reference the SPECIFIC numbers given below — never invent a number that isn't in the facts. Lead with the single best thing that's genuinely true this session: a weight or volume PR, the heaviest top set, most total reps, or — if nothing in the facts is a clear numerical win — the effort/consistency of showing up and finishing the session. Never lead with a decline. If something did regress, you can acknowledge it briefly in passing, framed as data for next time, but the headline and opening line must be the win.
- Energetic, genuinely proud, a little competitive — like a coach who's hyped about what just happened, not a spreadsheet. No hedging, no generic "great job!" filler, no participation-trophy vagueness — the excitement has to be earned by an actual number from the facts.
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
      temperature: 0.85,
      max_tokens: 220,
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
    const summary = String(parsed.summary ?? "").trim().slice(0, 400);
    if (!headline || !summary) return json({ error: "Incomplete response" }, 502);
    return json({ headline, summary });
  } catch {
    console.error("DeepSeek returned non-JSON:", raw);
    return json({ error: "Failed to parse summary" }, 502);
  }
});
