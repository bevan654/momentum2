import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useAuthStore } from '../../stores/useAuthStore';

interface Props {
  onDismiss?: () => void;
}

export default function BetaWelcomeModal({ onDismiss }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setVisible(true);
  }, [userId]);

  const dismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!userId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <View style={styles.centered}>
          <Pressable style={styles.modal}>
            <View style={styles.iconWrap}>
              <Ionicons name="rocket-outline" size={ms(28)} color={colors.accent} />
            </View>

            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>BETA</Text>
            </View>

            <Text style={styles.title}>Welcome to Momentum</Text>
            <Text style={styles.subtitle}>
              Thanks for being one of the first lifters here.
            </Text>

            <View style={styles.bullets}>
              <Bullet
                colors={colors}
                styles={styles}
                icon="construct-outline"
                title="It's still early days"
                body="Momentum is in active beta. Things will move fast and you'll see new features land often."
              />
              <Bullet
                colors={colors}
                styles={styles}
                icon="bug-outline"
                title="Expect a few bugs"
                body="If something looks off or breaks, it probably is. Your patience while we polish is appreciated."
              />
              <Bullet
                colors={colors}
                styles={styles}
                icon="chatbubbles-outline"
                title="Tell us what you think"
                body="Feedback shapes what we build next — share anything that bugs you or that you'd love to see."
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              activeOpacity={0.85}
              onPress={dismiss}
            >
              <Text style={styles.buttonText}>Let's lift</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

interface BulletProps {
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

function Bullet({ colors, styles, icon, title, body }: BulletProps) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={ms(16)} color={colors.accent} />
      </View>
      <View style={styles.bulletText}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sw(20),
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: sw(22),
      paddingVertical: sw(24),
      paddingHorizontal: sw(22),
      width: '100%',
      maxWidth: sw(420),
      alignItems: 'center',
    },
    iconWrap: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(28),
      backgroundColor: colors.accent + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(10),
    },
    betaBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: sw(20),
      paddingHorizontal: sw(10),
      paddingVertical: sw(3),
      marginBottom: sw(10),
    },
    betaBadgeText: {
      color: colors.accent,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 1.2,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(27),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(4),
      marginBottom: sw(18),
    },
    bullets: {
      width: '100%',
      gap: sw(12),
      marginBottom: sw(20),
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: sw(10),
    },
    bulletIcon: {
      width: sw(30),
      height: sw(30),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: sw(2),
    },
    bulletText: {
      flex: 1,
    },
    bulletTitle: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
      marginBottom: sw(2),
    },
    bulletBody: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.regular,
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
      fontFamily: Fonts.bold,
    },
  });
