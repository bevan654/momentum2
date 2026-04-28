Deno.serve(async (req) => {
  const { record, old_record, type } = await req.json();
  const url = Deno.env.get("DISCORD_WEBHOOK_URL");

  if (!url) {
    return new Response("missing DISCORD_WEBHOOK_URL", { status: 500 });
  }

  // Signup completes when username transitions from null/empty → set.
  // The profile row is pre-created by an auth.users trigger without a username,
  // so we listen on UPDATE and only fire on that specific transition.
  const wasEmpty = !old_record?.username;
  const isSet = !!record?.username;
  if (type === "UPDATE" && !(wasEmpty && isSet)) {
    return new Response("skip");
  }

  const username = record?.username ?? null;
  const email = record?.email ?? null;
  const id = record?.id ?? "unknown";
  const displayName = username ?? email ?? id;

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
    title: "🎉 New Momentum signup",
    description: `**${displayName}** just joined.`,
    color: 0x22c55e,
    timestamp: record?.created_at ?? new Date().toISOString(),
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
      { name: "University", value: fmt(record?.university), inline: false },
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
      { name: "Created at", value: fmtDate(record?.created_at), inline: false },
    ],
    footer: { text: "Momentum • signup" },
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
