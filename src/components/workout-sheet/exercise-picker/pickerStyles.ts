import { StyleSheet, Dimensions } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

export const SCREEN_H = Dimensions.get('window').height;
export const SHEET_H = Math.round(SCREEN_H * 0.88);
const RADIUS = sw(20);

export const createPickerStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_H,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      overflow: 'hidden',
    },
    sheetInner: {
      flex: 1,
      paddingBottom: sw(30),
    },
    handleZone: {
      alignItems: 'center',
      paddingTop: sw(12),
      paddingBottom: sw(4),
    },
    handle: {
      width: sw(40),
      height: sw(4),
      borderRadius: sw(2),
      backgroundColor: colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      paddingTop: sw(8),
      paddingBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      fontFamily: Fonts.bold,
      lineHeight: ms(25),
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: sw(16),
      borderRadius: 0,
      paddingHorizontal: sw(12),
      gap: sw(8),
      marginBottom: sw(8),
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
      paddingVertical: sw(10),
    },
    reloadBtn: {
      padding: sw(4),
    },
    subHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      marginBottom: sw(6),
      marginTop: sw(6),
    },
    resultCount: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(16),
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    createBtnText: {
      color: colors.accent,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(18),
    },
    list: {
      flex: 1,
    },
    // On the content, not the list: FlashList sizes rows from its content width
    listContent: {
      paddingHorizontal: sw(16),
    },
    emptySearch: {
      alignItems: 'center',
      paddingTop: sw(24),
      gap: sw(4),
    },
    emptySearchText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    deferredPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchOnlineFloating: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      marginHorizontal: sw(16),
      marginBottom: sw(4),
      paddingVertical: sw(10),
      backgroundColor: colors.accent,
      borderRadius: sw(10),
    },
    searchOnlineFloatingText: {
      color: colors.textOnAccent,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
    },
  });
