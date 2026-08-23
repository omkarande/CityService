import { useEffect } from 'react';

/** Refetch when the user comes back to this tab. */
export function useVisibilityRefresh(fn: () => void) {
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') fn();
    };
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
    };
  }, [fn]);
}
