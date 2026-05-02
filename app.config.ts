import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Momentum',
  slug: 'momentum',
  scheme: 'momentum',
  owner: 'shajanbevan',
  version: '1.0.35',
  orientation: 'portrait',
  icon: './assets/logo.png',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: 'https://u.expo.dev/157d9970-0ab2-46aa-8b0a-e12bc42c009d',
  },
  extra: {
    eas: {
      projectId: '157d9970-0ab2-46aa-8b0a-e12bc42c009d',
    },
  },
  splash: {
    image: './assets/logo.png',
    resizeMode: 'contain',
    backgroundColor: '#0D0D0F',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.momentum.fitnessapp',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSMotionUsageDescription:
        'Momentum uses motion data to count your daily steps and show them on the home screen.',
    },
  },
  android: {
    package: 'com.momentum.fitnessapp',
    googleServicesFile: './google-services.json',
    minSdkVersion: 24,
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/logo.png',
      backgroundColor: '#0D0D0F',
    },
    edgeToEdgeEnabled: true,
    permissions: [
      'SCHEDULE_EXACT_ALARM',
      'USE_EXACT_ALARM',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
      'ACTIVITY_RECOGNITION',
    ],
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        android: {
          useNextNotificationsApi: true,
        },
      },
    ],
    'expo-updates',
    'expo-video',
    ['expo-camera', { cameraPermission: 'Momentum needs camera access to scan food barcodes and meals with MacroLens.' }],
    ['expo-image-picker', { photosPermission: 'Momentum needs photo access to scan meals with MacroLens.' }],
  ],
});
