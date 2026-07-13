import React, { memo, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  getPendingWorkoutFinishFeedback,
  type PendingWorkoutFinishFeedback,
  submitWorkoutFinishFeedback,
  type WorkoutFinishFeedbackResponse,
} from '../../services/workoutFinishFeedback';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { ms, sw } from '../../theme/responsive';

interface Props {
  enabled: boolean;
}

function WorkoutFinishFeedbackPrompt({ enabled }: Props) {
  const userId = useAuthStore((state) => state.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pending, setPending] = useState<PendingWorkoutFinishFeedback | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    void getPendingWorkoutFinishFeedback(userId).then((pending) => {
      if (!active || !pending) return;
      // Let the main app finish its entrance before presenting a system alert.
      timer = setTimeout(() => {
        if (!active) return;
        setPending(pending);
      }, 1500);
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, userId]);

  const submit = (response: WorkoutFinishFeedbackResponse) => {
    if (!userId || !pending) return;
    const workoutId = pending.workoutId;
    setPending(null);
    void submitWorkoutFinishFeedback({ userId, workoutId, response });
  };

  return (
    <Modal
      visible={pending != null}
      transparent
      animationType="fade"
      onRequestClose={() => setPending(null)}
    >
      <Pressable style={styles.backdrop} onPress={() => setPending(null)}>
        <View style={styles.centered}>
          <Pressable style={styles.modal}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-done-outline" size={ms(28)} color={colors.accent} />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>QUICK CHECK</Text>
            </View>
            <Text style={styles.title}>How did your workout finish?</Text>
            <Text style={styles.subtitle}>
              Last time you saved a workout, did it finish normally without getting stuck?
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.8}
              onPress={() => submit('worked_normally')}
            >
              <Ionicons name="checkmark-circle-outline" size={ms(19)} color={colors.textOnAccent} />
              <Text style={styles.primaryButtonText}>Worked normally</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => submit('had_issue')}
            >
              <Ionicons name="warning-outline" size={ms(19)} color={colors.accentRed} />
              <Text style={styles.secondaryButtonText}>I had an issue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.laterButton}
              activeOpacity={0.7}
              onPress={() => setPending(null)}
            >
              <Text style={styles.laterText}>Ask me next time</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default memo(WorkoutFinishFeedbackPrompt);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: `${colors.background}D9`,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sw(22),
    },
    modal: {
      width: '100%',
      maxWidth: sw(400),
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: sw(22),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(22),
      paddingVertical: sw(24),
      ...colors.cardShadow,
    },
    iconWrap: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(28),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentMuted,
      marginBottom: sw(10),
    },
    badge: {
      backgroundColor: colors.accentMuted,
      borderRadius: sw(20),
      paddingHorizontal: sw(10),
      paddingVertical: sw(3),
      marginBottom: sw(10),
    },
    badgeText: {
      color: colors.accent,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 1.1,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      lineHeight: ms(28),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      marginBottom: sw(8),
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginBottom: sw(22),
      paddingHorizontal: sw(4),
    },
    primaryButton: {
      width: '100%',
      minHeight: sw(50),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      marginBottom: sw(10),
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.semiBold,
    },
    secondaryButton: {
      width: '100%',
      minHeight: sw(50),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: sw(12),
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.semiBold,
    },
    laterButton: {
      paddingHorizontal: sw(12),
      paddingVertical: sw(12),
      marginTop: sw(4),
    },
    laterText: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
    },
  });
