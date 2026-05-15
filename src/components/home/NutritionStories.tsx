import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useAuthStore } from '../../stores/useAuthStore';

/* ─── Sizing ─────────────────────────────────────────── */

const RING_SIZE = sw(62);
const ITEM_WIDTH = sw(68);

/* ─── Helpers ────────────────────────────────────────── */

const AVATAR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA',
  '#60A5FA', '#F59E0B', '#EC4899', '#10B981',
  '#8B5CF6', '#06B6D4',
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function displayNameFor(username: string | null, email: string): string {
  return username || (email ? email.split('@')[0] : 'friend');
}

function initialFor(username: string | null, email: string): string {
  return (username || email || '?').charAt(0).toUpperCase();
}

/* ─── Add-friend Story ───────────────────────────────── */

const AddFriendStory = React.memo(function AddFriendStory({
  onPress,
}: { onPress: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.ringWrap}>
        <View style={[styles.addFriendCircle, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
          <Ionicons name="person-add-outline" size={ms(20)} color={colors.textSecondary} />
        </View>
        <View style={[styles.addFriendBadge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
          <Ionicons name="add" size={ms(10)} color={colors.textOnAccent} />
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>Add Friend</Text>
    </TouchableOpacity>
  );
});

/* ─── Friend Story ───────────────────────────────────── */

interface FriendStoryProps {
  name: string;
  initial: string;
  avatarColor: string;
  unviewed: boolean;
}

const FriendStory = React.memo(function FriendStory({
  name, initial, avatarColor, unviewed,
}: FriendStoryProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.7}>
      <View style={styles.ringWrap}>
        <View
          style={[
            styles.friendRing,
            { borderColor: unviewed ? colors.accent : colors.cardBorder },
          ]}
        >
          <View style={[styles.friendAvatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.friendInitial}>{initial}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>{name}</Text>
    </TouchableOpacity>
  );
});


/* ─── Stories row ────────────────────────────────────── */

interface NutritionStoriesProps {
  onAddFriend: () => void;
}

export default function NutritionStories({ onAddFriend }: NutritionStoriesProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const friends = useFriendsStore((s) => s.friends);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);

  useEffect(() => {
    if (userId) fetchFriends(userId);
  }, [userId, fetchFriends]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <AddFriendStory onPress={onAddFriend} />
        {friends.map((f) => (
          <FriendStory
            key={f.id}
            name={displayNameFor(f.username, f.email)}
            initial={initialFor(f.username, f.email)}
            avatarColor={colorForId(f.id)}
            unviewed
          />
        ))}
      </ScrollView>

      <View style={styles.divider} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginHorizontal: -sw(16), // bleed through HomeScreen's horizontal padding
    },
    scrollContent: {
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      gap: sw(2),
    },
    item: {
      width: ITEM_WIDTH,
      alignItems: 'center',
      gap: sw(6),
    },
    ringWrap: {
      width: RING_SIZE,
      height: RING_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendRing: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addFriendCircle: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addFriendBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: sw(18),
      height: sw(18),
      borderRadius: sw(9),
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendAvatar: {
      width: RING_SIZE - sw(8),
      height: RING_SIZE - sw(8),
      borderRadius: (RING_SIZE - sw(8)) / 2,
      justifyContent: 'center',
      alignItems: 'center',
    },
    friendInitial: {
      color: '#FFFFFF',
      fontSize: ms(18),
      fontFamily: Fonts.bold,
    },
    label: {
      color: colors.textSecondary,
      fontSize: ms(10),
      lineHeight: ms(12),
      fontFamily: Fonts.semiBold,
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginHorizontal: sw(0),
    },
  });
