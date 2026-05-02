import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';

const APP_STORE_ID = '6759032167';
const IOS_DEEP_LINK = `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`;
const ANDROID_DEEP_LINK = 'market://details?id=com.momentum.fitnessapp';

export default function ForceUpdateScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? IOS_DEEP_LINK : ANDROID_DEEP_LINK;
    Linking.openURL(url).catch(() => {
      // Fall back to web URL if the store app isn't available
      const webUrl =
        Platform.OS === 'ios'
          ? `https://apps.apple.com/app/id${APP_STORE_ID}`
          : 'https://play.google.com/store/apps/details?id=com.momentum.fitnessapp';
      Linking.openURL(webUrl).catch(() => {});
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="rocket" size={ms(36)} color={colors.accent} />
        </View>

        <Text style={styles.title}>Update required</Text>
        <Text style={styles.subtitle}>
          You're on an older version of Momentum. Update to the latest build to
          keep training without disruption.
        </Text>

        <View style={styles.bullets}>
          <Bullet
            colors={colors}
            styles={styles}
            icon="flash-outline"
            text="Critical fixes and improvements"
          />
          <Bullet
            colors={colors}
            styles={styles}
            icon="shield-checkmark-outline"
            text="Your saved data is preserved"
          />
        </View>

        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={handleUpdate}>
          <Text style={styles.buttonText}>
            {Platform.OS === 'ios' ? 'Update on App Store' : 'Update on Play Store'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface BulletProps {
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

function Bullet({ colors, styles, icon, text }: BulletProps) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={ms(16)} color={colors.accent} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sw(28),
    },
    content: {
      width: '100%',
      maxWidth: sw(420),
      alignItems: 'center',
    },
    iconWrap: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(36),
      backgroundColor: colors.accent + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(20),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(26),
      lineHeight: ms(32),
      fontFamily: Fonts.bold,
      letterSpacing: -0.4,
      textAlign: 'center',
      marginBottom: sw(8),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginBottom: sw(28),
    },
    bullets: {
      width: '100%',
      gap: sw(10),
      marginBottom: sw(32),
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingHorizontal: sw(14),
      paddingVertical: sw(10),
      borderRadius: sw(10),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    bulletText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
    button: {
      width: '100%',
      backgroundColor: colors.accent,
      borderRadius: sw(14),
      paddingVertical: sw(16),
      alignItems: 'center',
    },
    buttonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
    },
  });
