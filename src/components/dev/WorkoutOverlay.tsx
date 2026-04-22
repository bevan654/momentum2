import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MiniBodyMap from '../body/MiniBodyMap';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';

/* ─── Helpers ──────────────��────────────────────────────── */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1).replace(/\.0$/, '')}k kg` : `${Math.round(kg)} kg`;
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

const VALID_MUSCLE_GROUPS = new Set(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio']);

function computeStats(exercises: SummaryExercise[]) {
  let totalSets = 0;
  let totalVolume = 0;
  const categories = new Set<string>();
  for (const ex of exercises) {
    if (ex.category && VALID_MUSCLE_GROUPS.has(ex.category.toLowerCase())) categories.add(ex.category);
    for (const s of ex.sets) {
      if (s.completed) {
        totalSets++;
        totalVolume += s.kg * s.reps;
      }
    }
  }
  return { totalSets, totalVolume, muscleGroups: [...categories] };
}

function bestSet(ex: SummaryExercise) {
  return ex.sets.reduce((best, s) => (s.completed && s.kg > best.kg ? s : best), ex.sets[0]);
}

function capitalize(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Constants ────────────────────────────────────────── */

export const CARD_WIDTH = SCREEN_WIDTH - sw(32);
export const CARD_HEIGHT_STORY = CARD_WIDTH * (16 / 9);
export const CARD_HEIGHT_FEED = CARD_WIDTH * (5 / 4);

export type CardVariant = 'classic' | 'minimal' | 'bold' | 'poster';

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
  variant?: CardVariant;
}

/* ─── Mock data for dev/preview ────────────────────────── */

const MOCK_DATA: WorkoutOverlayData = {
  exercises: [
    { name: 'Bench Press', category: 'chest', exercise_type: 'weighted', sets: [{ kg: 100, reps: 8, completed: true, set_type: 'working' }, { kg: 110, reps: 6, completed: true, set_type: 'working' }] },
    { name: 'Incline Dumbbell Press', category: 'chest', exercise_type: 'weighted', sets: [{ kg: 36, reps: 10, completed: true, set_type: 'working' }] },
    { name: 'Cable Flyes', category: 'chest', exercise_type: 'weighted', sets: [{ kg: 15, reps: 12, completed: true, set_type: 'working' }] },
    { name: 'Tricep Pushdowns', category: 'arms', exercise_type: 'weighted', sets: [{ kg: 30, reps: 12, completed: true, set_type: 'working' }] },
    { name: 'Lateral Raises', category: 'shoulders', exercise_type: 'weighted', sets: [{ kg: 14, reps: 15, completed: true, set_type: 'working' }] },
  ],
  duration: 4320,
  workoutName: null,
};

const TEXT_SHADOW = {
  textShadowColor: '#00000090',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

/* ─── Shared background layer ──────────────────────────── */

function CardBackground({ backgroundUri, hasImage, accentOverlay }: { backgroundUri?: string | null; hasImage: boolean; accentOverlay?: boolean }) {
  if (hasImage) {
    return (
      <>
        <Image source={{ uri: backgroundUri! }} style={sharedStyles.bgImage} resizeMode="cover" />
        <LinearGradient
          colors={accentOverlay ? ['#00000000', '#00000020', '#000000B0', '#000000E0'] : ['#00000000', '#00000000', '#000000A0', '#000000DD']}
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

const sharedStyles = StyleSheet.create({
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VARIANT: Classic (original design)
   ━━━━━━━━━���━━━━━━━━━━━━━━━━��━━━━━━━━━━━━��━━━━━━━━━━━━━━━ */

function ClassicVariant({ d, hasImage, backgroundUri, colors, bodyMapExercises }: {
  d: WorkoutOverlayData; hasImage: boolean; backgroundUri?: string | null; colors: ThemeColors; bodyMapExercises: ExerciseWithSets[];
}) {
  const styles = useMemo(() => classicStyles(colors, hasImage), [colors, hasImage]);
  const dateStr = formatDate(d.date || new Date());
  const label = d.workoutName || DAY_NAMES[(d.date || new Date()).getDay()];

  return (
    <>
      <CardBackground backgroundUri={backgroundUri} hasImage={hasImage} />
      <View style={[styles.accentGlow, { backgroundColor: colors.accent + '08' }]} />

      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateStr}</Text>
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
    </>
  );
}

const classicStyles = (colors: ThemeColors, hasImage: boolean) =>
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   VARIANT: Minimal — bottom-weighted, negative space hero
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function MinimalVariant({ d, hasImage, backgroundUri, colors, bodyMapExercises }: {
  d: WorkoutOverlayData; hasImage: boolean; backgroundUri?: string | null; colors: ThemeColors; bodyMapExercises: ExerciseWithSets[];
}) {
  const styles = useMemo(() => minimalStyles(colors, hasImage), [colors, hasImage]);
  const date = d.date || new Date();
  const dayName = d.workoutName || DAY_NAMES[date.getDay()];
  const stats = useMemo(() => computeStats(d.exercises), [d.exercises]);
  const muscles = stats.muscleGroups.map(capitalize).join(', ');
  const finishTime = useMemo(() => {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }, [date]);

  return (
    <>
      <CardBackground backgroundUri={backgroundUri} hasImage={hasImage} />

      {/* Top: logo + wordmark */}
      <View style={styles.topRow}>
        <Image source={require('../../../assets/logo.png')} style={styles.topLogo} />
        <Text style={styles.topWordmark}>MOMENTUM</Text>
      </View>

      {/* Spacer — let the photo / gradient breathe */}
      <View style={{ flex: 1 }} />

      {/* Bottom cluster */}
      <View style={styles.bottom}>
        <Text style={styles.dayName}>{dayName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatDate(date)}</Text>
          <View style={[styles.metaDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.metaText}>{formatDuration(d.duration)}</Text>
          <View style={[styles.metaDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.metaText}>{d.exercises.length} exercises</Text>
          <View style={[styles.metaDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.metaText}>{finishTime}</Text>
        </View>
        {muscles ? <Text style={styles.muscles}>{muscles}</Text> : null}
        <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
      </View>

      {/* Body map — below the accent bar */}
      <View style={styles.bodyMapRow}>
        <MiniBodyMap exercises={bodyMapExercises} scale={0.25} side="front" backColor="transparent" />
        <MiniBodyMap exercises={bodyMapExercises} scale={0.25} side="back" backColor="transparent" />
      </View>

      <Text style={styles.branding}>@momentumfitapp</Text>
    </>
  );
}

const minimalStyles = (colors: ThemeColors, hasImage: boolean) =>
  StyleSheet.create({
    topRow: { flexDirection: 'row', alignItems: 'center', gap: sw(8), paddingHorizontal: sw(24), paddingTop: sw(20) },
    topLogo: { width: sw(26), height: sw(26), borderRadius: sw(7) },
    topWordmark: { color: hasImage ? '#FFFFFFCC' : '#FFFFFF99', fontSize: ms(13), fontFamily: Fonts.bold, letterSpacing: 2, ...(hasImage && TEXT_SHADOW) },
    bodyMapRow: { flexDirection: 'row', gap: sw(4), marginTop: sw(10), paddingHorizontal: sw(24) },
    bottom: { paddingHorizontal: sw(24), gap: sw(6) },
    dayName: { color: '#FFFFFF', fontSize: ms(28), lineHeight: ms(34), fontFamily: Fonts.bold, letterSpacing: -0.5, ...(hasImage && TEXT_SHADOW) },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: sw(8) },
    metaText: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, ...(hasImage && TEXT_SHADOW) },
    metaDot: { width: sw(3), height: sw(3), borderRadius: sw(2) },
    muscles: { color: hasImage ? '#FFFFFF88' : '#4A4A4E', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.medium, ...(hasImage && TEXT_SHADOW) },
    accentBar: { width: sw(32), height: sw(3), borderRadius: sw(2), marginTop: sw(4) },
    branding: { color: hasImage ? '#FFFFFF77' : '#FFFFFF44', fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, letterSpacing: 0.3, paddingHorizontal: sw(24), marginTop: sw(14), marginBottom: sw(18), ...(hasImage && TEXT_SHADOW) },
  });

/* ━━━━━━━━━━━━━━━���━━━━━━━━━━━━━���━━━━━━━━━━━━━━��━━━━━━━━━━
   VARIANT: Bold — accent stat blocks, punchy
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━ */

function BoldVariant({ d, hasImage, backgroundUri, colors, bodyMapExercises }: {
  d: WorkoutOverlayData; hasImage: boolean; backgroundUri?: string | null; colors: ThemeColors; bodyMapExercises: ExerciseWithSets[];
}) {
  const styles = useMemo(() => boldStyles(colors, hasImage), [colors, hasImage]);
  const stats = useMemo(() => computeStats(d.exercises), [d.exercises]);
  const dateStr = formatDate(d.date || new Date());
  const label = d.workoutName || DAY_NAMES[(d.date || new Date()).getDay()];

  return (
    <>
      <CardBackground backgroundUri={backgroundUri} hasImage={hasImage} accentOverlay />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
      </View>

      {/* Stat blocks row */}
      <View style={styles.statRow}>
        {[
          { value: formatDuration(d.duration), label: 'Duration' },
          { value: String(d.exercises.length), label: 'Exercises' },
          { value: String(stats.totalSets), label: 'Sets' },
        ].map((item, i) => (
          <View key={i} style={[styles.statBlock, { backgroundColor: colors.accent + '18' }]}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* Exercise list */}
      <View style={styles.exerciseWrap}>
        {d.exercises.map((ex, i) => {
          const best = bestSet(ex);
          return (
            <View key={i} style={styles.exerciseRow}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
              <Text style={styles.exerciseStat}>{best.kg}kg × {best.reps}</Text>
            </View>
          );
        })}
      </View>

      {/* Body map */}
      <View style={styles.bodyMapRow}>
        <MiniBodyMap exercises={bodyMapExercises} scale={0.35} side="front" backColor="transparent" />
        <MiniBodyMap exercises={bodyMapExercises} scale={0.35} side="back" backColor="transparent" />
      </View>

      <Text style={styles.branding}>@momentumfitapp</Text>
    </>
  );
}

const boldStyles = (colors: ThemeColors, hasImage: boolean) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: sw(20), paddingTop: sw(20) },
    dateText: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.medium, ...(hasImage && TEXT_SHADOW) },
    label: { color: '#FFFFFF', fontSize: ms(18), lineHeight: ms(24), fontFamily: Fonts.bold, letterSpacing: -0.3, marginTop: sw(2), ...(hasImage && TEXT_SHADOW) },
    logoImage: { width: sw(30), height: sw(30), borderRadius: sw(8) },
    statRow: { flexDirection: 'row', paddingHorizontal: sw(16), marginTop: sw(16), gap: sw(8) },
    statBlock: { flex: 1, borderRadius: sw(14), paddingVertical: sw(12), alignItems: 'center' },
    statValue: { fontSize: ms(20), lineHeight: ms(24), fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
    statLabel: { color: hasImage ? '#FFFFFFAA' : '#8E8E93', fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2), ...(hasImage && TEXT_SHADOW) },
    exerciseWrap: { paddingHorizontal: sw(20), gap: sw(6) },
    exerciseRow: { flexDirection: 'row', alignItems: 'center' },
    dot: { width: sw(5), height: sw(5), borderRadius: sw(3), marginRight: sw(8) },
    exerciseName: { color: hasImage ? '#FFFFFFDD' : '#C7C7CC', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, flex: 1, ...(hasImage && TEXT_SHADOW) },
    exerciseStat: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, marginLeft: sw(6), ...(hasImage && TEXT_SHADOW) },
    bodyMapRow: { flexDirection: 'row', justifyContent: 'center', gap: sw(4), marginTop: sw(12) },
    branding: { color: hasImage ? '#FFFFFFCC' : '#FFFFFFAA', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.bold, textAlign: 'center', letterSpacing: 0.3, marginTop: sw(8), marginBottom: sw(14), ...(hasImage && TEXT_SHADOW) },
  });

/* ━━━━━━���━━━━━━━━━━━━���━━━━━━━━━━━━━━━━���━━━━���━━━━━━���━━━━━━
   VARIANT: Poster — visual-first, magazine cover
   ━━━���━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PosterVariant({ d, hasImage, backgroundUri, colors, bodyMapExercises }: {
  d: WorkoutOverlayData; hasImage: boolean; backgroundUri?: string | null; colors: ThemeColors; bodyMapExercises: ExerciseWithSets[];
}) {
  const styles = useMemo(() => posterStyles(colors, hasImage), [colors, hasImage]);
  const stats = useMemo(() => computeStats(d.exercises), [d.exercises]);
  const dateStr = formatDate(d.date || new Date());

  return (
    <>
      <CardBackground backgroundUri={backgroundUri} hasImage={hasImage} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* Fill space — photo hero */}
      <View style={{ flex: 1 }} />

      {/* Muscle group tags */}
      <View style={styles.tagsRow}>
        {stats.muscleGroups.map((group, i) => (
          <View key={i} style={[styles.tag, { backgroundColor: colors.accent + '20', borderColor: colors.accent + '40' }]}>
            <Text style={[styles.tagText, { color: colors.accent }]}>{capitalize(group)}</Text>
          </View>
        ))}
      </View>

      {/* Stats ribbon */}
      <View style={styles.ribbon}>
        <View style={styles.ribbonItem}>
          <Text style={styles.ribbonValue}>{formatDuration(d.duration)}</Text>
          <Text style={styles.ribbonLabel}>duration</Text>
        </View>
        <View style={[styles.ribbonDivider, { backgroundColor: hasImage ? '#FFFFFF30' : '#2A2A2E' }]} />
        <View style={styles.ribbonItem}>
          <Text style={styles.ribbonValue}>{d.exercises.length}</Text>
          <Text style={styles.ribbonLabel}>exercises</Text>
        </View>
        <View style={[styles.ribbonDivider, { backgroundColor: hasImage ? '#FFFFFF30' : '#2A2A2E' }]} />
        <View style={styles.ribbonItem}>
          <Text style={styles.ribbonValue}>{formatVolume(stats.totalVolume)}</Text>
          <Text style={styles.ribbonLabel}>volume</Text>
        </View>
      </View>

      {/* Body map — only in no-photo mode */}
      {!hasImage && (
        <View style={styles.bodyMapRow}>
          <MiniBodyMap exercises={bodyMapExercises} scale={0.3} side="front" backColor="transparent" />
          <MiniBodyMap exercises={bodyMapExercises} scale={0.3} side="back" backColor="transparent" />
        </View>
      )}

      <Text style={styles.branding}>@momentumfitapp</Text>
    </>
  );
}

const posterStyles = (colors: ThemeColors, hasImage: boolean) =>
  StyleSheet.create({
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sw(20), paddingTop: sw(20) },
    logoImage: { width: sw(30), height: sw(30), borderRadius: sw(8) },
    dateText: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.medium, ...(hasImage && TEXT_SHADOW) },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: sw(20), gap: sw(6), marginBottom: sw(12) },
    tag: { paddingHorizontal: sw(10), paddingVertical: sw(5), borderRadius: sw(8), borderWidth: 1 },
    tagText: { fontSize: ms(11), lineHeight: ms(14), fontFamily: Fonts.semiBold },
    ribbon: { flexDirection: 'row', marginHorizontal: sw(20), backgroundColor: hasImage ? '#00000060' : '#1A1A1F', borderRadius: sw(14), paddingVertical: sw(14), paddingHorizontal: sw(8), alignItems: 'center' },
    ribbonItem: { flex: 1, alignItems: 'center' },
    ribbonValue: { color: '#FFFFFF', fontSize: ms(18), lineHeight: ms(22), fontFamily: Fonts.extraBold, letterSpacing: -0.5, ...(hasImage && TEXT_SHADOW) },
    ribbonLabel: { color: hasImage ? '#FFFFFFAA' : '#636366', fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2), ...(hasImage && TEXT_SHADOW) },
    ribbonDivider: { width: 1, height: sw(28), borderRadius: 1 },
    bodyMapRow: { flexDirection: 'row', justifyContent: 'center', gap: sw(4), marginTop: sw(14) },
    branding: { color: hasImage ? '#FFFFFFBB' : '#FFFFFF88', fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.bold, textAlign: 'center', letterSpacing: 0.3, marginTop: sw(12), marginBottom: sw(16), ...(hasImage && TEXT_SHADOW) },
  });

/* ━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN COMPONENT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━���━━━━━━��━━━━━━���━━━━━━━━ */

export default function WorkoutOverlay({ backgroundUri, data, variant = 'classic' }: Props) {
  const colors = useColors();
  const hasImage = !!backgroundUri;
  const cardHeight = hasImage ? CARD_HEIGHT_STORY : CARD_HEIGHT_FEED;
  const d = data || MOCK_DATA;
  const bodyMapExercises = useMemo(() => toBodyMapExercises(d.exercises, d.catalogMap), [d.exercises, d.catalogMap]);

  const shared = { d, hasImage, backgroundUri, colors, bodyMapExercises };

  return (
    <View style={[cardStyles.card, { height: cardHeight }]}>
      {variant === 'classic' && <ClassicVariant {...shared} />}
      {variant === 'minimal' && <MinimalVariant {...shared} />}
      {variant === 'bold' && <BoldVariant {...shared} />}
      {variant === 'poster' && <PosterVariant {...shared} />}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: sw(20),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
});
