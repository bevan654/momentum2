import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Momentum',
  slug: 'momentum',
  scheme: 'momentum',
  owner: 'shajanbevan',
  version: '1.0.2',
  orientation: 'portrait',
  icon: './assets/icon.png',
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
    image: './assets/splash-icon.png',
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
    softwareKeyboardLayoutMode: 'resize',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D0D0F',
    },
    edgeToEdgeEnabled: true,
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
      'react-native-health-connect',
      {
        requestPermissionsOnFirstRun: false,
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
