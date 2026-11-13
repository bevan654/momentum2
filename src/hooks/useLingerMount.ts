import { useEffect, useState } from 'react';

/**
 * For overlays a parent only mounts while open (`{open && <Sheet visible={open} />}`):
 * stays true for `ms` after `visible` turns false, so the close animation can play
 * before the component unmounts. Default covers Sheet/Overlay exit durations.
 */
export function useLingerMount(visible: boolean, ms = 320): boolean {
  const [lingering, setLingering] = useState(visible);

  useEffect(() => {
    if (visible) {
      setLingering(true);
      return;
    }
    const t = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(t);
  }, [visible, ms]);

  return visible || lingering;
}
