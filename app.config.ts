import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Momentum',
  slug: 'momentum',
  scheme: 'momentum',
  owner: 'shajanbevan',
  version: '1.0.34',
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
    supportsTablet: true,
    bundleIdentifier: 'com.momentum.fitnessapp',
    entitlements: {
      'com.apple.developer.healthkit': true,
      'com.apple.developer.healthkit.background-delivery': true,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
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
    ],
  },
  plugins: [
    'expo-secure-store',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'Momentum reads your health data (steps, calories, heart rate) to display your daily activity.',
        NSHealthUpdateUsageDescription:
          'Momentum saves your workout data to Apple Health.',
      },
    ],
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
    ['expo-camera', { cameraPermission: 'Momentum needs camera access to scan food barcodes.' }],
  ],
});
