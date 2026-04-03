import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Canvas, Path as SkiaPath, Skia, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { useThemeStore } from '../../stores/useThemeStore';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useStreakStore } from '../../stores/useStreakStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import AvatarCircle from '../friends/AvatarCircle';
import { openProfileSheet } from '../../navigation/TabNavigator';

/* ─── Date helpers ──────────────────────────────────────── */

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TODAY_STR = toDateStr(new Date());

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatDateChip(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/* ─── Glass border + corner glow (Skia) ─────────────────── */

const GLASS_BORDER_WIDTH = 1.5;
const GLASS_RADIUS = sw(22);

const GlassCornerGlow = React.memo(({ width, height, radius, accentColor, borderColor }: {
  width: number; height: number; radius: number; accentColor: string; borderColor: string;
}) => {
  const bw = GLASS_BORDER_WIDTH;
  const half = bw / 2;

  const borderPath = useMemo(() => {
    const ir = Math.max(radius - half, 0);
    const rect = Skia.XYWHRect(half, half, width - bw, height - bw);
    const rrect = Skia.RRectXY(rect, ir, ir);
    const p = Skia.Path.Make();
    p.addRRect(rrect);
    return p;
  }, [width, height, radius]);

  const reach = radius * 3.5;

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw} color={borderColor} />
      {/* Bottom-left bloom */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw + 1}>
        <RadialGradient c={vec(0, height)} r={reach} colors={[accentColor, `${accentColor}90`, `${accentColor}00`]} positions={[0, 0.35, 1]} />
        <BlurMask blur={sw(1.5)} style="normal" />
      </SkiaPath>
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw}>
        <RadialGradient c={vec(0, height)} r={reach} colors={[accentColor, `${accentColor}DD`, `${accentColor}00`]} positions={[0, 0.4, 1]} />
      </SkiaPath>
      {/* Top 45% from right bloom */}
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw + 1}>
        <RadialGradient c={vec(width * 0.55, 0)} r={reach} colors={[accentColor, `${accentColor}90`, `${accentColor}00`]} positions={[0, 0.35, 1]} />
        <BlurMask blur={sw(1.5)} style="normal" />
      </SkiaPath>
      <SkiaPath path={borderPath} style="stroke" strokeWidth={bw}>
        <RadialGradient c={vec(width * 0.55, 0)} r={reach} colors={[accentColor, `${accentColor}DD`, `${accentColor}00`]} positions={[0, 0.4, 1]} />
      </SkiaPath>
    </Canvas>
  );
});

