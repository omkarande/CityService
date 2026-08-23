import { useEffect, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import ClickToSearch from './ClickToSearch';
import Icon from './Icon';
import MapZoomButtons from './MapZoomButtons';
import { coverageColor, formatDistance } from '../lib/format';

const PUNE_CENTER: [number, number] = [18.6, 73.85];

/** Street-level; OSM raster tiles go to 19. */
const STREET_ZOOM = 17;
const CLUSTER_MAX_ZOOM = 16;
const OSM_MAX_ZOOM = 19;

/** A drag-anywhere pin, drawn with the app's own icon font — no image assets to bundle. */
const pickIcon = L.divIcon({
  className: '',
  html:
    '<div style="width:30px;height:30px;border-radius:9999px;background:#000;display:flex;' +
    'align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #fff;">' +
    '<span class="material-symbols-outlined" style="color:#fff;font-size:17px;">location_on</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

/** Re-frames the map around whatever the search currently matches. Runs once per new set of matches, not on every drag. */
function FitToSuggestions({ suggestions }: { suggestions: LocalitySuggestion[] }) {
  const map = useMap();

  useEffect(() => {
    if (suggestions.length === 0) return;
    if (suggestions.length === 1) {
      const { lat, lng } = suggestions[0].locality.center;
      map.setView([lat, lng], STREET_ZOOM);
      return;
    }
    const bounds = suggestions.map((s) => [s.locality.center.lat, s.locality.center.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: CLUSTER_MAX_ZOOM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, map]);

  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

interface MapLayersProps {
  suggestions: LocalitySuggestion[];
  pinsById: Map<string, MapPin>;
  picked: [number, number] | null;
  highlightId: string | null;
  onPickLocality: (localityId: string) => void;
  onMovePin: (lat: number, lng: number) => void;
}

/** The pieces shared between the compact preview and the expanded picker. */
function MapLayers({ suggestions, pinsById, picked, highlightId, onPickLocality, onMovePin }: MapLayersProps) {
  const labelPins = suggestions.length <= 6;

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={OSM_MAX_ZOOM} />
      <FitToSuggestions suggestions={suggestions} />
      <ClickToSearch onPick={onMovePin} />

      {suggestions.map((suggestion) => {
        const pin = pinsById.get(suggestion.locality.id);
        const ratio = pin && pin.total > 0 ? pin.available / pin.total : 0;
        const highlighted = suggestion.locality.id === highlightId;
        return (
          <CircleMarker
            key={suggestion.locality.id}
            center={[suggestion.locality.center.lat, suggestion.locality.center.lng]}
            radius={highlighted ? 11 : 8}
            pathOptions={{
              color: highlighted ? '#003d9b' : '#ffffff',
              weight: highlighted ? 3 : 2,
              fillColor: coverageColor(ratio),
              fillOpacity: 0.95,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onPickLocality(suggestion.locality.id);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} permanent={labelPins} opacity={1}>
              {suggestion.locality.name}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {picked && (
        <Marker
          position={picked}
          icon={pickIcon}
          draggable
          zIndexOffset={800}
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onMovePin(lat, lng);
            },
          }}
        />
      )}
    </>
  );
}

interface SearchMapProps {
  suggestions: LocalitySuggestion[];
  pinsById: Map<string, MapPin>;
}

/**
 * Compact preview by default — tap a labelled pin to jump straight there, or
 * Expand for a street-level picker where the pin can be dragged before confirming.
 */
export default function SearchMap({ suggestions, pinsById }: SearchMapProps) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [nearest, setNearest] = useState<{ id: string; name: string; distanceKm: number } | null>(null);

  const first = suggestions[0]?.locality.center;

  useEffect(() => {
    if (first) setPicked([first.lat, first.lng]);
  }, [first?.lat, first?.lng]);

  useEffect(() => {
    if (!picked) {
      setNearest(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.nearest(picked[0], picked[1]).then((match) => {
        if (cancelled || !match) return;
        setNearest({ id: match.locality.id, name: match.locality.name, distanceKm: match.distanceKm });
      });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [picked]);

  function goToLocality(localityId: string) {
    navigate(`/l/${localityId}`);
  }

  async function confirmPick() {
    if (!picked) return;
    const match = await api.nearest(picked[0], picked[1]);
    if (match) navigate(`/l/${match.locality.id}`, { state: { distanceKm: match.distanceKm } });
  }

  const layerProps = {
    suggestions,
    pinsById,
    picked,
    highlightId: nearest?.id ?? null,
    onMovePin: (lat: number, lng: number) => setPicked([lat, lng]),
  };

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden rounded-2xl shadow-soft">
        <MapContainer
          center={first ? [first.lat, first.lng] : PUNE_CENTER}
          zoom={STREET_ZOOM}
          minZoom={11}
          maxZoom={OSM_MAX_ZOOM}
          scrollWheelZoom
          zoomControl={false}
          attributionControl={false}
          keyboard={false}
          style={{ height: '100%', width: '100%' }}
        >
          <MapLayers {...layerProps} onPickLocality={goToLocality} />
          <MapZoomButtons className="absolute right-3 bottom-14" />
        </MapContainer>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-label-bold text-primary shadow-md backdrop-blur-sm active:scale-95"
        >
          <Icon name="open_in_full" size={14} />
          Expand
        </button>

        {nearest && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 z-[1000] truncate rounded-full bg-white/95 px-3 py-1.5 text-center text-label-sm font-semibold text-on-surface shadow-md">
            {nearest.name}
            <span className="font-normal text-on-surface-variant"> · {formatDistance(nearest.distanceKm)}</span>
          </p>
        )}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-surface">
          <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant/30 px-margin-mobile py-3">
            <button
              type="button"
              aria-label="Close map"
              onClick={() => setExpanded(false)}
              className="-ml-2 rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-95"
            >
              <Icon name="close" />
            </button>
            <h2 className="text-body-lg font-bold text-on-surface">Zoom and drop the pin on your spot</h2>
          </div>

          <div className="relative flex-1">
            <MapContainer
              center={picked ?? (first ? [first.lat, first.lng] : PUNE_CENTER)}
              zoom={STREET_ZOOM}
              minZoom={11}
              maxZoom={OSM_MAX_ZOOM}
              scrollWheelZoom
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%' }}
            >
              <InvalidateOnMount />
              <MapLayers
                {...layerProps}
                onPickLocality={(localityId) => {
                  setExpanded(false);
                  goToLocality(localityId);
                }}
              />
              <MapZoomButtons />
            </MapContainer>
          </div>

          <div className="shrink-0 border-t border-outline-variant/30 p-margin-mobile">
            {nearest && (
              <p className="mb-2 text-center text-body-md text-on-surface-variant">
                Nearest tracked locality: <span className="font-semibold text-on-surface">{nearest.name}</span>
                {' · '}
                {formatDistance(nearest.distanceKm)}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                confirmPick();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-body-lg font-bold text-on-primary shadow-soft active:scale-[0.99]"
            >
              <Icon name="check" size={18} />
              Use this location
            </button>
          </div>
        </div>
      )}
    </>
  );
}
