import React from 'react';
import { Freeze } from 'react-freeze';
import { useNavigationState, useRoute } from '@react-navigation/native';

/**
 * Wraps a tab screen so it stops re-rendering while it is more than one tab away from the
 * current tab. material-top-tabs keeps every visited tab mounted and has no freezeOnBlur, so
 * without this a store update (food logged, set ticked, feed loaded) re-renders all five tabs.
 * Neighbours stay live because they are visible while swiping. Updates made while frozen are
 * applied as soon as the tab comes within one of the current tab.
 */
export function withFreezeWhenFar<P extends object>(Screen: React.ComponentType<P>): React.ComponentType<P> {
  function FreezeWhenFar(props: P) {
    const route = useRoute();
    const far = useNavigationState((state) => {
      const i = state.routes.findIndex((r) => r.key === route.key);
      return i >= 0 && Math.abs(state.index - i) > 1;
    });
    return (
      <Freeze freeze={far}>
        <Screen {...props} />
      </Freeze>
    );
  }
  FreezeWhenFar.displayName = `FreezeWhenFar(${Screen.displayName || Screen.name || 'Screen'})`;
  return FreezeWhenFar;
}
