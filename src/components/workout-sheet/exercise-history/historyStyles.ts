import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

export const CHART_H = sw(140);
export const Y_LABEL_W = sw(34);
export const GRID_STEPS = 4;

export type HistoryStyles = ReturnType<typeof createHistoryStyles>;

/** Styles for the exercise history page and its pieces (built once in ExerciseHistoryModal, passed down). */
export const createHistoryStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(12),
    paddingVertical: sw(12),
    gap: sw(4),
  },
  backBtn: {
    width: sw(32),
    height: sw(32),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(8),
    paddingHorizontal: sw(32),
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: ms(16),
    fontFamily: Fonts.semiBold,
  },
  emptySub: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  // FlashList content: the sections above the session list sit in the list header (16 apart, as they
  // were in the scroll view); each session card keeps the 8 gap of the HISTORY section above it.
  listContent: {
    paddingHorizontal: sw(16),
  },
  listHeader: {
    gap: sw(16),
  },
  historyItem: {
    paddingTop: sw(8),
  },

  /* Section */
  section: {
    gap: sw(8),
  },
  sectionLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    padding: sw(14),
    gap: sw(10),
  },

  /* Summary */
  summaryGrid: {
    flexDirection: 'row',
    gap: sw(8),
  },
  summaryCell: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: sw(12),
    paddingHorizontal: sw(10),
    alignItems: 'center',
    gap: sw(4),
  },
  summaryCellValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
  },
  summaryCellLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    letterSpacing: 0.3,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreen + '10',
    paddingVertical: sw(10),
    paddingHorizontal: sw(12),
    gap: sw(8),
  },
  suggestedLabel: {
    color: colors.accentGreen,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
  },
  suggestedValue: {
    color: colors.accentGreen,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },

  /* PRs */
  prRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  prCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: sw(12),
    alignItems: 'center',
    gap: sw(4),
  },
  prValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
  },
  prSub: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  prLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },

  /* Chart */
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartToggle: {
    flexDirection: 'row',
    gap: sw(4),
  },
  chartChip: {
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    backgroundColor: colors.surface,
  },
  chartChipActive: {
    backgroundColor: colors.accent,
  },
  chartChipText: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
  },
  chartChipTextActive: {
    color: colors.textOnAccent,
  },
  yLabels: {
    position: 'absolute',
    top: sw(14),
    left: sw(14),
    height: CHART_H,
    width: Y_LABEL_W,
    justifyContent: 'space-between',
  },
  yLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    textAlign: 'right',
  },

  /* History table */
  historyCard: {
    backgroundColor: colors.surface,
    padding: sw(12),
    gap: sw(0),
    overflow: 'hidden',
  },
  historyDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(8),
  },
  historyDate: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  historyAgo: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  tableHeaderCell: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  tableColSet: {
    width: sw(32),
    textAlign: 'center',
  },
  tableColKg: {
    flex: 1,
    textAlign: 'center',
  },
  tableColReps: {
    flex: 1,
    textAlign: 'center',
  },
  tableColType: {
    width: sw(30),
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(7),
  },
  tableRowAlt: {
    backgroundColor: colors.cardBorder + '20',
  },
  tableRowSkipped: {
    opacity: 0.5,
  },
  tableCell: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  tableCellSet: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
  },
  tableCellDim: {
    color: colors.textTertiary,
  },
  tableSkipLabel: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  setTypeBadge: {
    paddingHorizontal: sw(5),
    paddingVertical: sw(1),
    backgroundColor: colors.cardBorder,
    borderRadius: sw(3),
  },
  setTypeBadgeText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
  },
  tableFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: sw(8),
    marginTop: sw(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  tableFooterText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  tableFooterDot: {
    color: colors.textTertiary + '60',
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
});
