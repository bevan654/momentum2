// Daily cron sweep: computes rule-based workout-history signals per user (streak
// at risk, neglected muscle group, an overload nudge vs. a session ~a week ago,
// or a comeback after a lapse), then asks DeepSeek to turn the single
// highest-priority signal into a short push-notification title/body. Inserting
// into `notifications` is enough to fire a push — the existing `push-notification`
// function is already wired to a DB webhook on that table's INSERT.
//
// Invoked by pg_cron via net.http_post (see the scheduling migration), not by
// end users, so it checks a shared secret instead of a user JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const CONCURRENCY = 5;

// Coarse muscle groups for the "neglected muscle" signal — deliberately coarser
// than the 8-group strength taxonomy in src/constants/muscles.ts (this edge
// function can't import from the app bundle), since a notification only needs
// "legs" not "quads vs hamstrings vs glutes".
const MUSCLE_GROUP: Record<string, string> = {
  chest: "chest",
  lats: "back",
  "upper-back": "back",
  "lower-back": "back",
  traps: "back",
  shoulders: "shoulders",
  "rear-delts": "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  abs: "core",
  obliques: "core",
  quads: "legs",
  adductors: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
};

type Subtype = "comeback" | "streak_risk" | "overload_nudge" | "neglected_muscle";

interface Signal {
  subtype: Subtype;
  facts: Record<string, unknown>;
  cooldownKey?: string; // extra dedupe key for cooldown lookups (e.g. muscle group)
}

function utcDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