/* ─── Mini calendar modal ───────────────────────────────── */

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const CalendarModal = React.memo(function CalendarModal({
  visible,
  onClose,
  selectedDate,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const colors = useColors();
  const themeMode = useThemeStore((s) => s.mode);
  const isDark = themeMode === 'dark';
  const styles = useMemo(() => createCalendarStyles(colors, isDark), [colors, isDark]);

  const selDate = new Date(selectedDate + 'T12:00:00');
  const [viewYear, setViewYear] = useState(selDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selDate.getMonth());
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });

  const cells = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    onSelect(TODAY_STR);
    onClose();
  }, [onSelect, onClose]);

  const onCardLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setCardSize({ w: width, h: height });
  }, []);

  const glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.50)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={50} tint="dark" style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.card} onLayout={onCardLayout}>
          {/* Glass blur */}
          <BlurView intensity={isDark ? 40 : 50} tint={isDark ? 'dark' : 'default'} style={styles.glassBlur} />

          {/* Skia border + corner glow */}
          {cardSize.w > 0 && (
            <GlassCornerGlow
              width={cardSize.w}
              height={cardSize.h}
              radius={GLASS_RADIUS}
              accentColor="#FFFFFF"
              borderColor={glassBorder}
            />
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Month header */}
            <View style={styles.monthRow}>
              <TouchableOpacity onPress={prevMonth} hitSlop={12}>
                <Ionicons name="chevron-back" size={ms(18)} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.monthText}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={12}>
                <Ionicons name="chevron-forward" size={ms(18)} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {DAY_HEADERS.map((d, i) => (
                <Text key={i} style={styles.dayHeaderText}>{d}</Text>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.grid}>
              {cells.map((day, i) => {
                if (day === null) return <View key={i} style={styles.cell} />;
                const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = ds === selectedDate;
                const isToday = ds === TODAY_STR;
                const isFuture = ds > TODAY_STR;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.cell}
                    onPress={() => { if (!isFuture) { onSelect(ds); onClose(); } }}
                    activeOpacity={isFuture ? 0.3 : 0.6}
                  >
                    <View style={[styles.cellCircle, isSelected && styles.cellCircleSelected]}>
                      <Text style={[
                        styles.cellText,
                        isSelected && styles.cellTextSelected,
                        isToday && !isSelected && styles.cellTextToday,
                        isFuture && styles.cellTextFuture,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Today shortcut */}
            {selectedDate !== TODAY_STR && (
              <TouchableOpacity onPress={goToday} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>Go to Today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
});

/* ─── Header ────────────────────────────────────────────── */

interface HeaderProps {
  activeTab?: string;
}

export default function Header({ activeTab }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const email = useAuthStore((s) => s.profile?.email ?? '');
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const selectedDate = useFoodLogStore((s) => s.selectedDate);
  const setDate = useFoodLogStore((s) => s.setDate);

  const isWorkouts = activeTab === 'Workouts';
  const showDateNav = activeTab === 'Nutrition';
  const showStreak = true;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const openCal = useCallback(() => setCalendarOpen(true), []);
  const closeCal = useCallback(() => setCalendarOpen(false), []);

  const dateLabel = formatDateChip(selectedDate);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Greeting + name — left */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.greetingName}>
            {(username || 'there').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Date label */}
        {showDateNav && (
          <TouchableOpacity onPress={openCal} activeOpacity={0.7}>
            <Text style={styles.dateChipText}>{dateLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Streak + Avatar — right */}
        {showStreak && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={ms(13)} color={colors.streak} />
            <Text style={styles.streakText}>{currentStreak}</Text>
          </View>
        )}
        <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.7}>
          <View style={styles.avatarRing}>
            <AvatarCircle
              username={username}
              email={email}
              size={sw(28)}
              bgColor={colors.accent}
            />
          </View>
        </TouchableOpacity>
      </View>

      {showDateNav && (
        <CalendarModal
          visible={calendarOpen}
          onClose={closeCal}
          selectedDate={selectedDate}
          onSelect={setDate}
        />
      )}
    </View>
  );
}

/* ─── Header styles ─────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.navBar,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.cardBorder,
    zIndex: 10,
    paddingHorizontal: sw(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sw(4),
    gap: sw(12),
  },
  spacer: {
    flex: 1,
  },
  greetingBlock: {
    justifyContent: 'center',
  },
  greeting: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
  greetingName: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    backgroundColor: colors.streak + '18',
    paddingHorizontal: sw(8),
    paddingVertical: sw(4),
    borderRadius: sw(10),
  },
  streakText: {
    color: colors.streak,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  dateChipText: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.extraBold,
  },
  avatarRing: {
    borderWidth: 1.5,
    borderColor: colors.accent + '50',
    borderRadius: sw(16),
    padding: sw(1.5),
  },
});

/* ─── Calendar modal styles ─────────────────────────────── */

const createCalendarStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.35)',
    borderRadius: GLASS_RADIUS,
    width: sw(330),
    overflow: 'hidden',
  },
  glassBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: GLASS_RADIUS,
  },
  content: {
    paddingVertical: sw(20),
    paddingHorizontal: sw(18),
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(16),
  },
  monthText: {
    color: '#FFFFFF',
    fontSize: ms(18),
    fontFamily: Fonts.bold,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: sw(8),
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCircle: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cellText: {
    color: '#FFFFFF',
    fontSize: ms(13),
    fontFamily: Fonts.medium,
  },
  cellTextSelected: {
    color: '#FFFFFF',
    fontFamily: Fonts.bold,
  },
  cellTextToday: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  cellTextFuture: {
    color: 'rgba(255,255,255,0.2)',
  },
  todayBtn: {
    alignSelf: 'center',
    marginTop: sw(12),
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: sw(16),
    paddingVertical: sw(8),
    borderRadius: sw(10),
  },
  todayBtnText: {
    color: '#FFFFFF',
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
});
