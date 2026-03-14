import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sw, ms } from '../../theme/responsive';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore, type ThemeMode } from '../../stores/useThemeStore';
import AvatarCircle from '../friends/AvatarCircle';
import { BUILD_VERSION } from '../../constants/buildInfo';

interface Props {
  onOpenSettings: () => void;
  onOpenPatchNotes: () => void;
  onClose?: () => void;
}

export default function ProfileMainView({ onOpenSettings, onOpenPatchNotes, onClose }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const colors = useColors();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const username = profile?.username || null;
  const email = profile?.email || '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Close button */}
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={ms(22)} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <AvatarCircle username={username} email={email} size={sw(80)} bgColor={colors.accent} />
        <Text style={styles.username}>@{username || 'user'}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      {/* Navigation rows */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={onOpenSettings} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={ms(20)} color={colors.textPrimary} />
          <Text style={styles.rowText}>Settings</Text>
          <Ionicons name="chevron-forward" size={ms(18)} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={signOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={ms(20)} color={colors.accentRed} />
          <Text style={[styles.rowText, { color: colors.accentRed }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={ms(18)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Patch Notes + Support rows */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={onOpenPatchNotes} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={ms(20)} color={colors.textPrimary} />
          <Text style={styles.rowText}>Patch Notes</Text>
          <Ionicons name="chevron-forward" size={ms(18)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Support */}
      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.supportCard}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('https://momentum.app/privacy')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={ms(16)} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.linkRowBorder} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('https://momentum.app/terms')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={ms(16)} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.linkRowBorder} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('mailto:support@momentum.app')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>Contact Us</Text>
          <Ionicons name="open-outline" size={ms(16)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>{BUILD_VERSION}</Text>
    </ScrollView>
  );
}

function ModeChip({
  label,
  value,
  current,
  onPress,
  colors,
}: {
  label: string;
  value: ThemeMode;
  current: ThemeMode;
  onPress: (mode: ThemeMode) => void;
  colors: ThemeColors;
}) {
  const active = value === current;
  return (
    <TouchableOpacity
      style={[
        chipStyles.chip,
        { backgroundColor: colors.surface },
        active && { backgroundColor: colors.accent },
      ]}
      onPress={() => onPress(value)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          chipStyles.chipText,
          { color: colors.textSecondary },
          active && { color: colors.textOnAccent },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(8),
    borderRadius: sw(8),
  },
  chipText: {
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: sw(20),
      paddingBottom: sw(40),
    },
    closeBtn: {
      alignSelf: 'flex-end',
      padding: sw(4),
      marginTop: sw(4),
    },
    avatarSection: {
      alignItems: 'center',
      paddingTop: sw(24),
      paddingBottom: sw(20),
    },
    username: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.bold,
      marginTop: sw(12),
    },
    email: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      marginTop: sw(4),
    },
    section: {
      marginTop: sw(20),
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: sw(20),
      marginBottom: sw(8),
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(14),
    },
    modeRow: {
      flexDirection: 'row',
      gap: sw(8),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(14),
      marginBottom: sw(8),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(12),
    },
    rowText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.medium,
    },
    supportCard: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: sw(12),
    },
    linkRowBorder: {
      height: 1,
      backgroundColor: colors.cardBorder,
    },
    linkText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
    version: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(24),
    },
  });
