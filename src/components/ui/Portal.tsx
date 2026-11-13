import React, {
  createContext,
  Fragment,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleSheet } from 'react-native';

type HostApi = {
  mount: (key: string, node: ReactNode) => void;
  unmount: (key: string) => void;
};

const HostContext = createContext<HostApi | null>(null);

/**
 * Renders portalled overlays (sheets, dialogs) above `children`, in mount order,
 * so the most recently opened one is on top.
 *
 * Put one at the app root, and one inside any native <Modal> whose content can
 * open a sheet. A Portal always renders into the nearest host above it.
 */
export function PortalHost({ children }: { children?: ReactNode }) {
  const [entries, setEntries] = useState<{ key: string; node: ReactNode }[]>([]);

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
  }), []);

  return (
    <HostContext.Provider value={api}>
      {children}
      {entries.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
