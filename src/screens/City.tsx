import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { FEATURED_CITIES } from '../data/featuredCities';
import { slugify } from '../lib/format';

/**
 * Opens when a city tile on Home is tapped. Only Pune's areas carry a real
 * `localityId` and get an availability pill; every other city's areas route
 * to an id we hold no data for, so Results shows its honest empty state.
 */
export default function City() {
  const { cityId = '' } = useParams();
  const city = FEATURED_CITIES.find((c) => c.id === cityId);
  const [pins, setPins] = useState<MapPin[]>([]);

  useEffect(() => {
    if (city?.seeded) api.mapPins().then(setPins);
  }, [city?.seeded]);

  if (!city) {
    return (
      <>
        <TopBar back backLabel="Back" />
        <div className="px-margin-mobile py-lg">
          <EmptyState icon="location_off" title="City not found" body="That city isn't in our list yet." />
        </div>
      </>
    );
  }

  const pinsById = new Map(pins.map((p) => [p.locality.id, p]));

  return (
    <>
      <TopBar back backLabel="Back" />

      <div className="animate-fade-up flex flex-col gap-md pb-lg">
        <div className="relative h-40 w-full overflow-hidden">
          <img src={city.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {!city.seeded && (
            <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-label-sm font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
              Coming soon
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 p-margin-mobile">
            <h2 className="text-headline-lg-mobile font-headline-lg text-white">{city.name}</h2>
            <p className="text-body-md text-white/80">{city.landmark}</p>
          </div>
        </div>

        <div className="flex flex-col gap-sm px-margin-mobile">
          <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">
            Popular areas in {city.name}
          </h3>

          {!city.seeded && (
            <p className="flex items-start gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface-variant">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-outline" />
              We haven't collected coverage data for {city.name} yet — tap an area to see how the app says so,
              instead of guessing.
            </p>
          )}

          <div className="flex flex-col gap-sm">
            {city.areas.map((area) => {
              const pin = area.localityId ? pinsById.get(area.localityId) : undefined;
              return (
                <Link
                  key={area.label}
                  to={`/l/${area.localityId ?? `${city.id}-${slugify(area.label)}`}`}
                  className="flex items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 transition-colors hover:border-primary-container/40 hover:bg-surface-container-low active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
                    <Icon name="location_on" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-lg font-semibold text-on-surface">{area.label}</span>
                    <span className="block text-body-md text-on-surface-variant">{city.name}</span>
                  </span>
                  {pin ? (
                    <AvailabilityPill available={pin.available} total={pin.total} />
                  ) : (
                    <Icon name="chevron_right" className="text-outline" size={20} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
