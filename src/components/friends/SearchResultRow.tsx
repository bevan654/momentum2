import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { SearchResult } from '../../lib/friendsDatabase';
import AvatarCircle from './AvatarCircle';

interface Props {
  result: SearchResult;
  onAdd: () => void;
}

function SearchResultRow({ result, onAdd }: Props) {
  const status = result.friendshipStatus;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <AvatarCircle
        username={result.username}
        email={result.email}
        size={sw(40)}
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {result.username || result.email}
        </Text>
        {result.username && (
          <Text style={styles.email} numberOfLines={1}>
            {result.email}
          </Text>
        )}
      </View>

      {status === 'accepted' && (
        <View style={[styles.statusPill, { backgroundColor: colors.accentGreen + '20' }]}>
          <Text style={[styles.statusText, { color: colors.accentGreen }]}>Friends</Text>
        </View>
      )}

      {status === 'pending' && (
        <View style={[styles.statusPill, { backgroundColor: colors.accentOrange + '20' }]}>
          <Text style={[styles.statusText, { color: colors.accentOrange }]}>Pending</Text>
        </View>
      )}

      {!status && (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.7}>
          <Ionicons name="person-add-outline" size={ms(14)} color={colors.textOnAccent} />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(SearchResultRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
    gap: sw(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  info: {
    flex: 1,
    gap: sw(2),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(21),
  },
  email: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
  },
  statusPill: {
    borderRadius: sw(12),
    paddingHorizontal: sw(12),
    paddingVertical: sw(5),
  },
  statusText: {
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(7),
    minWidth: sw(64),
    justifyContent: 'center',
  },
  addText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
  },
});
