import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import WorkoutMiniMaps from '../body/WorkoutMiniMaps';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';

/* ─── Helpers ──────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(date: Date): string {
  return `${DAY_ABBR[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

function bestSet(ex: SummaryExercise) {
  return ex.sets.reduce((best, s) => (s.completed && s.kg > best.kg ? s : best), ex.sets[0]);
}

/* ─── Constants ────────────────────────────────────────── */

const CARD_WIDTH = SCREEN_WIDTH - sw(32);
const CARD_HEIGHT_STORY = CARD_WIDTH * (16 / 9);
const CARD_HEIGHT_FEED = CARD_WIDTH * (5 / 4);

interface WorkoutOverlayData {
  exercises: SummaryExercise[];
  duration: number;
  date?: Date;
  workoutName?: string | null;
}

interface Props {
  backgroundUri?: string | null;
  data: WorkoutOverlayData;
}

const TEXT_SHADOW = {
  textShadowColor: '#00000090',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

/* ─── Background: the user's photo with a dark fade, or a plain dark gradient ── */

function CardBackground({ backgroundUri }: { backgroundUri?: string | null }) {
  if (backgroundUri) {
    return (
      <>
        <Image source={{ uri: backgroundUri }} style={cardStyles.bgImage} resizeMode="cover" />
        <LinearGradient
          colors={['#00000000', '#00000000', '#000000A0', '#000000DD']}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </>
    );
  }
  return (
    <LinearGradient
      colors={['#0F0F12', '#161619', '#1A1A1F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/* ─── Share card (image shared from the workout summary) ── */

export default function WorkoutOverlay({ backgroundUri, data: d }: Props) {
  const colors = useColors();
  const hasImage = !!backgroundUri;
  const cardHeight = hasImage ? CARD_HEIGHT_STORY : CARD_HEIGHT_FEED;
  const styles = useMemo(() => createStyles(hasImage), [hasImage]);
  const date = d.date || new Date();
  const label = d.workoutName || DAY_NAMES[date.getDay()];

  return (
    <View style={[cardStyles.card, { height: cardHeight }]}>
      <CardBackground backgroundUri={backgroundUri} />
      <View style={[styles.accentGlow, { backgroundColor: colors.accent + '08' }]} />

      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          <Text style={styles.workoutLabel}>{label}</Text>
        </View>
        <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.heroSection}>
        <Text style={styles.heroNumber}>{formatDuration(d.duration)}</Text>
        <Text style={styles.heroLabel}>workout time</Text>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.exerciseList}>
          {d.exercises.map((ex, i) => {
            const best = bestSet(ex);
            return (
              <View key={i} style={styles.exerciseRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                <Text style={styles.exerciseStat}>{best.kg}kg × {best.reps}</Text>
              </View>
            );
          })}
        </View>
        <WorkoutMiniMaps exercises={d.exercises} height={sw(100)} style={styles.bodyMapCol} transparentBody />
      </View>

      <LinearGradient
        colors={['#FFFFFF00', hasImage ? '#FFFFFF50' : '#FFFFFF30', '#FFFFFF00']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bottomLine}
      />
      <Text style={styles.branding}>@momentumfitapp</Text>
    </View>
  );
}

const createStyles = (hasImage: boolean) =>
  StyleSheet.create({
    accentGlow: { position: 'absolute', top: -sw(60), left: '20%', width: '60%', height: sw(120), borderRadius: sw(60) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: sw(20), paddingTop: sw(20) },
    dateText: { color: hasImage ? '#FFFFFFCC' : '#8E8E93', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, ...(hasImage && TEXT_SHADOW) },
    workoutLabel: { color: '#FFFFFF', fontSize: ms(20), lineHeight: ms(26), fontFamily: Fonts.bold, letterSpacing: -0.3, marginTop: sw(2), ...(hasImage && TEXT_SHADOW) },
    logoImage: { width: sw(32), height: sw(32), borderRadius: sw(8) },
    heroSection: { paddingHorizontal: sw(20), marginTop: sw(16) },
    heroNumber: { color: '#FFFFFF', fontSize: ms(48), lineHeight: ms(52), fontFamily: Fonts.extraBold, letterSpacing: -2, ...(hasImage && TEXT_SHADOW) },
    heroLabel: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, marginTop: sw(-2), ...(hasImage && TEXT_SHADOW) },
    bottomSection: { flexDirection: 'row', paddingHorizontal: sw(20), marginTop: sw(14), paddingBottom: sw(4) },
    exerciseList: { flex: 1, gap: sw(5), justifyContent: 'center' },
    exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    exerciseName: { color: hasImage ? '#FFFFFFDD' : '#C7C7CC', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.medium, flex: 1, ...(hasImage && TEXT_SHADOW) },
    exerciseStat: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.medium, marginLeft: sw(6), ...(hasImage && TEXT_SHADOW) },
    bodyMapCol: { flexDirection: 'row', alignItems: 'center', gap: sw(2), marginLeft: sw(8) },
    bottomLine: { height: sw(2), marginHorizontal: sw(20), marginTop: sw(8), borderRadius: sw(1) },
    branding: { color: hasImage ? '#FFFFFFCC' : '#FFFFFFAA', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.bold, textAlign: 'center', letterSpacing: 0.3, marginTop: sw(8), marginBottom: sw(16), ...(hasImage && TEXT_SHADOW) },
  });

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: sw(20),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
