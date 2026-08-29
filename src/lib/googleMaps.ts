/// <reference types="google.maps" />

let loading: Promise<typeof google.maps> | null = null;

export function googleMapsBrowserKey(): string {
  return String(import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '').trim();
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof google !== 'undefined' && google.maps) return Promise.resolve(google.maps);
  if (loading) return loading;

  const key = googleMapsBrowserKey();
  if (!key) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_KEY'));
  }

  loading = new Promise((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(new Error('Google Maps failed to load'));
    };
    const ready = () => {
      if (typeof google !== 'undefined' && google.maps) resolve(google.maps);
      else fail();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-cityservice-maps="1"]');
    if (existing) {
      if (typeof google !== 'undefined' && google.maps) {
        resolve(google.maps);
        return;
      }
      existing.addEventListener('load', ready);
      existing.addEventListener('error', fail);
      return;
    }

    const callbackName = '__cityserviceMapsReady';
    (window as unknown as Record<string, () => void>)[callbackName] = ready;
    const script = document.createElement('script');
    script.dataset.cityserviceMaps = '1';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&callback=${callbackName}`;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