function workoutVolume(sets: { kg: number; reps: number; set_type: string }[]): number {
  return sets
    .filter((s) => s.set_type !== "warmup")
    .reduce((sum, s) => sum + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Recent cooldown check: has this user received this subtype (optionally scoped
 * to a cooldownKey, e.g. a specific muscle group) within `days` days? */
async function onCooldown(userId: string, subtype: Subtype, days: number, cooldownKey?: string): Promise<boolean> {
  const since = utcDateStr(new Date(Date.now() - days * DAY_MS));
  const { data } = await admin
    .from("ai_notification_log")
    .select("id, meta")
    .eq("user_id", userId)
    .eq("subtype", subtype)
    .gte("sent_date", since)
    .limit(5);
  if (!data || data.length === 0) return false;
  if (!cooldownKey) return true;
  return data.some((row: any) => row.meta?.cooldown_key === cooldownKey);
}

async function computeSignal(
  userId: string,
  catalogByName: Map<string, string[]>,
): Promise<Signal | null> {
  const now = new Date();
  const today = utcDateStr(now);
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const [{ data: streak }, { data: workouts }] = await Promise.all([
    admin
      .from("user_streaks")
      .select("current_streak, last_workout_date")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("workouts")
      .select("id, created_at, exercises(name, sets(kg, reps, set_type))")
      .eq("user_id", userId)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const loggedToday = (workouts ?? []).some((w: any) => w.created_at.slice(0, 10) === today);
  const lastWorkoutAt = workouts && workouts.length > 0 ? new Date(workouts[0].created_at) : null;

  // 1. Comeback — highest priority. Re-fires at most once a week while someone
  // stays inactive (not every 3 days, not silenced forever after the first nudge).
  const totalHistoricalCount = workouts?.length ?? 0;
  if (totalHistoricalCount >= 3 && lastWorkoutAt) {
    const gapDays = daysBetween(now, lastWorkoutAt);
    if (gapDays >= 4 && !(await onCooldown(userId, "comeback", 7))) {
      return {
        subtype: "comeback",
        facts: { days_since_last_workout: gapDays },
      };
    }
  }

  // 2. Streak risk — self-limiting (only fires while a streak is actually active
  // and nothing's logged today), so no extra cooldown needed beyond same-day dedupe.
  if (streak?.current_streak && streak.current_streak >= 1 && !loggedToday) {
    const last = streak.last_workout_date ? new Date(streak.last_workout_date) : null;
    if (!last || last.toISOString().slice(0, 10) !== today) {
      return {
        subtype: "streak_risk",
        facts: { current_streak: streak.current_streak },
      };
    }
  }

  // 3. Overload nudge — a workout from ~a week ago (6-9 days back) on file, and
  // nothing logged yet today.
  if (!loggedToday && !(await onCooldown(userId, "overload_nudge", 3))) {
    const candidate = (workouts ?? []).find((w: any) => {
      const gap = daysBetween(now, new Date(w.created_at));
      return gap >= 6 && gap <= 9;
    }) as any;
    if (candidate) {
      let bestExercise: string | null = null;
      let bestVolume = 0;
      let bestKg = 0;
      let bestReps = 0;
      for (const ex of candidate.exercises ?? []) {
        const vol = workoutVolume(ex.sets ?? []);
        if (vol > bestVolume) {
          bestVolume = vol;
          bestExercise = ex.name;
          const working = (ex.sets ?? []).filter((s: any) => s.set_type !== "warmup");
          const top = working.reduce(
            (best: any, s: any) => ((Number(s.kg) || 0) * (Number(s.reps) || 0) > best.vol
              ? { kg: s.kg, reps: s.reps, vol: (Number(s.kg) || 0) * (Number(s.reps) || 0) }
              : best),
            { kg: 0, reps: 0, vol: 0 },
          );
          bestKg = top.kg;
          bestReps = top.reps;
        }
      }
      if (bestExercise) {
        return {
          subtype: "overload_nudge",
          facts: {
            exercise: bestExercise,
            kg: bestKg,
            reps: bestReps,
            days_ago: daysBetween(now, new Date(candidate.created_at)),
          },
        };
      }
    }
  }

  // 4. Neglected muscle group — trained at least once in the last 30 days
  // (so we know it's part of their routine) but not in the last 7+.
  const lastTrained = new Map<string, Date>();
  const everTrained = new Set<string>();
  for (const w of workouts ?? []) {
    const wDate = new Date((w as any).created_at);
    for (const ex of (w as any).exercises ?? []) {
      const muscles = catalogByName.get(ex.name.toLowerCase()) ?? [];
      for (const m of muscles) {
        const group = MUSCLE_GROUP[m];
        if (!group) continue;
        everTrained.add(group);
        const prev = lastTrained.get(group);
        if (!prev || wDate > prev) lastTrained.set(group, wDate);
      }
    }
  }
  let worstGroup: string | null = null;
  let worstGap = 0;
  for (const group of everTrained) {
    const gap = daysBetween(now, lastTrained.get(group)!);
    if (gap >= 7 && gap > worstGap) {
      worstGap = gap;
      worstGroup = group;
    }
  }
  if (worstGroup && !(await onCooldown(userId, "neglected_muscle", 7, worstGroup))) {
    return {
      subtype: "neglected_muscle",
      facts: { muscle_group: worstGroup, days_since_trained: worstGap },
      cooldownKey: worstGroup,
    };
  }

  return null;
}

function buildPrompt(subtype: Subtype, facts: Record<string, unknown>): { system: string; user: string } {
  const system = `You write push notifications for Momentum, a fitness app for intermediate-to-advanced lifters who care about progressive overload and training data.

Return ONLY a JSON object: {"title": "...", "body": "..."}.
- title: max 40 characters, a punchy hook, no emoji.
- body: max 100 characters, second person, specific to the numbers given — never invent numbers not provided.
- Motivating, direct, a little competitive. Not cheesy, no exclamation-point spam, no generic "You've got this!" filler.
- No markdown, no quotes around the values, just the JSON object.`;

  const user = `Signal type: ${subtype}\nFacts: ${JSON.stringify(facts)}`;
  return { system, user };
}

async function generateCopy(subtype: Subtype, facts: Record<string, unknown>): Promise<{ title: string; body: string } | null> {
  const { system, user } = buildPrompt(subtype, facts);
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 150,
    }),
  });

  if (!res.ok) {
    console.error("DeepSeek error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const title = String(parsed.title ?? "").trim().slice(0, 60);
    const body = String(parsed.body ?? "").trim().slice(0, 150);
    if (!title) return null;
    return { title, body };
  } catch (e) {
    console.error("DeepSeek returned non-JSON:", raw);
    return null;
  }
}

async function processUser(
  user: { id: string; push_token: string },
  catalogByName: Map<string, string[]>,
): Promise<"sent" | "skipped" | "error"> {
  try {
    const signal = await computeSignal(user.id, catalogByName);
    if (!signal) return "skipped";

    const copy = await generateCopy(signal.subtype, signal.facts);
    if (!copy) return "error";

    const { error: insertErr } = await admin.from("notifications").insert({
      user_id: user.id,
      type: "ai_nudge",
      title: copy.title,
      body: copy.body,
      data: { subtype: signal.subtype, ...signal.facts },
      read: false,
    });
    if (insertErr) {
      console.error(`notifications insert failed for ${user.id}:`, insertErr.message);
      return "error";
    }

    const { error: logErr } = await admin.from("ai_notification_log").insert({
      user_id: user.id,
      subtype: signal.subtype,
      meta: signal.cooldownKey ? { cooldown_key: signal.cooldownKey, ...signal.facts } : signal.facts,
    });
    // A unique-violation here just means another concurrent run already logged
    // today for this user — not a real error, the notification already went out.
    if (logErr && (logErr as any).code !== "23505") {
      console.error(`ai_notification_log insert failed for ${user.id}:`, logErr.message);
    }

    return "sent";
  } catch (e) {
    console.error(`processUser threw for ${user.id}:`, e);
    return "error";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!DEEPSEEK_API_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
  }

  const [{ data: users, error: usersErr }, { data: catalog }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, push_token")
      .eq("notifications_enabled", true)
      .not("push_token", "is", null),
    admin.from("exercises_catalog").select("name, primary_muscles"),
  ]);

  if (usersErr) {
    console.error("Failed to fetch users:", usersErr.message);
    return new Response(JSON.stringify({ error: "Failed to fetch users" }), { status: 500 });
  }

  const catalogByName = new Map<string, string[]>();
  for (const row of catalog ?? []) {
    catalogByName.set((row as any).name.toLowerCase(), (row as any).primary_muscles ?? []);
  }

  const results = await mapWithConcurrency(users ?? [], CONCURRENCY, (u) =>
    processUser(u as any, catalogByName));

  const summary = {
    processed: results.length,
    sent: results.filter((r) => r === "sent").length,
    skipped: results.filter((r) => r === "skipped").length,
    errors: results.filter((r) => r === "error").length,
  };
  console.log("[ai-workout-notifications] run complete:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
