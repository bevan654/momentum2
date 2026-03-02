/**
 * MOCKUP ONLY — Not wired to real data or navigation.
 *
 * Design reference for the Workouts tab redesign.
 * Key design decisions captured here:
 *
 * 1. Hero Card — white card, uppercase "TOTAL VOLUME" label, large volume number,
 *    orange soft session chips, PR + rank badges
 * 2. Inline calorie line — big flame + number + label (no card wrapper)
 * 3. Activity Cards — 2-col grid, icon bubble + unit label + big number + subtitle
 * 4. Muscle Pills — inside a card with "MUSCLES WORKED" uppercase header
 * 5. Exercises — expandable cards with icon bubble, top set preview,
 *    grid set rows with column headers (#, Type, Weight, Reps), alternating bg
 * 6. Rest Day — large icon in soft orange square, motivational copy
 *
 * To implement in real app:
 * - Use useColors() tokens instead of hardcoded C.* values
 * - Use fontFamily (Inter variants) instead of fontWeight
 * - Use sw()/ms() for all dimensions
 * - Use Reanimated for expand animation
 * - Use MiniBodyMap component for body heatmap
 * - Wire to useWorkoutStore, useRankStore, useFoodLogStore
 */

import { useState } from "react";

// ─── Design tokens (mirrors screenshot aesthetic) ─────────────────────────────
const C = {
  bg:       "#F7F8FA",
  card:     "#FFFFFF",
  cardSoft: "#F2F3F7",
  text:     "#111318",
  sub:      "#8A8FA8",
  faint:    "#C5C8D6",
  orange:   "#FF6B35",
  orangeSoft:"#FFF0EB",
  teal:     "#3EC6BF",
  tealSoft: "#E8FAFA",
  gold:     "#F5B731",
  goldSoft: "#FFF9E6",
  red:      "#FF4D4D",
  border:   "#EBEBF0",
};

const WEEK = [
  { letter: "S", date: 26, hasWorkout: false },
  { letter: "M", date: 27, hasWorkout: true  },
  { letter: "T", date: 28, hasWorkout: true  },
  { letter: "W", date: 29, hasWorkout: false },
  { letter: "T", date: 30, hasWorkout: true  },
  { letter: "F", date: 31, hasWorkout: false },
  { letter: "S", date:  1, hasWorkout: false },
];
const TODAY = 31;

const WORKOUT = {
  date: 30,
  sessions: [{ id: "a", name: "Push Day A", time: "7:04 AM", duration: "52 min" }],
  volume: 8240,
  activeMinutes: 52,
  caloriesBurnt: 420,
  pr: true,
  rank: "Elite",
  muscles: ["Chest", "Shoulders", "Triceps", "Front Delt"],
  exercises: [
    {
      id: "1", name: "Bench Press", sets: 4, pr: true,
      topSet: "105 kg x 3",
      completedSets: [
        { num: 1, weight: 60,  reps: 10, type: "warmup",  pr: false },
        { num: 2, weight: 90,  reps: 5,  type: "working", pr: false },
        { num: 3, weight: 100, reps: 5,  type: "working", pr: false },
        { num: 4, weight: 105, reps: 3,  type: "working", pr: true  },
      ],
    },
    {
      id: "2", name: "Incline DB Press", sets: 3, pr: false,
      topSet: "36 kg x 8",
      completedSets: [
        { num: 1, weight: 32, reps: 10, type: "working", pr: false },
        { num: 2, weight: 36, reps: 8,  type: "working", pr: false },
        { num: 3, weight: 36, reps: 6,  type: "failure", pr: false },
      ],
    },
    {
      id: "3", name: "Cable Fly", sets: 3, pr: false,
      topSet: "20 kg x 12",
      completedSets: [
        { num: 1, weight: 18, reps: 15, type: "working", pr: false },
        { num: 2, weight: 20, reps: 12, type: "working", pr: false },
        { num: 3, weight: 20, reps: 10, type: "drop",    pr: false },
      ],
    },
    {
      id: "4", name: "Tricep Pushdown", sets: 3, pr: false,
      topSet: "27.5 kg x 12",
      completedSets: [
        { num: 1, weight: 25,   reps: 15, type: "working", pr: false },
        { num: 2, weight: 27.5, reps: 12, type: "working", pr: false },
        { num: 3, weight: 27.5, reps: 10, type: "working", pr: false },
      ],
    },
  ],
};

