/**
 * Anatomical SVG path data for front and back body views.
 * ViewBox: 0 0 140 300 — scaled to fit by the MuscleHeatmap component.
 *
 * Each panel maps to one of 11 muscle groups or 'inactive' (non-muscle tissue).
 * Front + back combined: ~72 panels.
 */

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export interface MusclePanel {
  id: string;
  path: string;
  group: MuscleGroup | 'inactive';
}

// ─── FRONT VIEW ────────────────────────────────────────────

export const FRONT_PANELS: MusclePanel[] = [
  // ── Inactive: head, neck, hands, feet ──
  {
    id: 'f_head',
    path: 'M70 4 C80 4 86 12 86 22 C86 32 80 38 70 38 C60 38 54 32 54 22 C54 12 60 4 70 4 Z',
    group: 'inactive',
  },
  {
    id: 'f_neck',
    path: 'M62 38 L78 38 L80 48 L60 48 Z',
    group: 'inactive',
  },
  {
    id: 'f_hand_l',
    path: 'M18 168 C16 172 14 178 16 182 C18 186 22 186 24 182 L30 168 Z',
    group: 'inactive',
  },
  {
    id: 'f_hand_r',
    path: 'M122 168 C124 172 126 178 124 182 C122 186 118 186 116 182 L110 168 Z',
    group: 'inactive',
  },
  {
    id: 'f_foot_l',
    path: 'M43 272 L55 272 L56 280 C56 284 52 286 46 286 C40 286 38 282 40 278 Z',
    group: 'inactive',
  },
  {
    id: 'f_foot_r',
    path: 'M85 272 L97 272 L100 278 C102 282 100 286 94 286 C88 286 84 284 84 280 Z',
    group: 'inactive',
  },

  // ── Shoulders (front deltoids) ──
  {
    id: 'f_delt_l',
    path: 'M48 48 C42 48 34 50 30 56 C28 60 28 66 30 70 L38 68 L48 60 Z',
    group: 'shoulders',
  },
  {
    id: 'f_delt_r',
    path: 'M92 48 C98 48 106 50 110 56 C112 60 112 66 110 70 L102 68 L92 60 Z',
    group: 'shoulders',
  },

  // ── Chest (pectorals — 4 panels) ──
  {
    id: 'f_pec_ul',
    path: 'M48 60 L70 58 L70 76 L46 76 C42 72 40 68 38 66 L48 60 Z',
    group: 'chest',
  },
  {
    id: 'f_pec_ur',
    path: 'M92 60 L70 58 L70 76 L94 76 C98 72 100 68 102 66 L92 60 Z',
    group: 'chest',
  },
  {
    id: 'f_pec_ll',
    path: 'M46 76 L70 76 L70 94 L48 92 C44 88 42 82 46 76 Z',
    group: 'chest',
  },
  {
    id: 'f_pec_lr',
    path: 'M94 76 L70 76 L70 94 L92 92 C96 88 98 82 94 76 Z',
    group: 'chest',
  },

  // ── Biceps ──
  {
    id: 'f_bicep_l',
    path: 'M30 70 C28 74 24 86 22 100 C21 110 22 118 24 120 L36 118 C38 110 38 96 38 68 L30 70 Z',
    group: 'biceps',
  },
  {
    id: 'f_bicep_r',
    path: 'M110 70 C112 74 116 86 118 100 C119 110 118 118 116 120 L104 118 C102 110 102 96 102 68 L110 70 Z',
    group: 'biceps',
  },

  // ── Forearms (4 panels) ──
  {
    id: 'f_forearm_inner_l',
    path: 'M24 120 L30 120 L28 146 L24 168 L20 168 C20 154 22 138 24 120 Z',
    group: 'forearms',
  },
  {
    id: 'f_forearm_outer_l',
    path: 'M30 120 L36 118 C36 130 34 146 32 168 L28 168 L28 146 L30 120 Z',
    group: 'forearms',
  },
  {
    id: 'f_forearm_inner_r',
    path: 'M116 120 L110 120 L112 146 L116 168 L120 168 C120 154 118 138 116 120 Z',
    group: 'forearms',
  },
  {
    id: 'f_forearm_outer_r',
    path: 'M110 120 L104 118 C104 130 106 146 108 168 L112 168 L112 146 L110 120 Z',
    group: 'forearms',
  },

  // ── Abs (6 panels) ──
  {
    id: 'f_abs_u_l',
    path: 'M48 94 L70 94 L70 112 L48 110 Z',
    group: 'abs',
  },
  {
    id: 'f_abs_u_r',
    path: 'M92 94 L70 94 L70 112 L92 110 Z',
    group: 'abs',
  },
  {
    id: 'f_abs_m_l',
    path: 'M48 110 L70 112 L70 132 L48 130 Z',
    group: 'abs',
  },
  {
    id: 'f_abs_m_r',
    path: 'M92 110 L70 112 L70 132 L92 130 Z',
    group: 'abs',
  },
  {
    id: 'f_abs_l_l',
    path: 'M48 130 L70 132 L70 152 L46 150 C44 146 46 138 48 130 Z',
    group: 'abs',
  },
  {
    id: 'f_abs_l_r',
    path: 'M92 130 L70 132 L70 152 L94 150 C96 146 94 138 92 130 Z',
    group: 'abs',
  },

  // ── Quads (6 panels) ──
  {
    id: 'f_quad_outer_l',
    path: 'M42 158 L52 156 L50 188 L42 188 C40 178 40 168 42 158 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_center_l',
    path: 'M52 156 L62 158 L60 188 L50 188 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_inner_l',
    path: 'M62 158 L70 174 L68 188 L60 188 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_outer_r',
    path: 'M98 158 L88 156 L90 188 L98 188 C100 178 100 168 98 158 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_center_r',
    path: 'M88 156 L78 158 L80 188 L90 188 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_inner_r',
    path: 'M78 158 L70 174 L72 188 L80 188 Z',
    group: 'quads',
  },
  // Quad lower panels
  {
    id: 'f_quad_low_l',
    path: 'M42 188 L68 188 L64 220 C58 222 50 222 44 220 Z',
    group: 'quads',
  },
  {
    id: 'f_quad_low_r',
    path: 'M98 188 L72 188 L76 220 C82 222 90 222 96 220 Z',
    group: 'quads',
  },

  // ── Calves (front — tibialis) ──
  {
    id: 'f_calf_l',
    path: 'M44 222 L56 222 L54 250 C54 260 52 268 50 272 L46 272 C44 268 43 258 43 248 Z',
    group: 'calves',
  },
  {
    id: 'f_calf_r',
    path: 'M96 222 L84 222 L86 250 C86 260 88 268 90 272 L94 272 C96 268 97 258 97 248 Z',
    group: 'calves',
  },

  // ── Hip/side connectors (inactive — fills gaps) ──
  {
    id: 'f_hip_l',
    path: 'M46 150 L48 130 C44 134 42 142 42 150 L42 158 L52 156 L46 150 Z',
    group: 'inactive',
  },
  {
    id: 'f_hip_r',
    path: 'M94 150 L92 130 C96 134 98 142 98 150 L98 158 L88 156 L94 150 Z',
    group: 'inactive',
  },
  {
    id: 'f_groin',
    path: 'M62 158 L70 152 L78 158 L70 174 Z',
    group: 'inactive',
  },
];

// ─── BACK VIEW ─────────────────────────────────────────────

export const BACK_PANELS: MusclePanel[] = [
  // ── Inactive: head, neck, hands, feet ──
  {
    id: 'b_head',
    path: 'M70 4 C80 4 86 12 86 22 C86 32 80 38 70 38 C60 38 54 32 54 22 C54 12 60 4 70 4 Z',
    group: 'inactive',
  },
  {
    id: 'b_neck',
    path: 'M62 38 L78 38 L80 48 L60 48 Z',
    group: 'inactive',
  },
  {
    id: 'b_hand_l',
    path: 'M18 168 C16 172 14 178 16 182 C18 186 22 186 24 182 L30 168 Z',
    group: 'inactive',
  },
  {
    id: 'b_hand_r',
    path: 'M122 168 C124 172 126 178 124 182 C122 186 118 186 116 182 L110 168 Z',
    group: 'inactive',
  },
  {
    id: 'b_foot_l',
    path: 'M43 272 L55 272 L56 280 C56 284 52 286 46 286 C40 286 38 282 40 278 Z',
    group: 'inactive',
  },
  {
    id: 'b_foot_r',
    path: 'M85 272 L97 272 L100 278 C102 282 100 286 94 286 C88 286 84 284 84 280 Z',
    group: 'inactive',
  },

  // ── Shoulders (rear deltoids) ──
  {
    id: 'b_delt_l',
    path: 'M48 48 C42 48 34 50 30 56 C28 60 28 66 30 70 L38 68 L48 60 Z',
    group: 'shoulders',
  },
  {
    id: 'b_delt_r',
    path: 'M92 48 C98 48 106 50 110 56 C112 60 112 66 110 70 L102 68 L92 60 Z',
    group: 'shoulders',
  },

  // ── Back — traps (upper) ──
  {
    id: 'b_trap_l',
    path: 'M48 48 L60 48 L70 58 L70 72 L48 68 L48 60 Z',
    group: 'back',
  },
  {
    id: 'b_trap_r',
    path: 'M92 48 L80 48 L70 58 L70 72 L92 68 L92 60 Z',
    group: 'back',
  },

  // ── Back — lats (mid) ──
  {
    id: 'b_lat_l',
    path: 'M38 68 L48 68 L70 72 L70 108 L48 104 C42 96 38 84 38 68 Z',
    group: 'back',
  },
  {
    id: 'b_lat_r',
    path: 'M102 68 L92 68 L70 72 L70 108 L92 104 C98 96 102 84 102 68 Z',
    group: 'back',
  },

  // ── Back — lower back / erectors ──
  {
    id: 'b_lower_l',
    path: 'M48 104 L70 108 L70 148 L48 144 C46 130 46 116 48 104 Z',
    group: 'back',
  },
  {
    id: 'b_lower_r',
    path: 'M92 104 L70 108 L70 148 L92 144 C94 130 94 116 92 104 Z',
    group: 'back',
  },

  // ── Triceps ──
  {
    id: 'b_tricep_l',
    path: 'M30 70 C28 76 24 90 22 104 C21 114 22 118 24 120 L36 118 C38 108 38 92 38 68 L30 70 Z',
    group: 'triceps',
  },
  {
    id: 'b_tricep_r',
    path: 'M110 70 C112 76 116 90 118 104 C119 114 118 118 116 120 L104 118 C102 108 102 92 102 68 L110 70 Z',
    group: 'triceps',
  },

  // ── Forearms (back view) ──
  {
    id: 'b_forearm_l',
    path: 'M24 120 L36 118 C36 132 34 148 30 168 L20 168 C20 152 22 136 24 120 Z',
    group: 'forearms',
  },
  {
    id: 'b_forearm_r',
    path: 'M116 120 L104 118 C104 132 106 148 110 168 L120 168 C120 152 118 136 116 120 Z',
    group: 'forearms',
  },

  // ── Glutes ──
  {
    id: 'b_glute_l',
    path: 'M48 144 L70 148 L70 174 L60 174 C52 174 44 168 42 160 C42 154 44 148 48 144 Z',
    group: 'glutes',
  },
  {
    id: 'b_glute_r',
    path: 'M92 144 L70 148 L70 174 L80 174 C88 174 96 168 98 160 C98 154 96 148 92 144 Z',
    group: 'glutes',
  },

  // ── Hamstrings (4 panels — upper/lower per side) ──
  {
    id: 'b_ham_upper_l',
    path: 'M42 160 L60 174 L68 174 L66 200 L44 198 C40 188 40 176 42 160 Z',
    group: 'hamstrings',
  },
  {
    id: 'b_ham_upper_r',
    path: 'M98 160 L80 174 L72 174 L74 200 L96 198 C100 188 100 176 98 160 Z',
    group: 'hamstrings',
  },
  {
    id: 'b_ham_lower_l',
    path: 'M44 198 L66 200 L62 222 C56 224 50 224 44 222 Z',
    group: 'hamstrings',
  },
  {
    id: 'b_ham_lower_r',
    path: 'M96 198 L74 200 L78 222 C84 224 90 224 96 222 Z',
    group: 'hamstrings',
  },

  // ── Calves (back — gastrocnemius, 4 panels) ──
  {
    id: 'b_calf_outer_l',
    path: 'M44 222 L50 222 L48 248 C47 256 46 264 46 272 L43 272 C42 262 42 244 44 222 Z',
    group: 'calves',
  },
  {
    id: 'b_calf_inner_l',
    path: 'M50 222 L62 222 L58 248 C56 258 54 266 54 272 L46 272 L48 248 L50 222 Z',
    group: 'calves',
  },
  {
    id: 'b_calf_outer_r',
    path: 'M96 222 L90 222 L92 248 C93 256 94 264 94 272 L97 272 C98 262 98 244 96 222 Z',
    group: 'calves',
  },
  {
    id: 'b_calf_inner_r',
    path: 'M90 222 L78 222 L82 248 C84 258 86 266 86 272 L94 272 L92 248 L90 222 Z',
    group: 'calves',
  },
];

// ─── Mapping from app category → heatmap muscle groups ────

export const CATEGORY_TO_GROUPS: Record<string, MuscleGroup[]> = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders'],
  Arms: ['biceps', 'triceps', 'forearms'],
  Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  Core: ['abs'],
  Cardio: [],
  Custom: [],
};

// ─── Display names ─────────────────────────────────────────

export const GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

// ─── Heat gradient — 11 stops from dark navy → bright cyan ─

export const HEAT_COLORS = [
  '#1E2A38', // 0.0
  '#1E3245', // 0.1
  '#1E3B53', // 0.2
  '#1F4461', // 0.3
  '#214E70', // 0.4
  '#255A80', // 0.5
  '#2C6891', // 0.6
  '#3678A3', // 0.7
  '#458CB7', // 0.8
  '#5BA3CC', // 0.9
  '#88E3FA', // 1.0
];

export const INACTIVE_COLOR = '#141D28';
export const HIGHLIGHT_STROKE = '#56D4F4';

export function getHeatColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  const index = Math.round(clamped * (HEAT_COLORS.length - 1));
  return HEAT_COLORS[index];
}
