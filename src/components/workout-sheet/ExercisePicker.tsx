import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Overlay from '../ui/Overlay';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { scoreWithAliases } from './exerciseSearch';
import { useAuthStore } from '../../stores/useAuthStore';
import CreateCustomExerciseModal from './CreateCustomExerciseModal';
import { PortalHost } from '../ui/Portal';
import {
  getCachedSorted, getMainGroup, buildDefaultSections, type CatalogEntry,
} from './exercise-picker/pickerData';
import { useWgerSearch } from './exercise-picker/useWgerSearch';
import { createPickerStyles, SCREEN_H, SHEET_H } from './exercise-picker/pickerStyles';
import ExerciseRow, { createRowStyles } from './exercise-picker/ExerciseRow';
import MuscleFilterChips from './exercise-picker/MuscleFilterChips';
import ExerciseListHeader from './exercise-picker/ExerciseListHeader';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { FlashList } from '@shopify/flash-list';

/* ─── Constants ───────────────────────────────────────── */

const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.6;
const SEARCH_DEBOUNCE_MS = 150;
/** Delay before mounting heavy list content (ms).
 *  Lets the spring animation run uncontested on the UI thread. */
const CONTENT_DEFER_MS = 180;

const SNAP_SPRING = { damping: 24, stiffness: 350, mass: 0.7 };
const CLOSE_CFG = { duration: 250, easing: Easing.in(Easing.cubic) };

/* ═══════════════════════════════════════════════════════════
   ExercisePicker
   ─────────────────────────────────────────────────────────
   Architecture for FPS:
   1. Module-level cache: sorted entries + muscles survive
      unmount/remount — zero-cost on re-open.
   2. Deferred content mount: the heavy FlashList
      mounts AFTER the spring animation is mostly done
      (CONTENT_DEFER_MS delay), keeping the UI thread free
      for smooth 120fps animation.
   3. The sheet is moved by a Reanimated translateY driven by a
      Gesture Handler pan, inside an Overlay (not an RN Modal
      animation).
   4. GPU rasterization hint on the animated sheet view.
   ═══════════════════════════════════════════════════════════ */

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, exerciseType: string, category: string | null) => void;
  mode?: 'add' | 'replace';
}

