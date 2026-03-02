# Nutrition Section — Design Audit

## Current Layout (HomeScreen.tsx)

The home screen renders nutrition components in this order:

```
ScrollView
  ├── actionRow      → [Log Workout] [Log Food]   (two equal-width cards)
  ├── supplementRow  → [NutritionCard] [WaterCard] (50/50 split)
  └── supplementRow  → [CreatineCard] [spacer]     (50% width + empty)
```

NutritionCard is crammed into a half-width slot alongside WaterCard. This is the biggest structural limitation — the calorie ring and macro bars are squeezed into ~180px on most phones.

---

## 1. Data Points — Displayed vs Hidden

### Currently displayed (NutritionCard on HomeScreen):
- **Calories eaten** (number inside ring)
- **Calorie goal** ("of 2000" below ring)
- **Calorie progress** (Skia arc fill, 0–100%)
- **Protein** — bar + gram value
- **Carbs** — bar + gram value
- **Fat** — bar + gram value

### Available but unused on HomeScreen:
- **Remaining calories** (goal − eaten) — computed in MacroSummaryCard/NutritionHero but not in NutritionCard
- **Per-macro progress %** — computed internally but only shown as bar fill, never as a number
- **Per-macro goal values** — used to calculate bars but not displayed as text
- **steps** — field exists in useNutritionStore, always 0 (never fetched)
- **caloriesBurned** — field exists in useNutritionStore, always 0 (never fetched)
- **loading** — flag exists, never used in any UI
- **is_planned entries** — NutritionHero and MacroSummaryCard distinguish planned vs eaten; HomeScreen's useNutritionStore does not

---

## 2. NutritionHero.tsx — Current State

**Location:** `src/components/food/NutritionHero.tsx`
**Status:** Functionally complete, NOT wired up on HomeScreen

### What it does:
- Full-width semicircular segmented gauge (40 dash segments)
- Accent-colored sweep gradient on progress arc + blur glow
- Three mini macro arcs nested inside the gauge (protein, carbs, fat)
- Center content: calorie number, "of X Kcal", then P/C/F columns with eaten + goal text

### Blockers for HomeScreen integration:
1. **Props mismatch** — Takes `entries: FoodEntry[]` and `goals: NutritionGoals` from `useFoodLogStore`. HomeScreen currently uses `useNutritionStore` which exposes flat scalar values (calories, protein, etc.), not raw entry arrays.
2. **Sizing** — Designed to span full card width (`SCREEN_WIDTH - margins`). Currently NutritionCard sits in a 50% width slot. NutritionHero would need a full-width slot.
3. **No Reanimated animation** — Arc fills are computed via `useMemo` only (static). No animated mount or value-change transitions.

### What works well:
- Skia-only (no SVG)
- Uses `useColors()` throughout
- Responsive sizing with `sw()`/`ms()`
- `React.memo` wrapped
- Segmented gauge design is visually distinctive

---

## 3. NutritionCard.tsx — Skia Migration Status

**Fully migrated to Skia.** Zero react-native-svg imports.

Skia elements used:
- `Canvas` for the drawing surface
- `SkiaCircle` for the track ring
- `SkiaPath` with `addArc` for the progress arc
- `SweepGradient` for orange gradient on the arc
- `BlurMask` for the glow effect behind the arc

The only SVG-based nutrition component remaining is **WaveCircle.tsx** (used by MacroSummaryCard in the food logger, not on HomeScreen).

---

## 4. Macro Breakdown — Current Presentation

NutritionCard uses horizontal bar layout:

```
[●] P  [████░░░░░░]  127g
[●] F  [██░░░░░░░░]   45g
[●] C  [██████░░░░]  198g
```

- Colored dot + single letter label
- Thin horizontal progress bar (3.5px height)
- Gram value right-aligned (no goal shown, no percentage)
- Gap between rows: 5px — very compact

In MacroSummaryCard (food logger only): three WaveCircle components showing current/goal with animated SVG fill.

In NutritionHero (food/, unwired): mini semicircular arcs + P/C/F columns with eaten and "of Xg" goal text.

---

## 5. Visual Hierarchy — What's Prominent vs Buried

### Prominent:
- **Calorie ring** — center of NutritionCard with orange sweep gradient + glow. This is the clear focal point.

### Diminished/buried:
- **Macro bars** — tiny (3.5px height bars, ms(10) labels). Hard to read at a glance. No goal context.
- **Calorie goal text** — "of 2000" in ms(10) tertiary color below the ring. Easy to miss.
- **Remaining calories** — not shown at all on HomeScreen.

### Structural issues:
- NutritionCard shares row with WaterCard at 50/50. The ring is only sw(76) = ~76px. This makes the entire nutrition section feel small and subordinate to water tracking.
- No color-coded status (no amber for "getting close", no red for "over goal")
- All three macros look identical in weight — no emphasis on protein (which most lifters care about most)
- The card reads as a secondary widget rather than the primary daily status display

---

## Component Inventory

| Component | Location | Renderer | Used on HomeScreen | Notes |
|---|---|---|---|---|
| NutritionCard | home/ | Skia | Yes (50% width) | Calorie ring + macro bars |
| NutritionHero | food/ | Skia | No | Semicircular gauge, complete but unwired |
| MacroSummaryCard | food/ | SVG (WaveCircle) | No | Three wave circles for P/C/F |
| WaveCircle | food/ | SVG + Reanimated | No | Animated fill circle per macro |
| WaterCard | home/ | RN Views | Yes (50% width) | Water tracking with buttons |
| CreatineCard | home/ | RN Views | Yes (50% width) | Creatine tracking with buttons |

---

## Theme Tokens Available

From `useColors()`:
- `colors.accent` — user's chosen accent color (dynamic)
- `colors.accentMuted` — subtle accent-tinted background
- `colors.protein` — #34D399 (green)
- `colors.carbs` — #60A5FA (blue)
- `colors.fat` — dynamic (matches accent)
- `colors.accentOrange` — #F59E0B (warning)
- `colors.accentRed` — #EF4444 (over/danger)
- `colors.ring.track` — muted track color
- `colors.ring.progress` — #34D399
- `colors.card`, `colors.surface`, `colors.cardBorder`
- `colors.textPrimary/Secondary/Tertiary`
- `colors.cardShadow` — platform shadow config
