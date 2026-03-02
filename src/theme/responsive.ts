import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design dimensions (iPhone 14 Pro)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

/** Scale a value based on screen width */
export function sw(size: number): number {
  return (size / BASE_WIDTH) * SCREEN_WIDTH;
}

/** Scale a value based on screen height */
export function sh(size: number): number {
  return (size / BASE_HEIGHT) * SCREEN_HEIGHT;
}

/** Moderate scale — scales less aggressively (good for fonts, padding) */
export function ms(size: number, factor = 0.5): number {
  return size + (sw(size) - size) * factor;
}

export { SCREEN_WIDTH, SCREEN_HEIGHT };
