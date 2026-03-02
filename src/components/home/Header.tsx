import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useStreakStore } from '../../stores/useStreakStore';
import AvatarCircle from '../friends/AvatarCircle';
import { openProfileSheet } from '../../navigation/TabNavigator';
import { BUILD_VERSION } from '../../constants/buildInfo';

export default function Header() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const email = useAuthStore((s) => s.profile?.email ?? '');
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />

        <View>
          <Text style={styles.greeting}>{greeting}, {username || 'there'}</Text>
          <Text style={styles.version}>{BUILD_VERSION}</Text>
        </View>

        <View style={styles.spacer} />

        {/* Streak */}
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={ms(13)} color={colors.streak} />
          <Text style={styles.streakText}>{currentStreak}</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.7}>
          <View style={styles.avatarRing}>
            <AvatarCircle
              username={username}
              email={email}
              size={sw(34)}
              bgColor={colors.accent}
            />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
    paddingHorizontal: sw(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: sw(10),
    paddingBottom: sw(10),
    gap: sw(12),
  },
  logo: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(8),
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  version: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  spacer: {
    flex: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.streak + '15',
    borderWidth: 1,
    borderColor: colors.streak + '30',
    paddingHorizontal: sw(8),
    paddingVertical: sw(4),
    borderRadius: sw(10),
    gap: sw(3),
  },
  streakText: {
    color: colors.streak,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: colors.accent + '50',
    borderRadius: sw(20),
    padding: sw(2),
  },
});
