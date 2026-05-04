import * as Haptics from 'expo-haptics';

let Audio: any = null;
let _sound: any = null;
let _avUnavailable = false;
let _audioModeSet = false;

try {
  Audio = require('expo-av').Audio;
} catch {
  _avUnavailable = true;
}

async function ensureAudioMode() {
  if (_audioModeSet || !Audio) return;
  try {
    // Mix with other audio (e.g. Spotify) instead of ducking it.
    // Constants: 1 = DO_NOT_MIX, 2 = DUCK_OTHERS, 0 = MIX_WITH_OTHERS
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: Audio.InterruptionModeIOS?.MixWithOthers ?? 0,
      interruptionModeAndroid: Audio.InterruptionModeAndroid?.DoNotMix ?? 1,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    _audioModeSet = true;
  } catch {
    // Non-fatal: beep just won't mix nicely
  }
}

async function ensureLoaded() {
  if (_avUnavailable || !Audio) return null;
  if (_sound) return _sound;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/beep.wav'),
      { shouldPlay: false },
    );
    _sound = sound;
    return _sound;
  } catch {
    _avUnavailable = true;
    return null;
  }
}

export async function playBeep() {
  try {
    const sound = await ensureLoaded();
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } else {
      // Fallback: haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}
