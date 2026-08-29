import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

const PUNE = { lat: 18.5204, lng: 73.8567 };

interface GoogleMapCanvasProps {
  className?: string;
  center: { lat: number; lng: number };
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  onReady?: (map: google.maps.Map) => void;
}

export default function GoogleMapCanvas({
  className = '',
  center,
  zoom = 17,
  minZoom = 5,
  maxZoom = 21,
  onReady,
}: GoogleMapCanvasProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || mapRef.current) return;
        const map = new maps.Map(el, {
          center: center.lat && center.lng ? center : PUNE,
          zoom,
          minZoom,
          maxZoom,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        onReadyRef.current?.(map);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Map failed to load');
      });

    return () => {
      cancelled = true;
    };
    // Map is created once; later center changes are handled by the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-surface-container-low px-4 text-center text-body-md text-on-surface-variant ${className}`}>
        {error}. Add VITE_GOOGLE_MAPS_KEY and rebuild.
      </div>
    );
  }

  return <div ref={elRef} className={className} />;
}
