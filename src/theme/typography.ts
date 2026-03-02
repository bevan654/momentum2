/**
 * Centralized typography system using Inter font family.
 *
 * Usage in components:
 *   import { Fonts } from '../../theme/typography';
 *
 *   const createStyles = (colors: ThemeColors) => StyleSheet.create({
 *     title: {
 *       fontFamily: Fonts.bold,
 *       fontSize: ms(18),
 *       lineHeight: ms(24),
 *       letterSpacing: -0.2,
 *     },
 *   });
 */

/** Font family constants — use instead of fontWeight */
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

/**
 * Weight → fontFamily mapping guide:
 *
 *   fontWeight '400' → Fonts.regular
 *   fontWeight '500' → Fonts.medium
 *   fontWeight '600' → Fonts.semiBold
 *   fontWeight '700' → Fonts.bold
 *   fontWeight '800' → Fonts.extraBold
 *
 * Line-height guide (by fontSize):
 *
 *   ms(32) → ms(38)     ms(16) → ms(22)
 *   ms(28) → ms(33)     ms(15) → ms(21)
 *   ms(22) → ms(27)     ms(14) → ms(20)
 *   ms(20) → ms(25)     ms(13) → ms(18)
 *   ms(18) → ms(24)     ms(12) → ms(16)
 *                        ms(11) → ms(15)
 *   Letter-spacing:      ms(10) → ms(14)
 *   ≥ ms(22): -0.3      ms(9)  → ms(12)
 *   ms(14–18): 0        ms(8)  → ms(11)
 *   ≤ ms(12) uppercase: 0.8
 */
