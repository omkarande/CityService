import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { MapPin } from '../api/types';
import GoogleMapCanvas from '../components/GoogleMapCanvas';
import Icon from '../components/Icon';
import MapZoomButtons from '../components/MapZoomButtons';
import TopBar from '../components/TopBar';
import { coverageColor } from '../lib/format';
import { loadGoogleMaps } from '../lib/googleMaps';
import { useVisibilityRefresh } from '../lib/useVisibilityRefresh';

const PUNE = { lat: 18.6, lng: 73.85 };
const STREET_ZOOM = 16;
const CLUSTER_MAX_ZOOM = 15;

export default function Nearby() {
  const navigate = useNavigate();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [locating, setLocating] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const loadPins = useCallback(() => {
    api.mapPins().then(setPins);
  }, []);
  useEffect(loadPins, [loadPins]);
  useVisibilityRefresh(loadPins);

  function goToNearest(lat: number, lng: number) {
    setLocating(true);
    navigate(`/at?lat=${lat}&lng=${lng}`);
    setLocating(false);
  }

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    void loadGoogleMaps().then((maps) => {
      if (cancelled) return;
      const click = map.addListener('click', (event: google.maps.MapMouseEvent) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (lat == null || lng == null) return;
        goToNearest(lat, lng);
      });
      cleanups.push(() => click.remove());

      const markers: google.maps.Marker[] = [];
      if (pins.length === 0) {
        map.setCenter(PUNE);
        map.setZoom(STREET_ZOOM);
      } else if (pins.length === 1) {
        map.setCenter(pins[0].locality.center);
        map.setZoom(STREET_ZOOM);
      } else {
        const bounds = new maps.LatLngBounds();
        for (const pin of pins) bounds.extend(pin.locality.center);
        map.fitBounds(bounds, 40);
        maps.event.addListenerOnce(map, 'idle', () => {
          if ((map.getZoom() ?? STREET_ZOOM) > CLUSTER_MAX_ZOOM) map.setZoom(CLUSTER_MAX_ZOOM);
        });
      }

      for (const pin of pins) {
        const ratio = pin.total === 0 ? 0 : pin.available / pin.total;
        const marker = new maps.Marker({
          map,
          position: pin.locality.center,
          title: pin.locality.name,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: coverageColor(ratio),
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => navigate(`/l/${pin.locality.id}`));
        markers.push(marker);
      }
      cleanups.push(() => {
        for (const marker of markers) marker.setMap(null);
      });
    });

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [map, pins, navigate]);

  return (
    <>
      <TopBar title="Nearby" />

      <div className="flex flex-col gap-md pb-lg">
        <div className="relative h-[28rem] w-full overflow-hidden border-y border-outline-variant/40">
          <GoogleMapCanvas className="h-full w-full" center={PUNE} zoom={STREET_ZOOM} minZoom={5} onReady={setMap} />
          <MapZoomButtons map={map} />

          {locating && (
            <div className="pointer-events-none absolute inset-0 z-[950] flex items-center justify-center bg-surface/40 backdrop-blur-[1px]">
              <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-label-bold text-primary shadow-md">
                <Icon name="progress_activity" size={16} />
                Finding nearest info…
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-sm px-margin-mobile">
          <p className="flex items-start gap-1.5 text-label-sm text-on-surface-variant">
            <Icon name="touch_app" size={14} className="mt-0.5 shrink-0 text-outline" />
            Pinch or use +/− to zoom, tap a pin to open that locality, or tap empty map for the nearest we track.
          </p>

          <div className="flex items-center gap-4 text-label-sm text-on-surface-variant">
            <Legend color="#36b37e" label="Most services" />
            <Legend color="#ffab00" label="Some" />
            <Legend color="#ff5630" label="Few" />
          </div>

          {pins.map((pin) => {
            const ratio = pin.total === 0 ? 0 : pin.available / pin.total;
            return (
              <button
                key={pin.locality.id}
                onClick={() => navigate(`/l/${pin.locality.id}`)}
                className="flex items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 text-left transition-colors hover:bg-surface-container-low active:scale-[0.99]"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: coverageColor(ratio) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-lg font-semibold text-on-surface">
                    {pin.locality.name}
                  </span>
                  <span className="block text-body-md text-on-surface-variant">
                    {pin.available} of {pin.total} services available
                  </span>
                </span>
                <Icon name="chevron_right" className="text-outline" size={20} />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      {label}
    </span>
  );
}
