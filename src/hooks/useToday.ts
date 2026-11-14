import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toLocalDateString } from '../utils/localDate';

/** ms until the next local midnight (plus a small margin so the date has flipped). */
function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

/**
 * Today's local date (YYYY-MM-DD) that stays correct while the app is left open:
 * it updates at midnight and whenever the app returns to the foreground.
 */
export function useToday(): string {
  const [today, setToday] = useState(toLocalDateString);

  useEffect(() => {
    const refresh = () => setToday(toLocalDateString());
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilMidnight());
    };
    schedule();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
        clearTimeout(timer);
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}
