import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useFriendsStore } from '../../stores/useFriendsStore';

const MAX_ITEMS = 2;

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function FriendsActivityCard() {
  const feed = useFriendsStore((s) => s.feed);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const recentItems = useMemo(() => feed.slice(0, MAX_ITEMS), [feed]);

  if (recentItems.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Friends</Text>

      {recentItems.map((item, idx) => {
        const name = item.profile.username || item.profile.email.split('@')[0];
        const muscles = (item.exercise_details || [])
          .flatMap((e) => e.primary_muscles || [])
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 2)
          .map((m) => m.charAt(0).toUpperCase() + m.slice(1));

        return (
          <View key={item.id}>
            {idx > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(name[0] || '?').toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  <Text style={styles.time}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={styles.detail} numberOfLines={1}>
                  {formatDuration(item.duration)} · {item.total_exercises} exercises
                  {muscles.length > 0 ? ` · ${muscles.join(', ')}` : ''}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(6),
    ...colors.cardShadow,
  },
  title: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  avatar: {
    width: sw(24),
    height: sw(24),
    borderRadius: sw(12),
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  info: {
    flex: 1,
    gap: sw(2),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  time: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    marginLeft: sw(6),
  },
  detail: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
});
