import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWidgetStore } from '../../stores/useWidgetStore';

const TIPS = [
  { icon: 'grid-outline' as const, title: 'Your Dashboard', desc: 'Each card is a widget showing your daily stats at a glance.' },
  { icon: 'move-outline' as const, title: 'Drag to Reorder', desc: 'Tap Customize, then drag any widget to rearrange your layout.' },
  { icon: 'resize-outline' as const, title: 'Change Size', desc: 'Tap the size badge (S/M/L/XL) to cycle through available sizes.' },
  { icon: 'add-circle-outline' as const, title: 'Add & Remove', desc: 'Use the + button to add widgets, or tap the X to remove one.' },
];

export default function TutorialOverlay() {
  const dismissTutorial = useWidgetStore((s) => s.dismissTutorial);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.heading}>Welcome to Your Dashboard</Text>

        {TIPS.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={[styles.tipIcon, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name={tip.icon} size={ms(18)} color={colors.accent} />
            </View>
            <View style={styles.tipText}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDesc}>{tip.desc}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={dismissTutorial}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: sw(24),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(20),
    padding: sw(24),
    width: '100%',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(26),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: sw(20),
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    marginBottom: sw(16),
  },
  tipIcon: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipText: {
    flex: 1,
  },
  tipTitle: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  tipDesc: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  button: {
    borderRadius: sw(12),
    paddingVertical: sw(14),
    alignItems: 'center',
    marginTop: sw(8),
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.bold,
  },
});
