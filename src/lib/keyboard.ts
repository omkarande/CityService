import { useEffect, useState } from 'react';

/**
 * True when the software keyboard has shrunk the visual viewport
 * (Android WebView adjustResize). Used to hide the tab bar so search
 * confirm actions stay tappable.
 */
export function useKeyboardOpen(thresholdPx = 120): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    let maxHeight = Math.max(window.innerHeight, viewport?.height ?? 0);

    const readHeight = () => viewport?.height ?? window.innerHeight;

    const update = () => {
      const height = readHeight();
      if (height > maxHeight) maxHeight = height;
      setOpen(maxHeight - height > thresholdPx);
    };

    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    window.addEventListener('focusin', update);
    window.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('focusin', update);
      window.removeEventListener('focusout', update);
    };
  }, [thresholdPx]);

  return open;
}
