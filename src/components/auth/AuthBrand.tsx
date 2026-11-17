import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

interface Props {
  title: string;
  /** Replaces the app logo (Sign Up's verification step shows a mail icon). */
  icon?: React.ReactNode;
  /** Smaller logo and bottom margin (Forgot Password). */
  compact?: boolean;
  /** Rendered under the title (subtitles; each screen styles its own). */
  children?: React.ReactNode;
}

/** Logo (or icon) + title block at the top of the auth screens. */
function AuthBrand({ title, icon, compact = false, children }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.brandSection, compact && styles.brandSectionCompact]}>
      {icon ?? (
        <Image
          source={require('../../../assets/logo.png')}
          style={[styles.logoIcon, compact && styles.logoIconCompact]}
        />
      )}
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    brandSection: {
      alignItems: 'center',
      marginBottom: sw(32),
    },
    brandSectionCompact: {
      marginBottom: sw(28),
    },
    logoIcon: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(20),
      marginBottom: sw(16),
    },
    logoIconCompact: {
      width: sw(64),
      height: sw(64),
      borderRadius: sw(18),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(27),
      fontFamily: Fonts.semiBold,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
  });

export default memo(AuthBrand);
