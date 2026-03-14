import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import changelog from '../../constants/changelog';

interface Props {
  onBack: () => void;
}

export default function PatchNotesView({ onBack }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={ms(22)} color={colors.textPrimary} />
          <Text style={styles.backText}>Patch Notes</Text>
        </TouchableOpacity>

        {changelog.map((entry, idx) => (
          <View key={entry.version} style={[styles.card, idx > 0 && styles.cardSpacing]}>
            {/* Version + date header */}
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>v{entry.version}</Text>
              </View>
              <Text style={styles.date}>{entry.date}</Text>
            </View>

            {/* Items */}
            {entry.items.map((item, i) => (
              <View key={i} style={styles.itemRow}>
                <View style={styles.bullet} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}

            {/* Notes */}
            {entry.notes && entry.notes.length > 0 && (
              <View style={styles.notesBox}>
                <Text style={styles.notesHeader}>Good to Know</Text>
                {entry.notes.map((note, i) => (
                  <Text key={i} style={styles.noteText}>{note}</Text>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={{ height: sw(40) }} />
      </ScrollView>
    </View>
  );
}

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
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(16),
    },
    backText: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.bold,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      padding: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cardSpacing: {
      marginTop: sw(12),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      marginBottom: sw(14),
    },
    badge: {
      backgroundColor: colors.accentMuted,
      borderRadius: sw(20),
      paddingHorizontal: sw(10),
      paddingVertical: sw(3),
    },
    badgeText: {
      color: colors.accent,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    date: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: sw(10),
    },
    bullet: {
      width: sw(5),
      height: sw(5),
      borderRadius: sw(2.5),
      backgroundColor: colors.accent,
      marginTop: ms(7),
      marginRight: sw(10),
    },
    itemText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.regular,
    },
    notesBox: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      padding: sw(14),
      marginTop: sw(8),
    },
    notesHeader: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: sw(8),
    },
    noteText: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.regular,
      marginBottom: sw(4),
    },
  });
