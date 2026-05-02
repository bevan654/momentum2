import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useAuthStore } from '../../stores/useAuthStore';
import { useWeightStore } from '../../stores/useWeightStore';

const SCALE_MIN = 15;
const SCALE_MAX = 35;

type Category = {
  label: string;
  colorKey: 'accent' | 'accentGreen' | 'accentOrange' | 'accentRed';
};

function categorize(bmi: number): Category {
  if (bmi < 18.5) return { label: 'Underweight', colorKey: 'accent' };
  if (bmi < 25) return { label: 'Normal', colorKey: 'accentGreen' };
  if (bmi < 30) return { label: 'Overweight', colorKey: 'accentOrange' };
  return { label: 'Obese', colorKey: 'accentRed' };
}

function BmiCard() {
  const heightCm = useAuthStore((s) => s.profile?.height ?? null);
  const weightKg = useWeightStore((s) => s.current);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const bmi = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0) return null;
    const m = heightCm / 100;
    return weightKg / (m * m);
  }, [heightCm, weightKg]);

  if (bmi == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>
          {heightCm ? 'Log your weight to see BMI' : 'Add height in profile to see BMI'}
        </Text>
      </View>
    );
  }

  const category = categorize(bmi);
  const accentColor = colors[category.colorKey];

  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, bmi));
  const markerPct = ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  const seg = (lo: number, hi: number) => ((hi - lo) / (SCALE_MAX - SCALE_MIN)) * 100;

  // Active segment renders at full opacity, the rest dim ("+55" ≈ 33%).
  const dimSuffix = (key: Category['colorKey']) => (category.colorKey === key ? '' : '55');

  return (
    <View style={styles.card}>
      <View style={styles.valueRow}>
        <View style={styles.valueCol}>
          <Text style={styles.value}>{bmi.toFixed(1)}</Text>
          <Text style={styles.label}>BMI</Text>
        </View>
        <View style={styles.categoryCenter}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <Text style={[styles.category, { color: accentColor }]}>{category.label}</Text>
        </View>
        <View style={styles.valueCol}>
          <Text style={styles.value}>{weightKg!.toFixed(1)}<Text style={styles.unit}> kg</Text></Text>
          <Text style={styles.label}>CURRENT WEIGHT</Text>
        </View>
      </View>

      <View style={styles.scaleTrack}>
        <View style={[styles.segment, { width: `${seg(SCALE_MIN, 18.5)}%`, backgroundColor: colors.accent + dimSuffix('accent') }]} />
        <View style={[styles.segment, { width: `${seg(18.5, 25)}%`, backgroundColor: colors.accentGreen + dimSuffix('accentGreen') }]} />
        <View style={[styles.segment, { width: `${seg(25, 30)}%`, backgroundColor: colors.accentOrange + dimSuffix('accentOrange') }]} />
        <View style={[styles.segment, { width: `${seg(30, SCALE_MAX)}%`, backgroundColor: colors.accentRed + dimSuffix('accentRed') }]} />
        <View style={[styles.marker, { left: `${markerPct}%`, backgroundColor: accentColor }]} />
      </View>

      <Text style={styles.disclaimer}>
        Calculated from your latest weight and profile height.
      </Text>
    </View>
  );
}

export default React.memo(BmiCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(14),
    gap: sw(8),
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sw(8),
  },
  valueCol: {
    flexShrink: 1,
  },
  categoryCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
    flexShrink: 1,
  },
  value: {
    color: colors.textPrimary,
    fontFamily: Fonts.extraBold,
    fontSize: ms(26),
    lineHeight: ms(30),
    letterSpacing: -0.6,
  },
  unit: {
    color: colors.textTertiary,
    fontFamily: Fonts.medium,
    fontSize: ms(15),
    letterSpacing: 0,
  },
  label: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    letterSpacing: 0.8,
    marginTop: sw(2),
  },
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  category: {
    fontSize: ms(12),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scaleTrack: {
    height: sw(6),
    borderRadius: sw(3),
    flexDirection: 'row',
    overflow: 'visible',
    position: 'relative',
  },
  segment: {
    height: '100%',
  },
  marker: {
    position: 'absolute',
    width: sw(3),
    height: sw(14),
    top: sw(-4),
    marginLeft: sw(-1.5),
  },
  empty: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  disclaimer: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    marginTop: sw(4),
  },
});
