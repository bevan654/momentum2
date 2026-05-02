import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

const STEP_GOAL = 10000;

function formatCompact(n: number) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function StepsCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [steps, setSteps] = useState<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  // Fetch the cumulative step count from midnight → now.
  const fetchToday = async () => {
    try {
      const ok = await Pedometer.isAvailableAsync();
      setAvailable(ok);
      if (!ok) return;
      const perm = await Pedometer.getPermissionsAsync();
      if (!perm.granted) {
        const req = await Pedometer.requestPermissionsAsync();
        if (!req.granted) return;
      }
      const result = await Pedometer.getStepCountAsync(startOfToday(), new Date());
      setSteps(result.steps ?? 0);
    } catch {
      setAvailable(false);
    }
  };

  useEffect(() => {
    fetchToday();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchToday();
    });
    return () => sub.remove();
  }, []);

  // Live increments while the app is foregrounded.
  useEffect(() => {
    if (!available) return;
    const sub = Pedometer.watchStepCount((r) => {
      setSteps((prev) => (prev ?? 0) + (r.steps ?? 0));
    });
    return () => sub?.remove();
  }, [available]);

  const display = available === false ? '—' : formatCompact(steps ?? 0);
  const progress = available === false ? 0 : Math.min((steps ?? 0) / STEP_GOAL, 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Steps</Text>
      <View style={styles.statRow}>
        <View style={styles.statLeft}>
          <Text style={styles.statValue}>{display}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

export default React.memo(StepsCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flex: 0.6,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(14),
    justifyContent: 'space-between',
    gap: sw(12),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: sw(16),
  },
  statLeft: {},
  statValue: {
    color: colors.textPrimary,
    fontFamily: Fonts.extraBold,
    fontSize: ms(26),
    lineHeight: ms(30),
    letterSpacing: -0.6,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
    marginTop: sw(2),
  },
  statRight: {
    alignItems: 'flex-end',
    gap: sw(2),
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  targetDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.accent,
  },
  targetWord: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
  },
  targetValue: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  targetUnit: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
  },
  progressTrack: {
    height: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: sw(2),
  },
});
