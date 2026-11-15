import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';

/** Styles shared by the Lab trend cards, their chart and their sheets. */
export const createTrendStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: sw(16),
      ...colors.cardShadow,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: sw(10) },
    header: { flexDirection: 'row', alignItems: 'center', gap: sw(8), flex: 1 },
    accentDot: { width: sw(4), height: sw(16), borderRadius: sw(2), backgroundColor: colors.accent },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: sw(8) },
    title: { color: colors.textPrimary, fontSize: ms(15), lineHeight: ms(21), fontFamily: Fonts.bold },
    currentVal: { color: colors.textSecondary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.semiBold },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: sw(6), marginTop: sw(1) },
    dateRange: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium },
    deltaBadge: { paddingHorizontal: sw(6), paddingVertical: sw(2), borderRadius: sw(6) },
    deltaText: { fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.bold },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: sw(6) },
    logBtn: { width: sw(28), height: sw(28), borderRadius: sw(8), backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    periodSelector: { flexDirection: 'row', alignItems: 'center', gap: sw(4), backgroundColor: colors.surface, borderRadius: sw(8), paddingVertical: sw(4), paddingHorizontal: sw(6) },
    arrowBtn: { padding: sw(2) },
    arrowDisabled: { opacity: 0.3 },
    periodLabel: { color: colors.textPrimary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.bold, minWidth: sw(24), textAlign: 'center' },

    /* Chart */
    yLabel: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.medium, textAlign: 'right' },
    xAxisRow: { flexDirection: 'row', marginTop: sw(6) },
    xLabel: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.medium, textAlign: 'center' },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: sw(16), marginTop: sw(10) },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: sw(5) },
    legendLine: { width: sw(12), height: sw(1.5), borderRadius: sw(1) },
    legendDash: { width: sw(12), height: 0, borderTopWidth: sw(1.5), borderStyle: 'dashed' },
    legendText: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium },
    emptyState: { backgroundColor: colors.surface, borderRadius: sw(10), paddingVertical: sw(32), alignItems: 'center' },
    emptyText: { color: colors.textTertiary, fontSize: ms(13), lineHeight: ms(18), fontFamily: Fonts.medium },

    /* Sheets (pickers, history) */
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sw(20), paddingBottom: sw(12), borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    sheetTitle: { color: colors.textPrimary, fontSize: ms(20), lineHeight: ms(25), fontFamily: Fonts.bold },
    sheetDone: { color: colors.accent, fontSize: ms(16), lineHeight: ms(22), fontFamily: Fonts.semiBold },
  });
