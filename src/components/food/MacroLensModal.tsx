import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import type { FoodDetailData } from './FoodDetailModal';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onFoodFound: (food: FoodDetailData) => void;
}

type Mode = 'camera' | 'context' | 'analyzing' | 'results' | 'empty' | 'error';

const MAX_CONTEXT_CHARS = 300;

interface ScanItem {
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  serving_size: number;
  serving_unit: string;
  vitamin_a: number | null; vitamin_c: number | null;
  vitamin_d: number | null; vitamin_e: number | null;
  vitamin_k: number | null; vitamin_b6: number | null;
  vitamin_b12: number | null; folate: number | null;
  calcium: number | null; iron: number | null;
  magnesium: number | null; potassium: number | null;
  zinc: number | null; sodium: number | null;
}

const STATUS_PHRASES = [
  'Identifying food...',
  'Estimating portion...',
  'Calculating macros...',
];

const SCAN_BOX = sw(240);

export default function MacroLensModal({ visible, onDismiss, onFoodFound }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [torch, setTorch] = useState(false);

  const [mode, setMode] = useState<Mode>('camera');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [errorText, setErrorText] = useState<string>('');
  const [pendingScan, setPendingScan] = useState<{ base64: string; mime: string } | null>(null);
  const [contextText, setContextText] = useState<string>('');

  /* ── Animations ────────────────────────────────────────── */
  const reticlePulse = useSharedValue(1);
  const reticleOpacity = useSharedValue(0.7);
  const sparkleRotate = useSharedValue(0);
  const shutterScale = useSharedValue(1);
  const [statusIdx, setStatusIdx] = useState(0);

  // Reticle pulse loop while in camera mode
  useEffect(() => {
    if (mode === 'camera') {
      reticlePulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
      reticleOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400 }),
          withTiming(0.65, { duration: 1400 }),
        ),
        -1,
        false,
      );
    }
  }, [mode, reticlePulse, reticleOpacity]);

  // Sparkle rotates while analyzing
  useEffect(() => {
    if (mode === 'analyzing') {
      sparkleRotate.value = 0;
      sparkleRotate.value = withRepeat(
        withTiming(360, { duration: 2200, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [mode, sparkleRotate]);

  // Cycle status phrases while analyzing
  useEffect(() => {
    if (mode !== 'analyzing') return;
    setStatusIdx(0);
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_PHRASES.length);
    }, 1600);
    return () => clearInterval(id);
  }, [mode]);

  const reticleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reticlePulse.value }],
    opacity: reticleOpacity.value,
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sparkleRotate.value}deg` }],
  }));

  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const resetToCamera = useCallback(() => {
    setMode('camera');
    setPreviewUri(null);
    setItems([]);
    setErrorText('');
    setTorch(false);
    setPendingScan(null);
    setContextText('');
  }, []);

  const handleClose = useCallback(() => {
    resetToCamera();
    onDismiss();
  }, [onDismiss, resetToCamera]);

  const analyze = useCallback(async (base64: string, mimeType: string, context?: string) => {
    setMode('analyzing');
    setItems([]);
    setErrorText('');
    const trimmedContext = (context ?? '').trim().slice(0, MAX_CONTEXT_CHARS);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session?.access_token) {
        setErrorText('Not signed in.');
        setMode('error');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch(`${supabaseUrl}/functions/v1/gemini-food-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          image: base64,
          mime_type: mimeType,
          ...(trimmedContext ? { context: trimmedContext } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.log('[MacroLens] HTTP', res.status, errText.slice(0, 200));
        setErrorText("Couldn't analyze that photo. Try again.");
        setMode('error');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      const payload = await res.json();
      const raw: any[] = Array.isArray(payload?.items) ? payload.items : [];
      const mapped: ScanItem[] = raw.map((r) => ({
        name: typeof r?.name === 'string' ? r.name : 'Unknown',
        brand: r?.brand || null,
        calories: Number(r?.calories) || 0,
        protein: Number(r?.protein) || 0,
        carbs: Number(r?.carbs) || 0,
        fat: Number(r?.fat) || 0,
        fiber: r?.fiber != null ? Number(r.fiber) : null,
        sugar: r?.sugar != null ? Number(r.sugar) : null,
        serving_size: Number(r?.serving_size) || 100,
        serving_unit: typeof r?.serving_unit === 'string' ? r.serving_unit : 'g',
        vitamin_a: r?.vitamin_a ?? null, vitamin_c: r?.vitamin_c ?? null,
        vitamin_d: r?.vitamin_d ?? null, vitamin_e: r?.vitamin_e ?? null,
        vitamin_k: r?.vitamin_k ?? null, vitamin_b6: r?.vitamin_b6 ?? null,
        vitamin_b12: r?.vitamin_b12 ?? null, folate: r?.folate ?? null,
        calcium: r?.calcium ?? null, iron: r?.iron ?? null,
        magnesium: r?.magnesium ?? null, potassium: r?.potassium ?? null,
        zinc: r?.zinc ?? null, sodium: r?.sodium ?? null,
      }));

      if (mapped.length === 0) {
        setMode('empty');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }
      setItems(mapped);
      setMode('results');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.log('[MacroLens] error:', err?.message || err);
      setErrorText("Couldn't analyze that photo. Try again.");
      setMode('error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, []);

  const handleShutter = useCallback(async () => {
    if (!cameraRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    shutterScale.value = withSequence(
      withTiming(0.88, { duration: 90 }),
      withTiming(1, { duration: 140 }),
    );
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
        skipProcessing: false,
        imageType: 'jpg',
      });
      if (!photo?.base64 || !photo?.uri) {
        setErrorText("Couldn't capture photo.");
        setMode('error');
        return;
      }
      setPreviewUri(photo.uri);
      setPendingScan({ base64: photo.base64, mime: 'image/jpeg' });
      setContextText('');
      setMode('context');
    } catch (err: any) {
      console.log('[MacroLens] capture error:', err?.message || err);
      setErrorText("Couldn't capture photo.");
      setMode('error');
    }
  }, [shutterScale]);

  const handlePickFromGallery = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.5,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.base64 || !asset.uri) {
        setErrorText("Couldn't load that image.");
        setMode('error');
        return;
      }
      setPreviewUri(asset.uri);
      const lower = asset.uri.toLowerCase();
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.heic')
            ? 'image/heic'
            : 'image/jpeg';
      setPendingScan({ base64: asset.base64, mime });
      setContextText('');
      setMode('context');
    } catch (err: any) {
      console.log('[MacroLens] gallery error:', err?.message || err);
    }
  }, []);

  const handleScanWithContext = useCallback(() => {
    if (!pendingScan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    analyze(pendingScan.base64, pendingScan.mime, contextText);
  }, [analyze, pendingScan, contextText]);

  const handleRetake = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    resetToCamera();
  }, [resetToCamera]);

  const handlePickItem = useCallback((item: ScanItem) => {
    Haptics.selectionAsync().catch(() => {});
    const food: FoodDetailData = {
      name: item.name,
      brand: item.brand,
      food_catalog_id: null,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      serving_size: item.serving_size,
      serving_unit: item.serving_unit,
      confidence: 'ai_estimated',
      serving_size_estimated: true,
      vitamin_a: item.vitamin_a, vitamin_c: item.vitamin_c,
      vitamin_d: item.vitamin_d, vitamin_e: item.vitamin_e,
      vitamin_k: item.vitamin_k, vitamin_b6: item.vitamin_b6,
      vitamin_b12: item.vitamin_b12, folate: item.folate,
      calcium: item.calcium, iron: item.iron,
      magnesium: item.magnesium, potassium: item.potassium,
      zinc: item.zinc, sodium: item.sodium,
    };
    onFoodFound(food);
    resetToCamera();
  }, [onFoodFound, resetToCamera]);

  /* ── Totals for hero card ──────────────────────────────── */
  const totals = useMemo(() => {
    return items.reduce(
      (acc, it) => ({
        calories: acc.calories + (it.calories || 0),
        protein: acc.protein + (it.protein || 0),
        carbs: acc.carbs + (it.carbs || 0),
        fat: acc.fat + (it.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [items]);

  if (!visible) return null;

  /* ── Permission gate ───────────────────────────────────── */
  if (!permission) {
    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.container} />
      </Modal>
    );
  }

  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <View style={styles.permIcon}>
              <Ionicons name="camera-outline" size={ms(36)} color={colors.accent} />
            </View>
            <Text style={styles.permTitle}>Enable Camera</Text>
            <Text style={styles.permBody}>
              {canAsk
                ? 'Allow camera access so MacroLens can scan your meals.'
                : 'Camera permission was denied. Enable it in your device settings.'}
            </Text>
            <TouchableOpacity
              style={styles.permBtn}
              onPress={canAsk ? requestPermission : () => Linking.openSettings()}
              activeOpacity={0.85}
            >
              <Text style={styles.permBtnText}>
                {canAsk ? 'Allow Camera' : 'Open Settings'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.topBtn, styles.permClose]}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={ms(22)} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  /* ── Main render ───────────────────────────────────────── */
  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.container}>
        {mode === 'camera' ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
          />
        ) : previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : null}

        {/* Blur during analyzing */}
        {mode === 'analyzing' && (
          <BlurView
            intensity={Platform.OS === 'ios' ? 40 : 80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        )}
        {(mode === 'empty' || mode === 'error' || mode === 'context') && (
          <View style={styles.dimOverlay} pointerEvents="none" />
        )}

        {/* Top gradient — only on camera + analyzing for legibility */}
        {(mode === 'camera' || mode === 'analyzing') && (
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
            style={styles.topGradient}
            pointerEvents="none"
          />
        )}

        <View style={styles.overlay} pointerEvents="box-none">
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleClose} style={styles.topBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={ms(22)} color="#FFF" />
            </TouchableOpacity>
            {mode === 'camera' && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.titlePill}>
                <Ionicons name="aperture" size={ms(12)} color="#FFF" />
                <Text style={styles.titlePillText}>MacroLens</Text>
              </Animated.View>
            )}
            {mode === 'camera' ? (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTorch((t) => !t);
                }}
                style={[styles.topBtn, torch && styles.topBtnActive]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={torch ? 'flash' : 'flash-outline'}
                  size={ms(20)}
                  color={torch ? '#000' : '#FFF'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.topBtnPlaceholder} />
            )}
          </View>

          {/* Center */}
          <View style={styles.centerArea} pointerEvents="box-none">
            {mode === 'camera' && (
              <Animated.View style={[styles.scanFrame, reticleStyle]}>
                <Corner placement="tl" color={colors.accent} />
                <Corner placement="tr" color={colors.accent} />
                <Corner placement="bl" color={colors.accent} />
                <Corner placement="br" color={colors.accent} />
                <View style={styles.scanFrameInner}>
                  <View style={[styles.scanCenterDot, { backgroundColor: colors.accent }]} />
                </View>
              </Animated.View>
            )}
            {mode === 'analyzing' && (
              <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.analyzeWrap}
              >
                <View style={styles.analyzeIconRing}>
                  <Animated.View style={sparkleStyle}>
                    <Ionicons name="aperture" size={ms(30)} color="#FFF" />
                  </Animated.View>
                </View>
                <Animated.Text
                  key={statusIdx}
                  entering={FadeIn.duration(280)}
                  exiting={FadeOut.duration(220)}
                  style={styles.analyzeText}
                >
                  {STATUS_PHRASES[statusIdx]}
                </Animated.Text>
                <View style={styles.dotRow}>
                  {[0, 1, 2].map((i) => (
                    <PulsingDot key={i} delay={i * 180} />
                  ))}
                </View>
              </Animated.View>
            )}
            {mode === 'empty' && (
              <Animated.View entering={FadeIn} style={styles.analyzeWrap}>
                <View style={styles.analyzeIconRing}>
                  <Ionicons name="restaurant-outline" size={ms(28)} color="#FFF" />
                </View>
                <Text style={styles.analyzeText}>No food detected</Text>
                <Text style={styles.analyzeSubText}>Try again with a clearer shot.</Text>
              </Animated.View>
            )}
            {mode === 'error' && (
              <Animated.View entering={FadeIn} style={styles.analyzeWrap}>
                <View style={styles.analyzeIconRing}>
                  <Ionicons name="alert-circle-outline" size={ms(28)} color="#FFF" />
                </View>
                <Text style={styles.analyzeText}>{errorText || 'Something went wrong.'}</Text>
              </Animated.View>
            )}
          </View>

          {/* Bottom controls — only on camera */}
          {mode === 'camera' && (
            <>
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
                style={styles.bottomGradient}
                pointerEvents="none"
              />
              <View style={styles.bottomBar}>
                <TouchableOpacity
                  onPress={handlePickFromGallery}
                  style={styles.galleryBtn}
                  activeOpacity={0.75}
                >
                  <Ionicons name="images-outline" size={ms(22)} color="#FFF" />
                </TouchableOpacity>
                <Animated.View style={shutterStyle}>
                  <TouchableOpacity
                    onPress={handleShutter}
                    style={styles.shutterOuter}
                    activeOpacity={0.9}
                  >
                    <View style={styles.shutterMid}>
                      <View style={[styles.shutterInner, { backgroundColor: colors.accent }]}>
                        <Ionicons name="aperture" size={ms(22)} color="#FFF" />
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
                <View style={styles.galleryBtn} />
              </View>
              <Text style={styles.frameHint}>Frame your meal · tap to scan</Text>
            </>
          )}

          {mode === 'context' && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}
              style={styles.contextKav}
              pointerEvents="box-none"
            >
              <Animated.View
                entering={FadeInDown.springify().damping(20)}
                style={styles.contextSheet}
              >
                <View style={styles.sheetGrabber} />
                <View style={styles.contextHeader}>
                  <View style={styles.contextTitleRow}>
                    <Ionicons name="sparkles" size={ms(14)} color={colors.accent} />
                    <Text style={styles.contextTitle}>Add context</Text>
                    <Text style={styles.contextOptional}>Optional</Text>
                  </View>
                  <Text style={styles.contextSubtitle}>
                    Tell the AI what's in the photo for a more accurate scan.
                  </Text>
                </View>

                <View style={styles.contextInputWrap}>
                  <TextInput
                    style={styles.contextInput}
                    value={contextText}
                    onChangeText={(v) => setContextText(v.slice(0, MAX_CONTEXT_CHARS))}
                    placeholder={'e.g. "from McDonald\'s", "1 cup brown rice", "cooked in butter"'}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    maxLength={MAX_CONTEXT_CHARS}
                    blurOnSubmit
                    returnKeyType="done"
                  />
                  <Text style={styles.contextCount}>
                    {contextText.length} / {MAX_CONTEXT_CHARS}
                  </Text>
                </View>

                <View style={styles.contextBtnRow}>
                  <TouchableOpacity
                    onPress={handleRetake}
                    style={styles.contextRetakeBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={ms(15)} color={colors.textPrimary} />
                    <Text style={styles.contextRetakeText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleScanWithContext}
                    style={styles.contextScanBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="aperture" size={ms(15)} color={colors.textOnAccent} />
                    <Text style={styles.contextScanText}>
                      {contextText.trim() ? 'Scan with context' : 'Scan'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          )}

          {(mode === 'empty' || mode === 'error') && (
            <View style={styles.bottomBarSimple}>
              <TouchableOpacity
                onPress={resetToCamera}
                style={styles.retakeBtnLarge}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={ms(16)} color={colors.textOnAccent} />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'results' && (
            <Animated.View
              entering={FadeInDown.springify().damping(18)}
              style={styles.resultsSheet}
            >
              <View style={styles.sheetGrabber} />

              {/* Header row */}
              <View style={styles.resultsHeader}>
                <View style={styles.brandBadge}>
                  <Ionicons name="aperture" size={ms(11)} color={colors.textOnAccent} />
                  <Text style={styles.brandBadgeText}>MacroLens</Text>
                </View>
                <TouchableOpacity onPress={resetToCamera} hitSlop={8} style={styles.retakeChip}>
                  <Ionicons name="refresh" size={ms(12)} color={colors.textSecondary} />
                  <Text style={styles.retakeChipText}>Retake</Text>
                </TouchableOpacity>
              </View>

              {/* Hero — total calories + macro bars */}
              <Animated.View
                entering={FadeInDown.delay(80).springify().damping(20)}
                style={styles.heroCard}
              >
                <View style={styles.heroTop}>
                  <View style={styles.heroLabelWrap}>
                    <Text style={styles.heroLabel}>Total estimated</Text>
                    <Text style={styles.heroItemCount}>
                      {items.length} {items.length === 1 ? 'item' : 'items'} detected
                    </Text>
                  </View>
                  <View style={styles.heroCalWrap}>
                    <Text style={styles.heroCalNumber}>{Math.round(totals.calories)}</Text>
                    <Text style={styles.heroCalUnit}>kcal</Text>
                  </View>
                </View>
                <View style={styles.macroRow}>
                  <MacroPill label="Protein" value={totals.protein} color={colors.protein} />
                  <MacroPill label="Carbs" value={totals.carbs} color={colors.carbs} />
                  <MacroPill label="Fat" value={totals.fat} color={colors.fat} />
                </View>
              </Animated.View>

              <Text style={styles.itemsHint}>Tap an item to log it</Text>

              <ScrollView
                style={styles.resultsList}
                contentContainerStyle={styles.resultsListContent}
                showsVerticalScrollIndicator={false}
              >
                {items.map((it, i) => (
                  <Animated.View
                    key={`${it.name}-${i}`}
                    entering={FadeInDown.delay(140 + i * 60).springify().damping(20)}
                  >
                    <TouchableOpacity
                      style={styles.itemCard}
                      onPress={() => handlePickItem(it)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.itemThumb}>
                        <Ionicons name="restaurant" size={ms(16)} color={colors.accent} />
                      </View>
                      <View style={styles.itemBody}>
                        <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                        {it.brand ? (
                          <Text style={styles.itemBrand} numberOfLines={1}>{it.brand}</Text>
                        ) : (
                          <Text style={styles.itemServing}>{it.serving_size}{it.serving_unit}</Text>
                        )}
                        <View style={styles.itemMacros}>
                          <MacroDot value={Math.round(it.protein)} label="P" color={colors.protein} />
                          <MacroDot value={Math.round(it.carbs)} label="C" color={colors.carbs} />
                          <MacroDot value={Math.round(it.fat)} label="F" color={colors.fat} />
                        </View>
                      </View>
                      <View style={styles.itemRight}>
                        <Text style={styles.itemCal}>{Math.round(it.calories)}</Text>
                        <Text style={styles.itemCalUnit}>kcal</Text>
                        <View style={styles.itemChevWrap}>
                          <Ionicons name="chevron-forward" size={ms(13)} color={colors.textTertiary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

const Corner = React.memo(function Corner({
  placement,
  color,
}: {
  placement: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const base = {
    position: 'absolute' as const,
    width: sw(28),
    height: sw(28),
    borderColor: color,
  };
  if (placement === 'tl') {
    return (
      <View
        style={[
          base,
          { top: 0, left: 0, borderTopWidth: sw(3), borderLeftWidth: sw(3), borderTopLeftRadius: sw(8) },
        ]}
      />
    );
  }
  if (placement === 'tr') {
    return (
      <View
        style={[
          base,
          { top: 0, right: 0, borderTopWidth: sw(3), borderRightWidth: sw(3), borderTopRightRadius: sw(8) },
        ]}
      />
    );
  }
  if (placement === 'bl') {
    return (
      <View
        style={[
          base,
          { bottom: 0, left: 0, borderBottomWidth: sw(3), borderLeftWidth: sw(3), borderBottomLeftRadius: sw(8) },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        base,
        { bottom: 0, right: 0, borderBottomWidth: sw(3), borderRightWidth: sw(3), borderBottomRightRadius: sw(8) },
      ]}
    />
  );
});

const PulsingDot = React.memo(function PulsingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[dotStyles.dot, style]} />;
});

const dotStyles = StyleSheet.create({
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
    backgroundColor: '#FFF',
  },
});

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[macroPillStyles.wrap, { backgroundColor: color + '14', borderColor: color + '33' }]}>
      <View style={[macroPillStyles.dot, { backgroundColor: color }]} />
      <View>
        <Text style={[macroPillStyles.value, { color }]}>{Math.round(value)}g</Text>
        <Text style={macroPillStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const macroPillStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(7),
    paddingHorizontal: sw(10),
    paddingVertical: sw(8),
    borderRadius: sw(10),
    borderWidth: 1,
  },
  dot: {
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
  },
  value: {
    fontSize: ms(13),
    lineHeight: ms(16),
    fontFamily: Fonts.extraBold,
  },
  label: {
    color: '#888',
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

function MacroDot({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={macroDotStyles.wrap}>
      <View style={[macroDotStyles.dot, { backgroundColor: color }]} />
      <Text style={[macroDotStyles.text, { color }]}>{value}{label}</Text>
    </View>
  );
}

const macroDotStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  text: {
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.bold,
  },
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    dimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },
    topGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: sw(140),
    },
    bottomGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: sw(220),
    },

    /* Top bar */
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: sw(54),
      paddingHorizontal: sw(16),
    },
    topBtn: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(20),
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBtnActive: {
      backgroundColor: '#FFF',
      borderColor: '#FFF',
    },
    topBtnPlaceholder: {
      width: sw(40),
      height: sw(40),
    },
    titlePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: sw(11),
      paddingVertical: sw(6),
      borderRadius: sw(14),
    },
    titlePillText: {
      color: '#FFF',
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
    },

    /* Center */
    centerArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sw(28),
    },
    scanFrame: {
      width: SCAN_BOX,
      height: SCAN_BOX,
    },
    scanFrameInner: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanCenterDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
      opacity: 0.6,
    },

    /* Analyze */
    analyzeWrap: {
      alignItems: 'center',
      gap: sw(14),
    },
    analyzeIconRing: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(36),
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    analyzeText: {
      color: '#FFF',
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    analyzeSubText: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    dotRow: {
      flexDirection: 'row',
      gap: sw(6),
      marginTop: sw(2),
    },

    /* Bottom */
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(28),
      paddingBottom: sw(8),
    },
    bottomBarSimple: {
      alignItems: 'center',
      paddingBottom: sw(48),
    },
    galleryBtn: {
      width: sw(48),
      height: sw(48),
      borderRadius: sw(24),
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterOuter: {
      width: sw(86),
      height: sw(86),
      borderRadius: sw(43),
      borderWidth: sw(3),
      borderColor: 'rgba(255,255,255,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterMid: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(36),
      backgroundColor: '#FFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: sw(58),
      height: sw(58),
      borderRadius: sw(29),
      alignItems: 'center',
      justifyContent: 'center',
    },
    frameHint: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      textAlign: 'center',
      paddingBottom: sw(40),
      paddingTop: sw(10),
      letterSpacing: 0.3,
    },
    retakeBtnLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(7),
      backgroundColor: colors.accent,
      paddingHorizontal: sw(28),
      paddingVertical: sw(13),
      borderRadius: sw(26),
    },
    retakeText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },

    /* Context sheet */
    contextKav: {
      width: '100%',
    },
    contextSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sw(24),
      borderTopRightRadius: sw(24),
      paddingTop: sw(8),
      paddingBottom: sw(28),
      paddingHorizontal: sw(18),
    },
    contextHeader: {
      gap: sw(4),
      marginTop: sw(4),
      marginBottom: sw(12),
    },
    contextTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    contextTitle: {
      color: colors.textPrimary,
      fontSize: ms(17),
      lineHeight: ms(22),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    contextOptional: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      marginLeft: sw(4),
    },
    contextSubtitle: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    contextInputWrap: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: sw(14),
      paddingHorizontal: sw(12),
      paddingTop: sw(10),
      paddingBottom: sw(8),
      marginBottom: sw(12),
    },
    contextInput: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      minHeight: sw(60),
      maxHeight: sw(110),
      textAlignVertical: 'top',
      padding: 0,
    },
    contextCount: {
      alignSelf: 'flex-end',
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
      marginTop: sw(4),
    },
    contextBtnRow: {
      flexDirection: 'row',
      gap: sw(10),
    },
    contextRetakeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      paddingHorizontal: sw(18),
      paddingVertical: sw(13),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    contextRetakeText: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.bold,
    },
    contextScanBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(7),
      paddingVertical: sw(13),
      borderRadius: sw(14),
      backgroundColor: colors.accent,
    },
    contextScanText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
      letterSpacing: -0.1,
    },

    /* Results sheet */
    resultsSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: sw(24),
      borderTopRightRadius: sw(24),
      paddingTop: sw(8),
      paddingBottom: sw(28),
      maxHeight: '78%',
    },
    sheetGrabber: {
      alignSelf: 'center',
      width: sw(36),
      height: sw(4),
      borderRadius: sw(2),
      backgroundColor: colors.textTertiary + '50',
      marginBottom: sw(10),
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(14),
      marginBottom: sw(10),
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      backgroundColor: colors.accent,
      paddingHorizontal: sw(9),
      paddingVertical: sw(4),
      borderRadius: sw(11),
    },
    brandBadgeText: {
      color: colors.textOnAccent,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
    },
    retakeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(10),
      paddingVertical: sw(5),
      borderRadius: sw(11),
    },
    retakeChipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
    },

    /* Hero */
    heroCard: {
      marginHorizontal: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: sw(16),
      padding: sw(14),
      gap: sw(12),
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    heroLabelWrap: {
      gap: sw(2),
    },
    heroLabel: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    heroItemCount: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    heroCalWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: sw(4),
    },
    heroCalNumber: {
      color: colors.textPrimary,
      fontSize: ms(34),
      lineHeight: ms(38),
      fontFamily: Fonts.extraBold,
      letterSpacing: -1,
    },
    heroCalUnit: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.bold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    macroRow: {
      flexDirection: 'row',
      gap: sw(8),
    },

    itemsHint: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      paddingHorizontal: sw(18),
      paddingTop: sw(12),
      paddingBottom: sw(6),
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },

    /* Items list */
    resultsList: {
      flexGrow: 0,
    },
    resultsListContent: {
      paddingHorizontal: sw(14),
      paddingBottom: sw(8),
      gap: sw(8),
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: sw(14),
      padding: sw(12),
      gap: sw(10),
    },
    itemThumb: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(10),
      backgroundColor: colors.accent + '14',
      borderWidth: 1,
      borderColor: colors.accent + '30',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBody: { flex: 1, gap: sw(2) },
    itemName: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.bold,
      letterSpacing: -0.1,
    },
    itemBrand: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    itemServing: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.medium,
    },
    itemMacros: {
      flexDirection: 'row',
      gap: sw(10),
      marginTop: sw(3),
    },
    itemRight: {
      alignItems: 'flex-end',
      minWidth: sw(48),
    },
    itemCal: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(20),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.3,
    },
    itemCalUnit: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(10),
      fontFamily: Fonts.bold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    itemChevWrap: {
      marginTop: sw(2),
    },

    /* Permission */
    permissionContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sw(32),
      gap: sw(14),
    },
    permIcon: {
      width: sw(72),
      height: sw(72),
      borderRadius: sw(36),
      backgroundColor: colors.accent + '14',
      borderWidth: 1,
      borderColor: colors.accent + '30',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: sw(4),
    },
    permTitle: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(24),
      fontFamily: Fonts.extraBold,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    permBody: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    permBtn: {
      backgroundColor: colors.accent,
      borderRadius: sw(14),
      paddingHorizontal: sw(28),
      paddingVertical: sw(14),
      marginTop: sw(8),
    },
    permBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
    },
    permClose: {
      position: 'absolute',
      top: sw(54),
      left: sw(16),
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
    },
  });
