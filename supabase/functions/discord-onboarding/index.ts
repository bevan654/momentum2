Deno.serve(async (req) => {
  const { record, old_record, type } = await req.json();
  const url = Deno.env.get("DISCORD_ONBOARDING_WEBHOOK_URL");

  if (!url) {
    return new Response("missing DISCORD_ONBOARDING_WEBHOOK_URL", { status: 500 });
  }

  // Onboarding completes when gender/age/height/starting_weight all become set.
  // Fire only on the transition (at least one of those was missing before).
  const required = ["gender", "age", "height", "starting_weight"] as const;
  const nowComplete = required.every((k) => record?.[k] !== null && record?.[k] !== undefined && record?.[k] !== "");
  const wasComplete = required.every((k) => old_record?.[k] !== null && old_record?.[k] !== undefined && old_record?.[k] !== "");
  if (type === "UPDATE" && !(nowComplete && !wasComplete)) {
    return new Response("skip");
  }

  const id = record?.id ?? "unknown";
  const username = record?.username ?? null;
  const email = record?.email ?? null;
  const displayName = username ?? email ?? id;

  // Pull nutrition + supplement goals via service role for the full picture.
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let goals: any = null;
  let supps: any = null;
  if (supaUrl && serviceKey && id !== "unknown") {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    try {
      const [g, s] = await Promise.all([
        fetch(`${supaUrl}/rest/v1/nutrition_goals?user_id=eq.${id}&select=*`, { headers }),
        fetch(`${supaUrl}/rest/v1/supplement_goals?user_id=eq.${id}&select=*`, { headers }),
      ]);
      goals = (await g.json())?.[0] ?? null;
      supps = (await s.json())?.[0] ?? null;
    } catch (_) {
      // ignore enrichment failures
    }
  }

  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
  const fmtNum = (v: unknown, unit: string) =>
    v === null || v === undefined ? "—" : `${v}${unit}`;
  const fmtBool = (v: unknown) => (v ? "✅" : "❌");
  const fmtDate = (v: unknown) => {
    if (!v) return "—";
    const t = Math.floor(new Date(String(v)).getTime() / 1000);
    return Number.isFinite(t) ? `<t:${t}:F>` : String(v);
  };
  const ageFromDob = (dob: unknown) => {
    if (!dob) return null;
    const d = new Date(String(dob));
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    return a;
  };

  const age = record?.age ?? ageFromDob(record?.dob);

  const embed = {
    title: "🏁 Onboarding completed",
    description: `**${displayName}** finished onboarding.`,
    color: 0x6366f1,
    timestamp: new Date().toISOString(),
    fields: [
      { name: "Username", value: fmt(username), inline: true },
      { name: "Email", value: fmt(email), inline: true },
      { name: "User ID", value: `\`${id}\``, inline: false },

      { name: "Gender", value: fmt(record?.gender), inline: true },
      { name: "Age", value: fmt(age), inline: true },
      { name: "DOB", value: record?.dob ? fmtDate(record.dob).replace(":F>", ":D>") : "—", inline: true },

      { name: "Height", value: fmtNum(record?.height, " cm"), inline: true },
      { name: "Starting weight", value: fmtNum(record?.starting_weight, " kg"), inline: true },
      { name: "Goal weight", value: fmtNum(record?.goal_weight, " kg"), inline: true },

      {
        name: "Macro goals",
        value: goals
          ? [
              `Calories ${fmtNum(goals.calorie_goal, " kcal")}`,
              `Protein ${fmtNum(goals.protein_goal, "g")}`,
              `Carbs ${fmtNum(goals.carbs_goal, "g")}`,
              `Fat ${fmtNum(goals.fat_goal, "g")}`,
            ].join(" · ")
          : "—",
        inline: false,
      },
      {
        name: "Supplement goals",
        value: supps
          ? [
              `Water ${fmtNum(supps.water_goal, " ml")}`,
              `Creatine ${fmtNum(supps.creatine_goal, "g")}`,
            ].join(" · ")
          : "—",
        inline: false,
      },

      {
        name: "Privacy",
        value: [
          `Share workouts ${fmtBool(record?.share_workouts)}`,
          `Show streak ${fmtBool(record?.show_streak)}`,
          `Leaderboard ${fmtBool(record?.leaderboard_opt_in)}`,
          `Notifications ${fmtBool(record?.notifications_enabled)}`,
        ].join(" · "),
        inline: false,
      },

      { name: "Signed up", value: fmtDate(record?.created_at), inline: true },
      { name: "Completed", value: fmtDate(new Date().toISOString()), inline: true },
    ],
    footer: { text: "Momentum • onboarding" },
  };

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Momentum",
      embeds: [embed],
    }),
  });

  return new Response("ok");
});
