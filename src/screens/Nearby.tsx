import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type { MapPin } from '../api/types';
import ClickToSearch from '../components/ClickToSearch';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { coverageColor } from '../lib/format';

const PUNE_CENTER: [number, number] = [18.6, 73.85];

export default function Nearby() {
  const navigate = useNavigate();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api.mapPins().then(setPins);
  }, []);

  async function goToNearest(lat: number, lng: number) {
    setLocating(true);
    const match = await api.nearest(lat, lng);
    setLocating(false);
    if (match) navigate(`/l/${match.locality.id}`, { state: { distanceKm: match.distanceKm } });
  }

  return (
    <>
      <TopBar title="Nearby" />

      <div className="flex flex-col gap-md pb-lg">
        <div className="relative h-72 w-full overflow-hidden border-y border-outline-variant/40">
          <MapContainer
            center={PUNE_CENTER}
            zoom={11}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToSearch onPick={goToNearest} />

            {pins.map((pin) => {
              const ratio = pin.total === 0 ? 0 : pin.available / pin.total;
              return (
                <CircleMarker
                  key={pin.locality.id}
                  center={[pin.locality.center.lat, pin.locality.center.lng]}
                  radius={8}
                  bubblingMouseEvents={false}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: coverageColor(ratio),
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup>
                    <span className="block font-bold">{pin.locality.name}</span>
                    <span className="block">
                      {pin.available} of {pin.total} services available
                    </span>
                    <button className="mt-1 underline" onClick={() => navigate(`/l/${pin.locality.id}`)}>
                      See details
                    </button>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

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
            Tap any pin for details, or tap empty map to jump to the nearest locality we track.
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
