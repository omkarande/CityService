import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import GoogleMapCanvas from './GoogleMapCanvas';
import Icon from './Icon';
import MapZoomButtons from './MapZoomButtons';
import { coverageColor, formatDistance } from '../lib/format';
import { loadGoogleMaps } from '../lib/googleMaps';
import type { PlaceHit } from '../lib/nominatim';

const PUNE = { lat: 18.6, lng: 73.85 };
const STREET_ZOOM = 17;
const CLUSTER_MAX_ZOOM = 16;

function hasCoords(place: PlaceHit): place is PlaceHit & { lat: number; lng: number } {
  return place.lat != null && place.lng != null;
}

function attachLabel(
  maps: typeof google.maps,
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  name: string,
  onClick: () => void,
): google.maps.OverlayView {
  class LabelOverlay extends maps.OverlayView {
    div: HTMLDivElement | null = null;
    onAdd() {
      const div = document.createElement('div');
      div.textContent = name;
      div.style.cssText =
        'position:absolute;transform:translate(-50%,-100%);white-space:nowrap;background:#fff;color:#1a1a1a;font:600 11px/1.2 system-ui,sans-serif;padding:3px 7px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid rgba(0,0,0,.08);cursor:pointer;';
      div.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
      });
      this.div = div;
      this.getPanes()?.overlayMouseTarget.appendChild(div);
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(position.lat, position.lng));
      if (!point || !this.div) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }
    onRemove() {
      this.div?.remove();
      this.div = null;
    }
  }
  const overlay = new LabelOverlay();
  overlay.setMap(map);
  return overlay;
}

interface SearchMapProps {
  suggestions: LocalitySuggestion[];
  pinsById: Map<string, MapPin>;
  queryName?: string;
  initialCenter?: { lat: number; lng: number } | null;
  pinLabel?: string;
  nearbyPlaces?: PlaceHit[];
  onNearbyPick?: (place: PlaceHit) => void;
  showCompactConfirm?: boolean;
  confirmLabel?: string;
  compact?: boolean;
  onConfirm?: (lat: number, lng: number) => void;
  onPinChange?: (lat: number, lng: number) => void;
}

