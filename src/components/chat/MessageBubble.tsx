import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { ChatMessage } from '../../lib/chatDatabase';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  showReadReceipt: boolean;
  isLastInGroup: boolean;
  showTimestamp: boolean;
}

function MessageBubble({ message, isOwn, showReadReceipt, isLastInGroup, showTimestamp }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const time = useMemo(() => {
    const d = new Date(message.created_at);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  }, [message.created_at]);

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isLastInGroup && isOwn && styles.tailOwn,
          isLastInGroup && !isOwn && styles.tailOther,
          message.pending && styles.pending,
        ]}
      >
        <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther]}>
          {message.text}
        </Text>
      </View>
      {showTimestamp && (
        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {time}
        </Text>
      )}
      {showReadReceipt && (
        <Text style={[styles.read, styles.timeOwn]}>Read</Text>
      )}
    </View>
  );
}

export default React.memo(MessageBubble);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      paddingHorizontal: sw(12),
      marginBottom: sw(2),
    },
    rowOwn: {
      alignItems: 'flex-end',
    },
    rowOther: {
      alignItems: 'flex-start',
    },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: sw(14),
      paddingVertical: sw(9),
      borderRadius: sw(18),
    },
    bubbleOwn: {
      backgroundColor: colors.accent,
      borderBottomRightRadius: sw(18),
    },
    bubbleOther: {
      backgroundColor: colors.card,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
      borderBottomLeftRadius: sw(18),
    },
    tailOwn: {
      borderBottomRightRadius: sw(4),
    },
    tailOther: {
      borderBottomLeftRadius: sw(4),
    },
    pending: {
      opacity: 0.6,
    },
    text: {
      fontSize: ms(15),
      fontFamily: Fonts.regular,
      lineHeight: ms(20),
    },
    textOwn: {
      color: colors.textOnAccent,
    },
    textOther: {
      color: colors.textPrimary,
    },
    time: {
      fontSize: ms(10),
      fontFamily: Fonts.regular,
      color: colors.textTertiary,
      marginTop: sw(2),
      marginBottom: sw(4),
    },
    timeOwn: {
      marginRight: sw(4),
    },
    timeOther: {
      marginLeft: sw(4),
    },
    read: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      color: colors.textTertiary,
      marginTop: sw(1),
      marginBottom: sw(4),
    },
  });
