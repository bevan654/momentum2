import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import changelog from '../../constants/changelog';
import { useChangelogStore } from '../../stores/useChangelogStore';

export default function ChangelogModal() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasUnseen = useChangelogStore((s) => s.hasUnseen);
  const dismiss = useChangelogStore((s) => s.dismiss);

  const entry = changelog[0];
  if (!entry) return null;

  return (
    <Modal visible={hasUnseen} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <View style={styles.centered}>
          <Pressable style={styles.modal}>
            {/* Version badge */}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>v{entry.version}</Text>
            </View>

            <Text style={styles.title}>{entry.title}</Text>
            <Text style={styles.date}>{entry.date}</Text>

            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {entry.items.map((item, i) => (
                <View key={i} style={styles.row}>
                  <View style={styles.bullet} />
                  <Text style={styles.item}>{item}</Text>
                </View>
              ))}

              {entry.notes && entry.notes.length > 0 && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesHeader}>Good to Know</Text>
                  {entry.notes.map((note, i) => (
                    <Text key={i} style={styles.noteText}>{note}</Text>
                  ))}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.8}
              onPress={dismiss}
            >
              <Text style={styles.buttonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: sw(20),
      padding: sw(24),
      width: '90%',
      maxWidth: sw(400),
      alignItems: 'center',
    },
    badge: {
      backgroundColor: colors.accentMuted,
      borderRadius: sw(20),
      paddingHorizontal: sw(12),
      paddingVertical: sw(4),
      marginBottom: sw(12),
    },
    badgeText: {
      color: colors.accent,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(27),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      marginBottom: sw(4),
      textAlign: 'center',
    },
    date: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      marginBottom: sw(20),
    },
    list: {
      width: '100%',
      maxHeight: sw(380),
      marginBottom: sw(24),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: sw(12),
    },
    bullet: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
      backgroundColor: colors.accent,
      marginTop: ms(7),
      marginRight: sw(10),
    },
    item: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.regular,
    },
    notesSection: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      padding: sw(14),
      marginTop: sw(4),
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
      marginBottom: sw(6),
    },
    button: {
      width: '100%',
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingVertical: sw(14),
      alignItems: 'center',
    },
    buttonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.semiBold,
    },
  });