export default function SearchMap({
  suggestions,
  pinsById,
  queryName,
  initialCenter,
  pinLabel,
  nearbyPlaces = [],
  onNearbyPick,
  showCompactConfirm = false,
  confirmLabel = 'Select this pinned location',
  compact = false,
  onConfirm,
  onPinChange,
}: SearchMapProps) {
  const navigate = useNavigate();
  const first = suggestions[0]?.locality.center;
  const focus = initialCenter ?? (first ? { lat: first.lat, lng: first.lng } : PUNE);

  const [picked, setPicked] = useState(focus);
  const [expanded, setExpanded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [expandedMap, setExpandedMap] = useState<google.maps.Map | null>(null);
  const [nearest, setNearest] = useState<{ id: string; name: string; distanceKm: number } | null>(null);

  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const onNearbyPickRef = useRef(onNearbyPick);
  onNearbyPickRef.current = onNearbyPick;

  useEffect(() => {
    setPicked(initialCenter ?? (first ? { lat: first.lat, lng: first.lng } : PUNE));
  }, [first?.lat, first?.lng, initialCenter?.lat, initialCenter?.lng]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .nearest(picked.lat, picked.lng)
        .then((match) => {
          if (cancelled) return;
          if (!match) {
            setNearest(null);
            return;
          }
          setNearest({ id: match.locality.id, name: match.locality.name, distanceKm: match.distanceKm });
        })
        .catch(() => {
          if (!cancelled) setNearest(null);
        });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [picked]);

  useEffect(() => {
    const mapsToDraw = [map, expandedMap].filter(Boolean) as google.maps.Map[];
    if (mapsToDraw.length === 0) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    void loadGoogleMaps().then((maps) => {
      if (cancelled) return;
      for (const gmap of mapsToDraw) {
        gmap.setCenter(picked);
        gmap.setZoom(STREET_ZOOM);

        const pin = new maps.Marker({
          map: gmap,
          position: picked,
          draggable: true,
          zIndex: 800,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#000000',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        const applyPin = (lat: number, lng: number) => {
          setPicked({ lat, lng });
          onPinChangeRef.current?.(lat, lng);
        };
        const drag = pin.addListener('dragend', () => {
          const pos = pin.getPosition();
          if (!pos) return;
          applyPin(pos.lat(), pos.lng());
        });
        const click = gmap.addListener('click', (event: google.maps.MapMouseEvent) => {
          const lat = event.latLng?.lat();
          const lng = event.latLng?.lng();
          if (lat == null || lng == null) return;
          applyPin(lat, lng);
        });

        const extras: Array<google.maps.Marker | google.maps.OverlayView> = [];
        for (const suggestion of suggestions) {
          const pinInfo = pinsById.get(suggestion.locality.id);
          const ratio = pinInfo && pinInfo.total > 0 ? pinInfo.available / pinInfo.total : 0;
          const highlighted = suggestion.locality.id === nearest?.id;
          const marker = new maps.Marker({
            map: gmap,
            position: suggestion.locality.center,
            title: suggestion.locality.name,
            zIndex: highlighted ? 400 : 200,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: highlighted ? 11 : 8,
              fillColor: coverageColor(ratio),
              fillOpacity: 0.95,
              strokeColor: highlighted ? '#003d9b' : '#ffffff',
              strokeWeight: highlighted ? 3 : 2,
            },
          });
          marker.addListener('click', () => navigate(`/l/${suggestion.locality.id}`));
          extras.push(marker);
        }

        if (suggestions.length > 1 && !initialCenter) {
          const bounds = new maps.LatLngBounds();
          for (const suggestion of suggestions) bounds.extend(suggestion.locality.center);
          gmap.fitBounds(bounds, 40);
          const listener = maps.event.addListenerOnce(gmap, 'idle', () => {
            if ((gmap.getZoom() ?? STREET_ZOOM) > CLUSTER_MAX_ZOOM) gmap.setZoom(CLUSTER_MAX_ZOOM);
          });
          cleanups.push(() => listener.remove());
        }

        for (const place of nearbyPlaces.filter(hasCoords)) {
          extras.push(
            attachLabel(maps, gmap, { lat: place.lat, lng: place.lng }, place.name, () => {
              onNearbyPickRef.current?.(place);
            }),
          );
        }

        cleanups.push(() => {
          drag.remove();
          click.remove();
          pin.setMap(null);
          for (const extra of extras) extra.setMap(null);
        });
      }
    });

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [map, expandedMap, picked.lat, picked.lng, nearbyPlaces, suggestions, pinsById, nearest?.id, initialCenter, navigate]);

  function confirmPick() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (onConfirm) {
      onConfirm(picked.lat, picked.lng);
      return;
    }
    const qs = new URLSearchParams({ lat: String(picked.lat), lng: String(picked.lng) });
    const name = queryName?.trim();
    if (name) qs.set('q', name);
    navigate(`/at?${qs.toString()}`);
  }

  return (
    <>
      <div className="flex flex-col gap-sm">
        <div className={`relative w-full overflow-hidden rounded-2xl shadow-soft ${compact ? 'h-40' : 'h-64'}`}>
          <GoogleMapCanvas
            className="h-full w-full"
            center={focus}
            zoom={STREET_ZOOM}
            onReady={setMap}
          />
          <MapZoomButtons map={map} />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-label-bold text-primary shadow-md backdrop-blur-sm active:scale-95"
          >
            <Icon name="open_in_full" size={14} />
            Expand
          </button>
        </div>

        {showCompactConfirm && (
          <button
            type="button"
            onClick={confirmPick}
            className="sticky bottom-2 z-[1100] flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-body-lg font-bold text-on-primary shadow-soft active:scale-[0.99]"
          >
            <Icon name="check" size={18} />
            {confirmLabel}
          </button>
        )}
      </div>

      {expanded && (
        <div className="app-safe-top fixed inset-0 z-[2000] flex flex-col bg-surface">
          <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant/30 px-margin-mobile py-3">
            <button
              type="button"
              aria-label="Close map"
              onClick={() => {
                setExpandedMap(null);
                setExpanded(false);
              }}
              className="-ml-2 rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-95"
            >
              <Icon name="close" />
            </button>
            <h2 className="text-body-lg font-bold text-on-surface">Zoom and drop the pin on your spot</h2>
          </div>
          <div className="relative flex-1">
            <GoogleMapCanvas className="h-full w-full" center={picked} zoom={STREET_ZOOM} onReady={setExpandedMap} />
            <MapZoomButtons map={expandedMap} />
          </div>
          <div className="shrink-0 border-t border-outline-variant/30 p-margin-mobile">
            {(pinLabel || nearest) && (
              <p className="mb-2 text-center text-body-md text-on-surface-variant">
                {pinLabel ? (
                  <>
                    Selected: <span className="font-semibold text-on-surface">{pinLabel}</span>
                  </>
                ) : (
                  <>
                    Nearest tracked locality:{' '}
                    <span className="font-semibold text-on-surface">{nearest?.name}</span>
                    {' · '}
                    {nearest && formatDistance(nearest.distanceKm)}
                  </>
                )}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setExpandedMap(null);
                confirmPick();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-body-lg font-bold text-on-primary shadow-soft active:scale-[0.99]"
            >
              <Icon name="check" size={18} />
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
