import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <View
      style={[
        styles.row,
        isOwn ? styles.rowOwn : styles.rowOther,
        isLastInGroup && styles.rowGroupEnd,
      ]}
    >
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
      {(showTimestamp || showReadReceipt) && (
        <View style={[styles.meta, isOwn ? styles.metaOwn : styles.metaOther]}>
          {showTimestamp && (
            <Text style={styles.time}>{time}</Text>
          )}
          {showReadReceipt && (
            <View style={styles.readReceipt}>
              <Ionicons name="checkmark-done" size={ms(12)} color={colors.accent} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default React.memo(MessageBubble);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      paddingHorizontal: sw(14),
      marginBottom: sw(1.5),
    },
    rowOwn: {
      alignItems: 'flex-end',
    },
    rowOther: {
      alignItems: 'flex-start',
    },
    rowGroupEnd: {
      marginBottom: sw(8),
    },
    bubble: {
      maxWidth: '78%',
      paddingHorizontal: sw(14),
      paddingVertical: sw(8),
      borderRadius: sw(20),
    },
    bubbleOwn: {
      backgroundColor: colors.accent,
    },
    bubbleOther: {
      backgroundColor: colors.card,
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    tailOwn: {
      borderBottomRightRadius: sw(6),
    },
    tailOther: {
      borderBottomLeftRadius: sw(6),
    },
    pending: {
      opacity: 0.5,
    },
    text: {
      fontSize: ms(15),
      fontFamily: Fonts.regular,
      lineHeight: ms(21),
    },
    textOwn: {
      color: colors.textOnAccent,
    },
    textOther: {
      color: colors.textPrimary,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      marginTop: sw(3),
      marginBottom: sw(2),
    },
    metaOwn: {
      marginRight: sw(4),
    },
    metaOther: {
      marginLeft: sw(4),
    },
    time: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      color: colors.textTertiary,
    },
    readReceipt: {
      marginLeft: sw(1),
    },
  });
