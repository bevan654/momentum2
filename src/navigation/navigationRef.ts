import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/**
 * Navigate from anywhere (e.g. FriendProfileModal which sits outside the community stack).
 * Safe to call even if the navigator hasn't mounted yet.
 */
export function globalNavigate(name: string, params?: Record<string, any>): void {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  }
}
