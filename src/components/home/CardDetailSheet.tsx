import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Overlay from '../ui/Overlay';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

/*
 * Shared chrome of the Home cards' detail popups (Nutrition, Water, Supplements):
 * centred sheet over a dimmed backdrop, hero row, section label, progress bar,
 * quick-add grid styles and the Undo / Done footer.
 */

/* ─── Styles (one sheet per palette) ──────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: sw(20),
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(20),
    gap: sw(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: '80%',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: sw(16),
  },
  heroNumber: {
    color: colors.textPrimary,
    fontSize: ms(42),
    lineHeight: ms(46),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1.5,
  },
  heroUnit: {
    fontSize: ms(18),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },
  heroLabel: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginTop: sw(-2),
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    marginBottom: sw(4),
  },
  statItem: {
    alignItems: 'flex-end',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  statDivider: {
    width: sw(1),
    height: sw(26),
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sw(8),
  },
  sectionLabelSpaced: {
    marginTop: sw(16),
  },
  barTrack: {
    height: sw(6),
    borderRadius: sw(3),
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: sw(3),
  },

  /* Quick add grid */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    justifyContent: 'center',
  },
  quickBtn: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  quickBtnIcon: {
    marginRight: sw(4),
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    gap: sw(8),
    marginTop: sw(4),
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    paddingHorizontal: sw(16),
  },
  undoBtnText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  closeBtn: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  closeBtnInRow: {
    flex: 1,
  },
  closeBtnAlone: {
    marginTop: sw(4),
  },
  closeBtnText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
});

type CardDetailStyles = ReturnType<typeof createStyles>;

const styleCache = new WeakMap<ThemeColors, CardDetailStyles>();

/** The popups' shared styles, built once per theme palette. */
export function useCardDetailStyles(): CardDetailStyles {
  const colors = useColors();
  let styles = styleCache.get(colors);
  if (!styles) {
    styles = createStyles(colors);
    styleCache.set(colors, styles);
  }
  return styles;
}

/* ─── Sheet ───────────────────────────────────────────── */

const stopPropagation = (e: { stopPropagation: () => void }) => e.stopPropagation();

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** After the exit animation, once the popup is gone. */
  onDismiss?: () => void;
  children: React.ReactNode;
}

/** Fading popup: tap outside or Android back closes it; content scrolls inside the sheet. */
export default function CardDetailSheet({ visible, onClose, onDismiss, children }: SheetProps) {
  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <SheetFrame onClose={onClose}>{children}</SheetFrame>
    </Overlay>
  );
}

/** Rendered only while the Overlay is mounted, so a closed popup builds nothing. */
function SheetFrame({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const styles = useCardDetailStyles();
  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={stopPropagation}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

/* ─── Hero row ────────────────────────────────────────── */

interface HeroStat {
  value: string | number;
  label: string;
  /** Colours both the value and the label (e.g. red when over). */
  color?: string;
}

interface HeroProps {
  value: string | number;
  /** Colour of the big number; default text colour when omitted. */
  valueColor?: string;
  /** Small unit after the number (rendered as " {unit}"). */
  unit?: string;
  label: string;
  stats: [HeroStat, HeroStat];
  dividerColor: string;
}

/** Big number + unit + label on the left, two stats split by a divider on the right. */
export function CardDetailHero({ value, valueColor, unit, label, stats, dividerColor }: HeroProps) {
  const styles = useCardDetailStyles();
  const [a, b] = stats;
  return (
    <View style={styles.heroRow}>
      <View>
        <Text style={[styles.heroNumber, valueColor != null && { color: valueColor }]}>
          {value}
          {unit != null && <Text style={styles.heroUnit}> {unit}</Text>}
        </Text>
        <Text style={styles.heroLabel}>{label}</Text>
      </View>
      <View style={styles.heroRight}>
        <StatItem stat={a} />
        <View style={[styles.statDivider, { backgroundColor: dividerColor }]} />
        <StatItem stat={b} />
      </View>
    </View>
  );
}

function StatItem({ stat }: { stat: HeroStat }) {
  const styles = useCardDetailStyles();
  const tint = stat.color != null && { color: stat.color };
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, tint]}>{stat.value}</Text>
      <Text style={[styles.statLabel, tint]}>{stat.label}</Text>
    </View>
  );
}

/* ─── Section label + progress bar ────────────────────── */

/** Uppercase section label; `spaced` adds the top gap used between sections. */
export function CardDetailSectionLabel({ children, spaced }: { children: React.ReactNode; spaced?: boolean }) {
  const styles = useCardDetailStyles();
  return <Text style={[styles.sectionLabel, spaced && styles.sectionLabelSpaced]}>{children}</Text>;
}

/** Thin bar; `pct` is 0..100+ (clamped to 100). */
export function CardDetailBar({ pct, color, trackColor }: { pct: number; color: string; trackColor: string }) {
  const styles = useCardDetailStyles();
  return (
    <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
      <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

/* ─── Quick add grid ──────────────────────────────────── */

/** Wrapping row of quick-add buttons (three per line). */
export function QuickAddGrid({ children }: { children: React.ReactNode }) {
  const styles = useCardDetailStyles();
  return <View style={styles.quickGrid}>{children}</View>;
}

interface QuickAddButtonProps {
  label: string;
  /** Text (and icon) colour. */
  color: string;
  onPress: () => void;
  /** Optional leading icon. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: StyleProp<ViewStyle>;
}

export function QuickAddButton({ label, color, onPress, icon, style }: QuickAddButtonProps) {
  const styles = useCardDetailStyles();
  return (
    <TouchableOpacity style={[styles.quickBtn, style]} onPress={onPress} activeOpacity={0.7}>
      {icon != null && <Ionicons name={icon} size={ms(13)} color={color} style={styles.quickBtnIcon} />}
      <Text style={[styles.quickBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ─── Footer ──────────────────────────────────────────── */

interface FooterProps {
  onClose: () => void;
  /** Gives the footer an Undo button next to Done (shown while `showUndo`). Omit for a Done button alone. */
  onUndo?: () => void;
  showUndo?: boolean;
}

export function CardDetailFooter({ onClose, onUndo, showUndo }: FooterProps) {
  const styles = useCardDetailStyles();
  const colors = useColors();

  if (!onUndo) {
    return (
      <TouchableOpacity style={[styles.closeBtn, styles.closeBtnAlone]} onPress={onClose} activeOpacity={0.7}>
        <Text style={styles.closeBtnText}>Done</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.footer}>
      {showUndo && (
        <TouchableOpacity style={styles.undoBtn} onPress={onUndo} activeOpacity={0.7}>
          <Ionicons name="arrow-undo" size={ms(14)} color={colors.textSecondary} />
          <Text style={styles.undoBtnText}>Undo</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.closeBtn, styles.closeBtnInRow]} onPress={onClose} activeOpacity={0.7}>
        <Text style={styles.closeBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}
