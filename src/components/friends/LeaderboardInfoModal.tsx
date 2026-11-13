import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Overlay from '../ui/Overlay';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, sh } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const InfoRow = React.memo(function InfoRow({
  icon,
  title,
  body,
  colors,
  styles,
}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={ms(17)} color={colors.accent} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{body}</Text>
      </View>
    </View>
  );
});

function LeaderboardInfoModal({ visible, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.centered}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.heroIcon}>
                <Ionicons name="trophy-outline" size={ms(23)} color={colors.accent} />
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
                accessibilityLabel="Close leaderboard information"
              >
                <Ionicons name="close" size={ms(20)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>How leaderboards work</Text>
            <Text style={styles.subtitle}>
              Compare strength fairly by bodyweight, or keep the longest active workout streak.
            </Text>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <InfoRow
                icon="calculator-outline"
                title="Total strength ratio"
                body="Bench, Back Squat, and Deadlift are divided by bodyweight, then averaged. A missing lift contributes zero."
                colors={colors}
                styles={styles}
              />
              <InfoRow
                icon="barbell-outline"
                title="Individual lifts"
                body="Your actual recorded weight from the stored best working set is divided by your latest bodyweight. Reps do not inflate the ratio."
                colors={colors}
                styles={styles}
              />
              <InfoRow
                icon="flame-outline"
                title="Workout streak"
                body="Current ranks active streaks and resets after three completed rest days. All-Time Best ranks each athlete's longest recorded streak."
                colors={colors}
                styles={styles}
              />
              <InfoRow
                icon="people-outline"
                title="Scope and updates"
                body="Friends shows you and accepted friends; Global shows opted-in users. Rankings stay cached until you pull down to refresh or restart the app."
                colors={colors}
                styles={styles}
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.doneText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Overlay>
  );
}

export default React.memo(LeaderboardInfoModal);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.background + 'D9',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sw(18),
  },
  modal: {
    width: '100%',
    maxHeight: sh(680),
    maxWidth: sw(420),
    padding: sw(20),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: sw(22),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIcon: {
    width: sw(42),
    height: sw(42),
    borderRadius: sw(13),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  closeBtn: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: {
    marginTop: sw(16),
    color: colors.textPrimary,
    fontSize: ms(21),
    lineHeight: ms(26),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: sw(5),
    marginBottom: sw(16),
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(19),
    fontFamily: Fonts.regular,
  },
  scroll: {
    flexGrow: 0,
  },
  infoRow: {
    flexDirection: 'row',
    gap: sw(11),
    paddingVertical: sw(11),
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  infoIcon: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  infoBody: {
    marginTop: sw(2),
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(17),
    fontFamily: Fonts.regular,
  },
  doneBtn: {
    marginTop: sw(14),
    paddingVertical: sw(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sw(12),
    backgroundColor: colors.accent,
  },
  doneText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    lineHeight: ms(19),
    fontFamily: Fonts.bold,
  },
});
