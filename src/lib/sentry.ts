import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry() {
  Sentry.init({
    dsn: 'https://7394b707278d819ca2faa74301bed359@o4511294670635008.ingest.us.sentry.io/4511294672601088',
    debug: __DEV__,
    enableNative: true,
    enableNativeCrashHandling: true,
    enableAutoSessionTracking: true,
    attachScreenshot: true,
    attachStacktrace: true,
    attachViewHierarchy: true,
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    profilesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoPerformanceTracing: true,
    enableUserInteractionTracing: true,
    enableAppStartTracking: true,
    enableStallTracking: true,
    enableCaptureFailedRequests: true,
    environment: __DEV__ ? 'development' : 'production',
    release: `${Constants.expoConfig?.name ?? 'momentum'}@${Constants.expoConfig?.version ?? '0.0.0'}`,
    dist: String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '1'),
    integrations: [
      navigationIntegration,
      Sentry.mobileReplayIntegration({
        maskAllText: false,
        maskAllImages: false,
        maskAllVectors: false,
      }),
      Sentry.httpClientIntegration(),
    ],
    replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export function setSentryUser(user: { id: string; email?: string; username?: string } | null) {
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, username: user.username });
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };
