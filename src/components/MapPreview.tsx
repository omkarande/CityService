import { useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { MapPin } from '../api/types';
import { coverageColor } from '../lib/format';
import ClickToSearch from './ClickToSearch';
import Icon from './Icon';

const PUNE_CENTER: [number, number] = [18.6, 73.85];

interface MapPreviewProps {
  pins: MapPin[];
  /** Localities shown as cards along the bottom edge. */
  highlights: MapPin[];
}

/**
 * The map card from the original mockup, built live rather than as a static
 * image — real coverage pins, and tapping anywhere on the map (not just a
 * pin) runs the same "nearest known locality" search as "Use my location".
 */
export default function MapPreview({ pins, highlights }: MapPreviewProps) {
  const navigate = useNavigate();
  const [locating, setLocating] = useState(false);

  async function goToNearest(lat: number, lng: number) {
    setLocating(true);
    const match = await api.nearest(lat, lng);
    setLocating(false);
    if (match) navigate(`/l/${match.locality.id}`, { state: { distanceKm: match.distanceKm } });
  }

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-[28px] shadow-soft">
      <MapContainer
        center={PUNE_CENTER}
        zoom={10}
        minZoom={9}
        maxZoom={16}
        scrollWheelZoom={false}
        keyboard={false}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToSearch onPick={goToNearest} />

        {pins.map((pin) => {
          const ratio = pin.total === 0 ? 0 : pin.available / pin.total;
          return (
            <CircleMarker
              key={pin.locality.id}
              center={[pin.locality.center.lat, pin.locality.center.lng]}
              radius={6}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: coverageColor(ratio),
                fillOpacity: 0.95,
              }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  navigate(`/l/${pin.locality.id}`);
                },
              }}
            />
          );
        })}

        <ZoomButtons />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] h-16 bg-gradient-to-b from-black/20 to-transparent" />

      <div className="absolute left-3 top-3 z-[1000] flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-label-bold text-on-surface shadow-md">
          <Icon name="location_on" fill size={14} className="text-primary" />
          Pune
        </span>
        <ExpandButton />
      </div>

      {locating && (
        <div className="pointer-events-none absolute inset-0 z-[950] flex items-center justify-center bg-surface/40 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-label-bold text-primary shadow-md">
            <Icon name="progress_activity" size={16} />
            Finding nearest info…
          </span>
        </div>
      )}

      <div className="absolute bottom-14 left-3 z-[1000] flex items-center gap-2 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-on-surface-variant shadow-md">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success-bright" />
          Most
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-warning-bright" />
          Some
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-danger-bright" />
          Few
        </span>
      </div>

      <div className="hide-scrollbar pointer-events-auto absolute inset-x-0 bottom-0 z-[900] flex gap-2 overflow-x-auto bg-gradient-to-t from-black/30 to-transparent p-2 pt-6">
        {highlights.map((pin) => {
          const ratio = pin.total === 0 ? 0 : pin.available / pin.total;
          return (
            <Link
              key={pin.locality.id}
              to={`/l/${pin.locality.id}`}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm transition-transform active:scale-95"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: coverageColor(ratio) }}
                aria-hidden="true"
              />
              <span className="leading-tight">
                <span className="block text-label-bold text-on-surface">{pin.locality.name}</span>
                <span className="block text-label-sm text-on-surface-variant">
                  {pin.available}/{pin.total} live
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Real zoom, matching the mockup's +/- stack. */
function ZoomButtons() {
  const map = useMap();

  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
      <MapButton label="Zoom in" icon="add" onClick={() => map.zoomIn()} />
      <MapButton label="Zoom out" icon="remove" onClick={() => map.zoomOut()} />
    </div>
  );
}

function MapButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-primary shadow-md transition-transform hover:bg-surface-container-low active:scale-90"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function ExpandButton() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/nearby')}
      className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-label-bold text-primary shadow-md backdrop-blur-sm transition-transform active:scale-95"
    >
      <Icon name="open_in_full" size={14} />
      Expand
    </button>
  );
}