const muscleColor = {
  Chest: C.orange, Shoulders: "#FF9055", Triceps: "#FFAD80",
  "Front Delt": "#FFC4A8", Back: C.teal, Biceps: "#45B7D1",
  Quads: "#A78BFA", Hamstrings: "#C4B5FD", Glutes: "#DDD6FE",
};

const typeStyle = {
  warmup:  { bg: "#EEF2FF", color: "#6B7AFF", label: "Warmup" },
  working: null,
  drop:    { bg: C.orangeSoft, color: C.orange, label: "Drop"    },
  failure: { bg: "#FFF0F0",    color: C.red,    label: "Failure" },
};

const exIcons = {
  "Bench Press": "\u{1F3CB}\u{FE0F}", "Incline DB Press": "\u{1F4AA}",
  "Cable Fly": "\u{1F500}", "Tricep Pushdown": "\u{2B07}\u{FE0F}",
};

// ─── Mini Body SVG ────────────────────────────────────────────────────────────
function MiniBodyMap() {
  return (
    <svg viewBox="0 0 70 90" width={70} height={90}>
      <ellipse cx={35} cy={10} rx={9} ry={9}   fill="#E8E9EF" />
      <rect   x={23} y={20}  width={24} height={30} rx={7} fill="#E8E9EF" />
      <rect   x={9}  y={22}  width={12} height={26} rx={5} fill="#E8E9EF" />
      <rect   x={49} y={22}  width={12} height={26} rx={5} fill="#E8E9EF" />
      <rect   x={24} y={51}  width={10} height={32} rx={5} fill="#E8E9EF" />
      <rect   x={36} y={51}  width={10} height={32} rx={5} fill="#E8E9EF" />
      {/* Chest */}
      <rect x={24} y={21} width={22} height={15} rx={5} fill={C.orange} fillOpacity={0.75} />
      {/* Shoulders */}
      <ellipse cx={17} cy={25} rx={6} ry={5} fill="#FF9055" fillOpacity={0.65} />
      <ellipse cx={53} cy={25} rx={6} ry={5} fill="#FF9055" fillOpacity={0.65} />
      {/* Triceps */}
      <rect x={49} y={33} width={11} height={12} rx={4} fill="#FFAD80" fillOpacity={0.6} />
      <rect x={10} y={33} width={11} height={12} rx={4} fill="#FFAD80" fillOpacity={0.6} />
    </svg>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "52px 20px 14px", background: C.bg,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `linear-gradient(135deg, ${C.orange}, #E8441A)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 900, color: "#fff",
        }}>M</div>
        <span style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>Momentum</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: C.orangeSoft, border: `1px solid #FFD5C2`,
          borderRadius: 99, padding: "5px 11px",
        }}>
          <span style={{ fontSize: 14 }}>{"\u{1F525}"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.orange }}>12</span>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.orange}, #E8441A)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, color: "#fff",
          boxShadow: `0 2px 10px ${C.orange}44`,
        }}>B</div>
      </div>
    </div>
  );
}

// ─── DateNavigator ────────────────────────────────────────────────────────────
function DateNavigator({ selected, onSelect }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "8px 12px 14px", background: C.bg,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <button style={{ background: "none", border: "none", color: C.faint, fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>{"\u2039"}</button>
      <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
        {WEEK.map((day, i) => {
          const dist = Math.abs(i - WEEK.findIndex(d => d.date === selected));
          const opacity = Math.max(0.28, 1 - dist * 0.18);
          const isSel   = day.date === selected;
          const isToday = day.date === TODAY;
          return (
            <div key={i} onClick={() => onSelect(day.date)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, cursor: "pointer", opacity,
            }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700,
                color: isSel ? C.orange : C.sub,
                letterSpacing: 0.6, textTransform: "uppercase" }}>{day.letter}</p>

              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isSel ? C.orange : "transparent",
                border: isToday && !isSel ? `2px solid ${C.orange}` : "2px solid transparent",
                boxShadow: isSel ? `0 3px 10px ${C.orange}55` : "none",
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: isSel ? 800 : 600,
                  color: isSel ? "#fff" : isToday ? C.orange : C.text }}>{day.date}</p>
              </div>

              {/* indicator dot */}
              <div style={{
                width: 5, height: 5, borderRadius: "50%", marginTop: -2,
                background: isToday && !isSel
                  ? C.orange
                  : day.hasWorkout && !isSel
                    ? `${C.orange}55`
                    : "transparent",
              }} />
            </div>
          );
        })}
      </div>
      <button style={{ background: "none", border: "none", color: C.faint, fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>{"\u203A"}</button>
    </div>
  );
}

