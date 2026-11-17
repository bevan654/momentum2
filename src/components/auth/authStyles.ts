import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

/** Styles shared by the Login, Sign Up and Forgot Password screens. */
const createAuthStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* ─── Layout ───────────────────────────────────────────── */
    topSpacer: {
      flex: 1,
    },

    /* ─── Form ─────────────────────────────────────────────── */
    form: {
      gap: sw(14),
    },
    button: {
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      padding: sw(16),
      alignItems: 'center',
      marginTop: sw(8),
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
    },

    /* ─── Footer ───────────────────────────────────────────── */
    footer: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: sw(16),
    },
    switchAuth: {
      alignItems: 'center',
      paddingVertical: sw(12),
    },
    switchText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
    switchLink: {
      color: colors.accent,
      fontFamily: Fonts.semiBold,
    },
  });

export function useAuthStyles() {
  const colors = useColors();
  return useMemo(() => createAuthStyles(colors), [colors]);
}
