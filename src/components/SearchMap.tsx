import { useEffect, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import ClickToSearch from './ClickToSearch';
import Icon from './Icon';
import { coverageColor } from '../lib/format';

const PUNE_CENTER: [number, number] = [18.6, 73.85];

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
      map.setView([lat, lng], 14);
      return;
    }
    const bounds = suggestions.map((s) => [s.locality.center.lat, s.locality.center.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, map]);

  return null;
}

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="add" size={18} />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="remove" size={18} />
      </button>
    </div>
  );
}

interface MapLayersProps {
  suggestions: LocalitySuggestion[];
  pinsById: Map<string, MapPin>;
  picked: [number, number] | null;
  onPickLocality: (localityId: string) => void;
  onMovePin: (lat: number, lng: number) => void;
}

/** The pieces shared between the compact preview and the expanded picker. */
function MapLayers({ suggestions, pinsById, picked, onPickLocality, onMovePin }: MapLayersProps) {
  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToSuggestions suggestions={suggestions} />
      <ClickToSearch onPick={onMovePin} />

      {suggestions.map((suggestion) => {
        const pin = pinsById.get(suggestion.locality.id);
        const ratio = pin && pin.total > 0 ? pin.available / pin.total : 0;
        return (
          <CircleMarker
            key={suggestion.locality.id}
            center={[suggestion.locality.center.lat, suggestion.locality.center.lng]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: coverageColor(ratio),
              fillOpacity: 0.95,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onPickLocality(suggestion.locality.id);
              },
            }}
          />
        );
      })}

      {picked && (
        <Marker
          position={picked}
          icon={pickIcon}
          draggable
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
 * Compact preview by default — tap a match to jump straight there, or hit
 * Expand for a full-screen, zoomable picker where the pin can be dragged
 * precisely before confirming.
 */
export default function SearchMap({ suggestions, pinsById }: SearchMapProps) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);

  const first = suggestions[0]?.locality.center;

  useEffect(() => {
    if (first) setPicked([first.lat, first.lng]);
  }, [first?.lat, first?.lng]);

  function goToLocality(localityId: string) {
    navigate(`/l/${localityId}`);
  }

  async function confirmPick() {
    if (!picked) return;
    const match = await api.nearest(picked[0], picked[1]);
    if (match) navigate(`/l/${match.locality.id}`, { state: { distanceKm: match.distanceKm } });
  }

  return (
    <>
      <div className="relative h-40 w-full overflow-hidden rounded-2xl shadow-soft">
        <MapContainer
          center={first ? [first.lat, first.lng] : PUNE_CENTER}
          zoom={13}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
          keyboard={false}
          style={{ height: '100%', width: '100%' }}
        >
          <MapLayers
            suggestions={suggestions}
            pinsById={pinsById}
            picked={picked}
            onPickLocality={goToLocality}
            onMovePin={(lat, lng) => setPicked([lat, lng])}
          />
        </MapContainer>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-label-bold text-primary shadow-md backdrop-blur-sm active:scale-95"
        >
          <Icon name="open_in_full" size={14} />
          Expand
        </button>
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
            <h2 className="text-body-lg font-bold text-on-surface">Drag the pin to your exact spot</h2>
          </div>

          <div className="relative flex-1">
            <MapContainer
              center={picked ?? (first ? [first.lat, first.lng] : PUNE_CENTER)}
              zoom={15}
              scrollWheelZoom
              zoomControl={false}
              attributionControl={false}
              style={{ height: '100%', width: '100%' }}
            >
              <MapLayers
                suggestions={suggestions}
                pinsById={pinsById}
                picked={picked}
                onPickLocality={(localityId) => {
                  setExpanded(false);
                  goToLocality(localityId);
                }}
                onMovePin={(lat, lng) => setPicked([lat, lng])}
              />
              <ZoomButtons />
            </MapContainer>
          </div>

          <div className="shrink-0 border-t border-outline-variant/30 p-margin-mobile">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                confirmPick();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-body-lg font-bold text-on-primary shadow-soft active:scale-[0.99]"
            >
              <Icon name="check" size={18} />
              Confirm this location
            </button>
          </div>
        </div>
      )}
    </>
  );
}
