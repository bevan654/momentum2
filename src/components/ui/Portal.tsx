import React, {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';

type HostApi = {
  mount: (key: string, node: ReactNode) => void;
  unmount: (key: string) => void;
  /** Close handlers of this host's open layers, top-most last. */
  backStack: (() => void)[];
};

export type PortalHostHandle = {
  /** Closes the top-most open layer in this host. Returns false if none is open. */
  closeTopLayer: () => boolean;
};

const HostContext = createContext<HostApi | null>(null);

/**
 * Renders portalled overlays (sheets, dialogs) above `children`, in mount order,
 * so the most recently opened one is on top.
 *
 * Put one at the app root, and one inside any native <Modal> whose content can
 * open a sheet. A Portal always renders into the nearest host above it.
 *
 * Android sends the back button to a native <Modal>'s onRequestClose, not to
 * BackHandler, so a host inside a native modal takes a `ref` and the modal's
 * onRequestClose calls `closeTopLayer()` first.
 */
export function PortalHost({ children, ref }: { children?: ReactNode; ref?: Ref<PortalHostHandle> }) {
  const [entries, setEntries] = useState<{ key: string; node: ReactNode }[]>([]);
  const backStack = useRef<(() => void)[]>([]).current;

  const api = useMemo<HostApi>(() => ({
    mount: (key, node) =>
      setEntries((prev) => {
        const i = prev.findIndex((e) => e.key === key);
        if (i === -1) return [...prev, { key, node }];
        const next = prev.slice();
        next[i] = { key, node };
        return next;
      }),
    unmount: (key) => setEntries((prev) => prev.filter((e) => e.key !== key)),
    backStack,
  }), [backStack]);

  useImperativeHandle(ref, () => ({
    closeTopLayer: () => {
      const top = backStack[backStack.length - 1];
      if (!top) return false;
      top();
      return true;
    },
  }), [backStack]);

  return (
    <HostContext.Provider value={api}>
      {children}
      {entries.length > 0 && (
        <View style={styles.layer} pointerEvents="box-none">
          {entries.map((e) => <Fragment key={e.key}>{e.node}</Fragment>)}
        </View>
      )}
    </HostContext.Provider>
  );
}

/** Renders `children` into the nearest PortalHost (or in place if there is none). */
export function Portal({ children }: { children: ReactNode }) {
  const host = useContext(HostContext);
  const key = useId();

  // Re-send the latest children on every render so the portalled tree stays live.
  useLayoutEffect(() => {
    host?.mount(key, children);
  });

  useLayoutEffect(() => () => host?.unmount(key), [host, key]);

  return host ? null : <>{children}</>;
}

/**
 * While `active`, Android back calls `onBack` for the top-most open layer: via
 * BackHandler in the root host, or via the host's `closeTopLayer()` inside a
 * native <Modal>.
 */
export function useLayerBackHandler(active: boolean, onBack: () => void, canHandle?: () => boolean) {
  const host = useContext(HostContext);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const canHandleRef = useRef(canHandle);
  canHandleRef.current = canHandle;

  useEffect(() => {
    if (!active) return;
    const close = () => onBackRef.current();
    host?.backStack.push(close);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Let the press fall through when the layer's screen isn't showing (e.g. another tab).
      if (canHandleRef.current && !canHandleRef.current()) return false;
      close();
      return true;
    });
    return () => {
      sub.remove();
      if (!host) return;
      const i = host.backStack.lastIndexOf(close);
      if (i !== -1) host.backStack.splice(i, 1);
    };
  }, [active, host]);
}

const styles = StyleSheet.create({
  // Above anything in the app that sets its own zIndex/elevation (e.g. the header).
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});
