import * as Haptics from 'expo-haptics';

let Audio: any = null;
let _sound: any = null;
let _avUnavailable = false;

try {
  Audio = require('expo-av').Audio;
} catch {
  _avUnavailable = true;
}

async function ensureLoaded() {
  if (_avUnavailable || !Audio) return null;
  if (_sound) return _sound;
  try {
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