// ─── Summary Modal ────────────────────────────────────────────────────────────
function SummaryModal({ session, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 390, background: C.card,
        borderRadius: "24px 24px 0 0", padding: "20px 20px 40px",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.12)",
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 800, color: C.text }}>{session.name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: C.sub }}>{session.time} {"\u00B7"} {session.duration}</p>
          </div>
          <button onClick={onClose} style={{ background: C.cardSoft, border: "none", borderRadius: 8, padding: "6px 10px", color: C.sub, cursor: "pointer", fontSize: 13 }}>{"\u2715"}</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {[{ l: "Volume", v: "8,240 kg" }, { l: "Sets", v: "24" }, { l: "Duration", v: "52 min" }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: C.cardSoft, borderRadius: 14, padding: "12px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.text }}>{s.v}</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</p>
            </div>
          ))}
        </div>

        <button style={{
          width: "100%", marginTop: 18, padding: "13px 0", borderRadius: 14,
          background: "#FFF0F0", border: "1px solid #FFD5D5",
          color: C.red, fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Delete Workout</button>
      </div>
    </div>
  );
}

// ─── Rest Day ─────────────────────────────────────────────────────────────────
function RestDay({ isToday }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 36px", textAlign: "center" }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, marginBottom: 18,
        background: C.orangeSoft, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 38,
      }}>{isToday ? "\u{1F4C5}" : "\u{1F319}"}</div>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>
        {isToday ? "No workout yet" : "Rest Day"}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: C.sub, lineHeight: 1.6, maxWidth: 240 }}>
        {isToday ? "Ready to train? Kick off a session below." : "Recovery is where the gains happen. You earned it."}
      </p>
      {isToday && (
        <button style={{
          marginTop: 26, padding: "14px 36px", borderRadius: 16,
          background: `linear-gradient(135deg, ${C.orange}, #E8441A)`,
          border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
          boxShadow: `0 6px 22px ${C.orange}44`, cursor: "pointer",
        }}>{"\u26A1"} Start Workout</button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkoutsTab() {
  const [selected, setSelected]     = useState(30);
  const [modal, setModal]           = useState(null);
  const [expanded, setExpanded]     = useState(null);

  const isToday = selected === TODAY;
  const workout = WORKOUT.date === selected ? WORKOUT : null;

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: C.bg, minHeight: "100vh",
      maxWidth: 390, margin: "0 auto", color: C.text,
      paddingBottom: 100,
    }}>
      <Header />
      <DateNavigator selected={selected} onSelect={setSelected} />

      {workout ? (
        <div style={{ padding: "16px 16px 0" }}>

          {/* ── Hero Card ─────────────────────────────────────────────── */}
          <div style={{
            background: C.card, borderRadius: 22,
            padding: "20px 20px 18px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            marginBottom: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              {/* Volume + meta */}
              <div>
                <p style={{ margin: 0, fontSize: 11, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Total Volume</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
                  <span style={{ fontSize: 44, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: C.text }}>
                    {workout.volume.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: C.sub }}>kg</span>
                </div>

                {/* Session chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {workout.sessions.map(s => (
                    <button key={s.id} onClick={() => setModal(s)} style={{
                      background: C.orangeSoft, border: `1px solid #FFD5C2`,
                      borderRadius: 99, padding: "5px 12px",
                      display: "flex", alignItems: "center", gap: 5,
                      color: C.orange, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>
                      {"\u26A1"} {s.name}
                      <span style={{ color: "#FFBFA8", fontWeight: 500 }}>{"\u00B7"} {s.time}</span>
                    </button>
                  ))}
                </div>

                {/* Badges */}
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <span style={{
                    padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                    background: "#FFFBEB", color: C.gold,
                    border: `1px solid #FCE9A0`,
                  }}>{"\u{1F3C6}"} PR</span>
                  <span style={{
                    padding: "4px 11px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                    background: "#FFFBEB", color: C.gold,
                    border: `1px solid #FCE9A0`,
                  }}>Elite</span>
                </div>
              </div>

              {/* Body map */}
              <MiniBodyMap />
            </div>
          </div>

          {/* ── Inline calorie line (big flame + number + label) ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 4px 12px" }}>
            <span style={{ fontSize: 28 }}>{"\u{1F525}"}</span>
            <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, color: C.text }}>{workout.caloriesBurnt}</span>
            <span style={{ fontSize: 15, color: C.sub, fontWeight: 500 }}>Calories burned</span>
          </div>

          {/* ── 2x1 Activity Cards ──────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { icon: "\u{1F525}", label: "Calories Burnt", value: workout.caloriesBurnt, unit: "kcal", color: C.orange, soft: C.orangeSoft },
              { icon: "\u{23F1}",  label: "Active Minutes",  value: workout.activeMinutes,  unit: "min",  color: C.teal,   soft: C.tealSoft  },
            ].map((c, i) => (
              <div key={i} style={{
                background: C.card, borderRadius: 18,
                padding: "16px 16px 14px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: c.soft,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15,
                  }}>{c.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{c.unit}</span>
                </div>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: C.text }}>{c.value}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: C.sub }}>{c.label}</p>
              </div>
            ))}
          </div>

          {/* ── Muscle Group Pills (inside card) ─────────────────────── */}
          <div style={{
            background: C.card, borderRadius: 18,
            padding: "14px 16px", marginBottom: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Muscles Worked</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {workout.muscles.map(m => (
                <span key={m} style={{
                  padding: "5px 13px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                  background: `${muscleColor[m] || C.orange}18`,
                  color: muscleColor[m] || C.orange,
                  border: `1px solid ${muscleColor[m] || C.orange}30`,
                }}>{m}</span>
              ))}
            </div>
          </div>

          {/* ── Exercises (expandable cards) ──────────────────────────── */}
          <p style={{ margin: "0 2px 10px", fontSize: 11, color: C.sub, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Exercises</p>

          {workout.exercises.map(ex => (
            <div key={ex.id} style={{ marginBottom: 10 }}>
              {/* Exercise card header */}
              <div
                onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                style={{
                  background: C.card,
                  borderRadius: expanded === ex.id ? "18px 18px 0 0" : 18,
                  padding: "14px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                  borderBottom: expanded === ex.id ? `1px solid ${C.border}` : "none",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Icon bubble */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: C.orangeSoft,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                  }}>{exIcons[ex.name] || "\u{1F4AA}"}</div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{ex.name}</p>
                      {ex.pr && <span style={{ fontSize: 14 }}>{"\u2B50"}</span>}
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: C.sub }}>
                      {ex.sets} sets {"\u00B7"} top: <span style={{ color: C.text, fontWeight: 600 }}>{ex.topSet}</span>
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {ex.pr && (
                    <span style={{
                      padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 800,
                      background: C.goldSoft, color: C.gold,
                      border: `1px solid #FCE9A0`,
                    }}>PR</span>
                  )}
                  <span style={{
                    fontSize: 16, color: C.faint,
                    transform: expanded === ex.id ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s", display: "inline-block",
                  }}>{"\u25BE"}</span>
                </div>
              </div>

              {/* Expanded set rows */}
              {expanded === ex.id && (
                <div style={{
                  background: C.card,
                  borderRadius: "0 0 18px 18px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                }}>
                  {/* Column headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "32px 90px 1fr 1fr", padding: "8px 16px 6px", background: C.cardSoft }}>
                    {["#", "Type", "Weight", "Reps"].map(h => (
                      <p key={h} style={{ margin: 0, fontSize: 10, color: C.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7 }}>{h}</p>
                    ))}
                  </div>

                  {ex.completedSets.map((s, idx) => {
                    const ts = typeStyle[s.type];
                    return (
                      <div key={idx} style={{
                        display: "grid", gridTemplateColumns: "32px 90px 1fr 1fr",
                        padding: "10px 16px", alignItems: "center",
                        borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                        background: idx % 2 === 0 ? C.card : C.cardSoft,
                      }}>
                        <p style={{ margin: 0, fontSize: 13, color: C.sub, fontWeight: 700 }}>{s.num}</p>

                        {ts ? (
                          <span style={{
                            display: "inline-block", padding: "3px 9px", borderRadius: 99,
                            fontSize: 11, fontWeight: 700, background: ts.bg, color: ts.color,
                            width: "fit-content",
                          }}>{ts.label}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: C.faint }}>{"\u2014"}</span>
                        )}

                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>
                          {s.weight} <span style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>kg</span>
                        </p>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}>{s.reps}</p>
                          {s.pr && (
                            <span style={{
                              padding: "2px 7px", borderRadius: 99, fontSize: 9, fontWeight: 800,
                              background: C.goldSoft, color: C.gold,
                              border: `1px solid #FCE9A0`,
                            }}>PR</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <RestDay isToday={isToday} />
      )}

      {/* Modal */}
      {modal && <SummaryModal session={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
