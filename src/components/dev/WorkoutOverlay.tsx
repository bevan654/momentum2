import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MiniBodyMap from '../body/MiniBodyMap';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';

/* ─── Helpers ───────────────────────────────────────────── */

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

/** Convert SummaryExercise[] to the shape MiniBodyMap expects */
function toBodyMapExercises(exercises: SummaryExercise[], catalogMap?: Record<string, any>): ExerciseWithSets[] {
  return exercises.map((ex, i) => ({
    id: String(i),
    name: ex.name,
    exercise_order: i + 1,
    exercise_type: catalogMap?.[ex.name]?.exercise_type || 'weighted',
    category: ex.category,
    primary_muscles: catalogMap?.[ex.name]?.primary_muscles || [],
    secondary_muscles: catalogMap?.[ex.name]?.secondary_muscles || [],
    hasPR: false,
    sets: ex.sets.map((s, j) => ({
      id: `s${i}-${j}`,
      set_number: j + 1,
      kg: s.kg,
      reps: s.reps,
      completed: s.completed,
      set_type: s.set_type,
      isPR: false,
    })),
  }));
}

/* ─── Component ─────────────────────────────────────────── */

export const CARD_WIDTH = SCREEN_WIDTH - sw(32);
export const CARD_HEIGHT_STORY = CARD_WIDTH * (16 / 9);
export const CARD_HEIGHT_FEED = CARD_WIDTH * (5 / 4);

export interface WorkoutOverlayData {
  exercises: SummaryExercise[];
  duration: number;
  date?: Date;
  workoutName?: string | null;
  catalogMap?: Record<string, any>;
}

interface Props {
  backgroundUri?: string | null;
  data?: WorkoutOverlayData;
}

/* ─── Mock data for dev/preview ────────────────────────── */

const MOCK_DATA: WorkoutOverlayData = {
  exercises: [
    { name: 'Bench Press', category: 'chest', sets: [{ kg: 100, reps: 8, completed: true, set_type: 'working' }, { kg: 110, reps: 6, completed: true, set_type: 'working' }] },
    { name: 'Incline Dumbbell Press', category: 'chest', sets: [{ kg: 36, reps: 10, completed: true, set_type: 'working' }] },
    { name: 'Cable Flyes', category: 'chest', sets: [{ kg: 15, reps: 12, completed: true, set_type: 'working' }] },
    { name: 'Tricep Pushdowns', category: 'arms', sets: [{ kg: 30, reps: 12, completed: true, set_type: 'working' }] },
    { name: 'Lateral Raises', category: 'shoulders', sets: [{ kg: 14, reps: 15, completed: true, set_type: 'working' }] },
  ],
  duration: 4320,
  workoutName: null,
};

export default function WorkoutOverlay({ backgroundUri, data }: Props) {
  const colors = useColors();
  const hasImage = !!backgroundUri;
  const styles = useMemo(() => createStyles(colors, hasImage), [colors, hasImage]);
  const cardHeight = hasImage ? CARD_HEIGHT_STORY : CARD_HEIGHT_FEED;

  const d = data || MOCK_DATA;
  const dateStr = formatDate(d.date || new Date());
  const label = d.workoutName || DAY_NAMES[(d.date || new Date()).getDay()];
  const bodyMapExercises = useMemo(() => toBodyMapExercises(d.exercises, d.catalogMap), [d.exercises, d.catalogMap]);

  return (
    <View style={[styles.card, { height: cardHeight }]}>
      {/* Background: photo or gradient */}
      {hasImage ? (
        <>
          <Image
            source={{ uri: backgroundUri! }}
            style={styles.bgImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['#00000000', '#00000000', '#000000A0', '#000000DD']}
            locations={[0, 0.4, 0.7, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <LinearGradient
          colors={['#0F0F12', '#161619', '#1A1A1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.accentGlow, { backgroundColor: colors.accent + '08' }]} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.workoutLabel}>{label}</Text>
        </View>
        <Image source={require('../../../assets/icon.png')} style={styles.logoImage} />
      </View>

      <View style={styles.imageSpacer} />

      {/* Duration hero */}
      <View style={styles.heroSection}>
        <Text style={styles.heroNumber}>{formatDuration(d.duration)}</Text>
        <Text style={styles.heroLabel}>workout time</Text>
      </View>

      {/* Exercise list + Body map */}
      <View style={styles.bottomSection}>
        <View style={styles.exerciseList}>
          {d.exercises.map((ex, i) => {
            const bestSet = ex.sets.reduce(
              (best, s) => (s.completed && s.kg > best.kg ? s : best),
              ex.sets[0],
            );
            return (
              <View key={i} style={styles.exerciseRow}>
                <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                <Text style={styles.exerciseStat}>{bestSet.kg}kg × {bestSet.reps}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.bodyMapCol}>
          <MiniBodyMap exercises={bodyMapExercises} scale={0.25} side="front" backColor="transparent" />
          <MiniBodyMap exercises={bodyMapExercises} scale={0.25} side="back" backColor="transparent" />
        </View>
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

/* ─── Styles ──────────────────────────────────────────── */

const TEXT_SHADOW = {
  textShadowColor: '#00000090',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

const createStyles = (colors: ThemeColors, hasImage: boolean) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      borderRadius: sw(20),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#2A2A2E',
    },
    bgImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    imageSpacer: { flex: 1 },
    accentGlow: {
      position: 'absolute',
      top: -sw(60),
      left: '20%',
      width: '60%',
      height: sw(120),
      borderRadius: sw(60),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: sw(20),
      paddingTop: sw(20),
    },
    dateText: {
      color: hasImage ? '#FFFFFFCC' : '#8E8E93',
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      ...(hasImage && TEXT_SHADOW),
    },
    workoutLabel: {
      color: '#FFFFFF',
      fontSize: ms(20),
      lineHeight: ms(26),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
      marginTop: sw(2),
      ...(hasImage && TEXT_SHADOW),
    },
    logoImage: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(8),
    },
    heroSection: {
      paddingHorizontal: sw(20),
      marginTop: sw(16),
    },
    heroNumber: {
      color: '#FFFFFF',
      fontSize: ms(48),
      lineHeight: ms(52),
      fontFamily: Fonts.extraBold,
      letterSpacing: -2,
      ...(hasImage && TEXT_SHADOW),
    },
    heroLabel: {
      color: hasImage ? '#FFFFFFAA' : '#636366',
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginTop: sw(-2),
      ...(hasImage && TEXT_SHADOW),
    },
    bottomSection: {
      flexDirection: 'row',
      paddingHorizontal: sw(20),
      marginTop: sw(14),
      paddingBottom: sw(4),
    },
    exerciseList: {
      flex: 1,
      gap: sw(5),
      justifyContent: 'center',
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    exerciseName: {
      color: hasImage ? '#FFFFFFDD' : '#C7C7CC',
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      flex: 1,
      ...(hasImage && TEXT_SHADOW),
    },
    exerciseStat: {
      color: hasImage ? '#FFFFFFAA' : '#636366',
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      marginLeft: sw(6),
      ...(hasImage && TEXT_SHADOW),
    },
    bodyMapCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(2),
      marginLeft: sw(8),
    },
    bottomLine: {
      height: sw(2),
      marginHorizontal: sw(20),
      marginTop: sw(8),
      borderRadius: sw(1),
    },
    branding: {
      color: hasImage ? '#FFFFFFCC' : '#FFFFFFAA',
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      letterSpacing: 0.3,
      marginTop: sw(8),
      marginBottom: sw(16),
      ...(hasImage && TEXT_SHADOW),
    },
  });
