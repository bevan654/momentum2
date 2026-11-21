import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useWorkoutWeek } from './useTodayData';
import { useStreakStore } from '../../../stores/useStreakStore';
import ClaudeChatSheet from './ClaudeChatSheet';

interface Props {
  isActive: boolean;
  onPress: () => void;
}

/**
 * Pinned above Home's tab bar: Start / Resume workout (accent), or "Trained today" (plain) once a
 * workout is logged, with the streak; beside it the Ask Claude button, which pops out the chat.
 */
function StartWorkoutButton({ isActive, onPress }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const currentStreak = useStreakStore((st) => st.currentStreak);
  const { todayWorkout } = useWorkoutWeek();
  const trained = !!todayWorkout && !isActive;
  const title = isActive ? 'Resume workout' : trained ? 'Trained today' : 'Start workout';
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <TouchableOpacity style={[s.button, trained && s.buttonDone]} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={title}>
        <Ionicons
          name={trained ? 'checkmark-circle' : isActive ? 'play' : 'barbell'}
          size={ms(19)}
          color={trained ? colors.accentGreen : colors.textOnAccent}
        />
        <Text style={[s.title, trained && s.titleDone]} numberOfLines={1}>{title}</Text>
        <View style={[s.streak, trained && s.streakDone]}>
          <Ionicons name="flame" size={ms(13)} color={trained ? colors.streak : colors.textOnAccent} />
          <Text style={[s.streakText, trained && s.streakTextDone]}>{currentStreak}</Text>
        </View>
      </TouchableOpacity>

      {/* Ask Claude: pops out the chat */}
      <TouchableOpacity style={s.chatBtn} onPress={openChat} activeOpacity={0.85} accessibilityLabel="Ask Claude">
        <Ionicons name="sparkles" size={ms(20)} color={colors.accent} />
      </TouchableOpacity>

      <ClaudeChatSheet visible={chatOpen} onClose={closeChat} />
    </View>
  );
}

export default React.memo(StartWorkoutButton);

/** Space the pinned button takes at the bottom of the page (so content can scroll clear of it). */
export const START_WORKOUT_CLEARANCE = sw(76);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: sw(16), right: sw(16), bottom: sw(12), flexDirection: 'row', gap: sw(10) },
    chatBtn: {
      width: sw(52),
      height: sw(52),
      borderRadius: sw(26),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      ...colors.cardShadow,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      height: sw(52),
      paddingLeft: sw(18),
      paddingRight: sw(8),
      borderRadius: sw(26),
      backgroundColor: colors.accent,
      ...colors.cardShadow,
    },
    buttonDone: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
    title: { flex: 1, color: colors.textOnAccent, fontSize: ms(15), lineHeight: ms(20), fontFamily: Fonts.bold },
    titleDone: { color: colors.textPrimary },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      height: sw(36),
      paddingHorizontal: sw(12),
      borderRadius: sw(18),
      backgroundColor: colors.textOnAccent + '26',
    },
    streakDone: { backgroundColor: colors.streak + '1F' },
    streakText: { color: colors.textOnAccent, fontSize: ms(13), lineHeight: ms(17), fontFamily: Fonts.bold },
    streakTextDone: { color: colors.streak },
  });
