import { StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

export const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = sw(72);
export const ROW_HEIGHT = sw(42);

export type SetRowStyles = ReturnType<typeof createSetRowStyles>;

export const createSetRowStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      borderRadius: sw(10),
    },
    wrapperDrop: {
      marginLeft: sw(16),
    },
    dropLine: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: colors.accentBabyBlue + '30',
      borderRadius: 1,
    },

    /* ── Background actions ──────────────────────────── */
    actionsContainer: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: sw(10),
      overflow: 'hidden',
    },
    actionLeft: {
      width: ACTION_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionRight: {
      width: ACTION_WIDTH,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionIconCircle: {
      width: sw(30),
      height: sw(30),
      borderRadius: sw(15),
      justifyContent: 'center',
      alignItems: 'center',
    },

    /* ── Row ──────────────────────────────────────────── */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(5),
      paddingHorizontal: sw(6),
      gap: sw(6),
      borderRadius: sw(10),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '15',
    },

    /* ── Set number badge ────────────────────────────── */
    setNumBadge: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(8),
      justifyContent: 'center',
      alignItems: 'center',
    },
    setNumText: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      textAlign: 'center',
    },

    /* ── Previous ────────────────────────────────────── */
    prevContainer: {
      width: sw(46),
      alignItems: 'center',
    },
    prevText: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
      textAlign: 'center',
    },
    prevTextCompleted: {
      color: colors.textTertiary + '80',
    },

    /* ── Inputs ──────────────────────────────────────── */
    inputContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      borderWidth: 1,
      borderColor: colors.surface,
    },
    inputContainerCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '18',
    },
    input: {
      paddingVertical: sw(6),
      paddingHorizontal: sw(6),
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(15),
      textAlign: 'center',
    },
    inputTextCompleted: {
      color: colors.accentGreen,
    },
    inputContainerSuggested: {
      borderColor: colors.textTertiary + '55',
      borderStyle: 'dashed',
    },

    /* ── Reps row with steppers ────────────────────── */
    repsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      borderWidth: 1,
      borderColor: colors.surface,
      height: sw(32),
    },
    repsRowCompleted: {
      backgroundColor: colors.accentGreen + '08',
      borderColor: colors.accentGreen + '18',
    },
    repsRowSuggested: {
      borderColor: colors.textTertiary + '55',
      borderStyle: 'dashed',
    },
    repsInput: {
      flex: 1,
      paddingVertical: 0,
      paddingHorizontal: sw(2),
      color: colors.textPrimary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
    },
    repStepBtn: {
      paddingHorizontal: sw(5),
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeDisplay: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ── Check button ────────────────────────────────── */
    checkBtn: {
      padding: sw(1),
    },
  });