export default function ExercisePicker({ visible, onClose, onSelect, mode = 'add' }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createPickerStyles(colors), [colors]);
  const rowStyles = useMemo(() => createRowStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const aliasMap = useWorkoutStore((s) => s.aliasMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const createUserExercise = useWorkoutStore((s) => s.createUserExercise);
  const userId = useAuthStore((s) => s.user?.id);

  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [alive, setAlive] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reloading, setReloading] = useState(false);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const { apiResults, apiSearching, showApiResults, searchApi, clearApiResults } = useWgerSearch(search, debouncedSearch);

  /* ─── Refs ──────────────────────────────────────────── */

  const translateY = useSharedValue(SHEET_H);
  const ctx = useSharedValue(0);
  const openRef = useRef(false);
  const gestureClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Animation helpers ─────────────────────────────── */

  const cleanup = useCallback(() => {
    setAlive(false);
    setContentReady(false);
    setSearch('');
    setSelectedMuscle(null);
    clearApiResults();
  }, [clearApiResults]);

  /* ─── Open / close lifecycle ────────────────────────── */

  useEffect(() => {
    if (visible) {
      openRef.current = true;
      gestureClosingRef.current = false;
      setAlive(true);
      setContentReady(false);
      cancelAnimation(translateY);
      // Start at position 0 instantly — no spring animation, avoids stutter on Modal mount
      translateY.value = 0;
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
      contentTimerRef.current = setTimeout(() => setContentReady(true), CONTENT_DEFER_MS);
    } else if (openRef.current) {
      openRef.current = false;
      if (contentTimerRef.current) { clearTimeout(contentTimerRef.current); contentTimerRef.current = null; }
      if (!gestureClosingRef.current) {
        Keyboard.dismiss();
        cancelAnimation(translateY);
        translateY.value = withTiming(SHEET_H, CLOSE_CFG, (finished) => {
          if (finished) runOnJS(cleanup)();
        });
      }
      gestureClosingRef.current = false;
    }
  }, [visible]);

  useEffect(() => () => {
    cancelAnimation(translateY);
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
  }, []);

  /* ─── Animated styles (UI thread) ───────────────────── */

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateY.value / SHEET_H;
    return { opacity: Math.max(0, Math.min(BACKDROP_MAX, progress * BACKDROP_MAX)) };
  });

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: Math.max(0, translateY.value) }] };
  });

  /* ─── Gesture (UI thread) ───────────────────────────── */

  const handleDismiss = useCallback(() => {
    gestureClosingRef.current = true;
    Keyboard.dismiss();
    onCloseRef.current();
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => {
          ctx.value = translateY.value;
        })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (
            e.translationY > DISMISS_THRESHOLD ||
            e.velocityY > VELOCITY_THRESHOLD
          ) {
            translateY.value = withSpring(
              SHEET_H,
              {
                velocity: e.velocityY,
                damping: 50,
                stiffness: 300,
                mass: 0.8,
                overshootClamping: true,
              },
              (finished) => {
                if (finished) runOnJS(cleanup)();
              },
            );
            runOnJS(handleDismiss)();
          } else {
            translateY.value = withSpring(0, SNAP_SPRING);
          }
        }),
    [handleDismiss, cleanup],
  );

  /* ─── Data (uses module-level cache) ────────────────── */

  // Base sorted list from cache — O(1) when catalog hasn't changed
  const baseSorted = getCachedSorted(catalogMap, aliasMap, prevMap);

  // Muscle filter — maps granular muscles to main groups
  const sortedEntries = useMemo(() => {
    if (!selectedMuscle) return baseSorted;
    return baseSorted.filter((e) =>
      e.primary_muscles.some((m) => getMainGroup(m) === selectedMuscle),
    );
  }, [baseSorted, selectedMuscle]);

  const localExercises = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return sortedEntries;

    // Score every entry, but copy only the matches (most of a 10K catalog scores 0)
    const scored: (CatalogEntry & { score: number })[] = [];
    for (const e of sortedEntries) {
      const score = scoreWithAliases(e, e.aliases || [], q) + (e.done ? 10 : 0);
      if (score > 0) scored.push({ ...e, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [sortedEntries, debouncedSearch]);

  const exercises = showApiResults ? apiResults : localExercises;

  const defaultSections = useMemo(() => {
    const visible = !debouncedSearch.trim() && !selectedMuscle && !showApiResults;
    return buildDefaultSections(visible, baseSorted, exercises, prevMap, aliasMap);
  }, [aliasMap, baseSorted, debouncedSearch, exercises, prevMap, selectedMuscle, showApiResults]);

  /* ─── Handlers ──────────────────────────────────────── */

  const handleReload = useCallback(async () => {
    if (!userId || reloading) return;
    setReloading(true);
    await fetchExerciseCatalog(userId, true);
    setReloading(false);
  }, [userId, reloading, fetchExerciseCatalog]);

  const handleSelect = useCallback(
    async (name: string, category: string, exerciseType: string) => {
      // If selected from API results, auto-save as user exercise with muscle data
      if (showApiResults && userId) {
        const apiEntry = apiResults.find((e) => e.name === name);
        if (apiEntry && !catalogMap[name]) {
          try {
            await createUserExercise({
              userId,
              name: apiEntry.name,
              category: apiEntry.category || 'Custom',
              exerciseType: apiEntry.exercise_type,
              primaryMuscles: apiEntry.primary_muscles,
              secondaryMuscles: apiEntry.secondary_muscles,
              equipment: [],
            });
          } catch {
            // Duplicate or error — still allow selection, catalog lookup will handle it
          }
        }
      }
      onSelect(name, exerciseType, category);
      setSearch('');
      onClose();
    },
    [onSelect, onClose, showApiResults, apiResults, userId, catalogMap, createUserExercise],
  );

  const handleOpenCreateModal = useCallback(() => {
    setCreateModalVisible(true);
  }, []);

  const handleCreateSubmit = useCallback(
    async (data: {
      name: string;
      category: string;
      exerciseType: string;
      primaryMuscles: string[];
      secondaryMuscles: string[];
      equipment: string[];
    }) => {
      if (userId) {
        try {
          await createUserExercise({
            userId,
            name: data.name,
            category: data.category,
            exerciseType: data.exerciseType,
            primaryMuscles: data.primaryMuscles,
            secondaryMuscles: data.secondaryMuscles,
            equipment: data.equipment,
          });
        } catch (err: any) {
          const msg = err?.message || 'Unknown error';
          const isDuplicate = msg.includes('unique') || msg.includes('duplicate');
          Alert.alert(
            isDuplicate ? 'Exercise Already Exists' : 'Failed to Create Exercise',
            isDuplicate
              ? 'An exercise with a similar name already exists.'
              : msg,
          );
          return;
        }
      }
      setCreateModalVisible(false);
      onSelect(data.name, data.exerciseType, data.category);
      setSearch('');
      onClose();
    },
    [userId, createUserExercise, onSelect, onClose],
  );

  /* ─── Render callbacks (memoized) ───────────────────── */

  const renderFlatItem = useCallback(
    ({ item }: { item: any }) => (
      <ExerciseRow
        name={item.name}
        category={item.category}
        exercise_type={item.exercise_type}
        primary_muscles={item.primary_muscles}
        onSelect={handleSelect}
        styles={rowStyles}
      />
    ),
    [handleSelect, rowStyles],
  );

  const keyExtractor = useCallback((item: any, index: number) => `${item.name}-${index}`, []);

  const listEmptyComponent = useMemo(
    () => (
      <View style={styles.emptySearch}>
        <Text style={styles.emptySearchText}>
          {showApiResults ? 'No online results found' : 'No exercises found'}
        </Text>
      </View>
    ),
    [styles, showApiResults],
  );

  const defaultListHeader = useMemo(
    () => <ExerciseListHeader defaultSections={defaultSections} handleSelect={handleSelect} rowStyles={rowStyles} />,
    [defaultSections, handleSelect, rowStyles],
  );

  /* ─── Render ────────────────────────────────────────── */

  if (!alive) return null;

  return (
    <Overlay visible animationType="none">
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <PortalHost>
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Backdrop */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          Keyboard.dismiss();
          onCloseRef.current();
        }}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      {/* Sheet — GPU rasterization during animation */}
      <Animated.View
        style={[styles.sheet, sheetStyle]}
        renderToHardwareTextureAndroid
      >
        <KeyboardAvoidingView
          style={styles.sheetInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? SCREEN_H * 0.2 : 0}
        >
          {/* Drag handle + header — always visible immediately */}
          <GestureDetector gesture={panGesture}>
            <Animated.View>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.title}>
                  {mode === 'replace' ? 'Replace Exercise' : 'Add Exercise'}
                </Text>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Search — always visible immediately (lightweight) */}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={ms(18)} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              autoFocus={false}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleReload}
              disabled={reloading}
              style={styles.reloadBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {reloading ? (
                <ActivityIndicator size={ms(18)} color={colors.accent} />
              ) : (
                <Ionicons name="refresh" size={ms(18)} color={colors.accent} />
              )}
            </TouchableOpacity>
          </View>

          {/* ── Content: always mounted to keep Fabric view tree stable ── */}
          <View style={{ flex: 1 }}>
            {/* Loading spinner — hidden once content is ready */}
            {!contentReady && (
              <View style={styles.deferredPlaceholder}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            )}

            {/* Muscle filter chips */}
            {contentReady && (
              <MuscleFilterChips selectedMuscle={selectedMuscle} setSelectedMuscle={setSelectedMuscle} />
            )}

            {/* Result count + Create */}
            {contentReady && (
              <View style={styles.subHeaderRow}>
                {showApiResults ? (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: sw(4) }}
                    onPress={clearApiResults}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-back" size={ms(14)} color={colors.accent} />
                    <Text style={[styles.resultCount, { color: colors.accent }]}>
                      Back to local · {apiResults.length} online result{apiResults.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                ) : search.trim().length > 0 || selectedMuscle ? (
                  <Text style={styles.resultCount}>
                    {exercises.length} result{exercises.length !== 1 ? 's' : ''}
                  </Text>
                ) : (
                  <View />
                )}
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleOpenCreateModal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={ms(16)} color={colors.accent} />
                  <Text style={styles.createBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Results */}
            {contentReady && (
              <FlashList
                data={defaultSections.regular}
                keyExtractor={keyExtractor}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={renderFlatItem}
                ListHeaderComponent={defaultListHeader}
                ListEmptyComponent={listEmptyComponent}
              />
            )}
          </View>

          {/* Floating deep search button */}
          {contentReady && debouncedSearch.trim().length > 0 && !showApiResults && (
            <TouchableOpacity
              style={styles.searchOnlineFloating}
              onPress={searchApi}
              activeOpacity={0.7}
              disabled={apiSearching}
            >
              {apiSearching ? (
                <ActivityIndicator size={ms(16)} color={colors.textOnAccent} />
              ) : (
                <Ionicons name="globe-outline" size={ms(16)} color={colors.textOnAccent} />
              )}
              <Text style={styles.searchOnlineFloatingText}>
                {apiSearching ? 'Searching...' : 'Deep Search'}
              </Text>
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </Animated.View>

      <CreateCustomExerciseModal
        visible={createModalVisible}
        initialName={search.trim()}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={handleCreateSubmit}
      />
    </View>
    </PortalHost>
    </GestureHandlerRootView>
    </Overlay>
  );
}
