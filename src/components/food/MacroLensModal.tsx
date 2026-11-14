import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import Overlay from '../ui/Overlay';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import type { FoodDetailData } from './FoodDetailModal';
import { MAX_CONTEXT_CHARS, STATUS_PHRASES, type Mode, type ScanItem } from './macro-lens/macroLensTypes';
import ScanReticle from './macro-lens/ScanReticle';
import AnalyzingView from './macro-lens/AnalyzingView';
import CameraControls from './macro-lens/CameraControls';
import ContextSheet from './macro-lens/ContextSheet';
import ResultsSheet from './macro-lens/ResultsSheet';
import PermissionGate from './macro-lens/PermissionGate';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onFoodFound: (food: FoodDetailData) => void;
}

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
      <Overlay visible animationType="slide">
        <View style={styles.container} />
      </Overlay>
    );
  }

  if (!permission.granted) {
    return (
      <PermissionGate
        canAsk={permission.canAskAgain}
        onRequest={requestPermission}
        onClose={handleClose}
      />
    );
  }

  /* ── Main render ───────────────────────────────────────── */
  return (
    <Overlay visible animationType="slide">
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
            {mode === 'camera' && <ScanReticle reticleStyle={reticleStyle} />}
            {mode === 'analyzing' && (
              <AnalyzingView statusIdx={statusIdx} sparkleStyle={sparkleStyle} />
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
            <CameraControls
              onPickFromGallery={handlePickFromGallery}
              onShutter={handleShutter}
              shutterStyle={shutterStyle}
            />
          )}

          {mode === 'context' && (
            <ContextSheet
              contextText={contextText}
              setContextText={setContextText}
              onRetake={handleRetake}
              onScan={handleScanWithContext}
            />
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
            <ResultsSheet items={items} totals={totals} onRetake={resetToCamera} onPickItem={handlePickItem} />
          )}
        </View>
      </View>
    </Overlay>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sw(28),
  },
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
  bottomBarSimple: {
    alignItems: 'center',
    paddingBottom: sw(48),
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
});
