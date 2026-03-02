import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, TextInput, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { SearchResult } from '../../lib/friendsDatabase';
import SearchResultRow from './SearchResultRow';

export default function FriendSearch() {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const searchResults = useFriendsStore((s) => s.searchResults);
  const searchLoading = useFriendsStore((s) => s.searchLoading);
  const searchUsers = useFriendsStore((s) => s.searchUsers);
  const clearSearch = useFriendsStore((s) => s.clearSearch);
  const sendFriendRequest = useFriendsStore((s) => s.sendFriendRequest);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 3) {
      clearSearch();
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (userId) searchUsers(query, userId);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, userId]);

  const handleAdd = useCallback(
    (friendId: string) => {
      if (userId) sendFriendRequest(userId, friendId);
    },
    [userId, sendFriendRequest],
  );

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <SearchResultRow result={item} onAdd={() => handleAdd(item.id)} />
    ),
    [handleAdd],
  );

  return (
    <View style={styles.container}>
      {/* Search input */}
      <View style={styles.inputWrap}>
        <Ionicons name="search-outline" size={ms(16)} color={colors.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      <View style={styles.results}>
        {searchLoading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        )}

        {!searchLoading && query.length >= 3 && searchResults.length === 0 && (
          <View style={styles.center}>
            <Ionicons name="person-outline" size={ms(32)} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )}

        {!searchLoading && query.length < 3 && (
          <View style={styles.center}>
            <Text style={styles.hintText}>Type at least 3 characters to search</Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <FlashList
            data={searchResults}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            estimatedItemSize={sw(60)}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(14),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: sw(16),
    paddingHorizontal: sw(14),
    gap: sw(10),
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.medium,
    lineHeight: ms(21),
    paddingVertical: sw(13),
  },
  results: {
    flex: 1,
    marginTop: sw(12),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(10),
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
  },
  hintText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
});
