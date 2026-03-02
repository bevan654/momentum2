import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { CommentItem } from '../../lib/friendsDatabase';

interface Props {
  comments: CommentItem[];
  totalCount: number;
  onViewAll: () => void;
}

function CommentPreview({ comments, totalCount, onViewAll }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (totalCount === 0 && comments.length === 0) return null;

  const preview = comments.filter((c) => !c.parent_id).slice(0, 2);

  return (
    <View style={styles.container}>
      {totalCount > 2 && (
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.6}>
          <Text style={styles.viewAll}>
            View all {totalCount} comments
          </Text>
        </TouchableOpacity>
      )}

      {preview.map((c) => {
        const name = c.profile.username || c.profile.email;
        return (
          <Text key={c.id} style={styles.line} numberOfLines={2}>
            <Text style={styles.name}>{name} </Text>
            <Text style={styles.text}>{c.text}</Text>
          </Text>
        );
      })}
    </View>
  );
}

export default React.memo(CommentPreview);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: sw(6),
      gap: sw(3),
    },
    viewAll: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(17),
    },
    line: {
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
      color: colors.textPrimary,
    },
    name: {
      fontFamily: Fonts.bold,
    },
    text: {
      fontFamily: Fonts.medium,
    },
  });
