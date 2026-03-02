import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

const EMOJIS = ['\u{2764}\u{FE0F}', '\u{1F525}', '\u{1F4AA}', '\u{1F44F}', '\u{1F92F}', '\u{1F389}'];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {EMOJIS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={styles.emojiBtn}
          onPress={() => {
            onSelect(emoji);
            onClose();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: sw(32),
    left: -sw(4),
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: sw(14),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(6),
    gap: sw(2),
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emojiBtn: {
    padding: sw(6),
    borderRadius: sw(8),
  },
  emoji: {
    fontSize: ms(22),
    fontFamily: Fonts.medium,
    lineHeight: ms(27),
    letterSpacing: -0.3,
  },
});
