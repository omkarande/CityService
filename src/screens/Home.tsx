import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import CityGrid from '../components/CityGrid';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LocalityRow from '../components/LocalityRow';
import SearchBar from '../components/SearchBar';

type LocateState = { status: 'idle' } | { status: 'locating' } | { status: 'error'; message: string };

export default function Home() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [locate, setLocate] = useState<LocateState>({ status: 'idle' });

  useEffect(() => {
    api.mapPins().then(setPins);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.search(query).then((results) => {
        if (!cancelled) setSuggestions(results);
      });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.locality.id, p])), [pins]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocate({ status: 'error', message: 'This browser cannot share your location.' });
      return;
    }

    setLocate({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const match = await api.nearest(coords.latitude, coords.longitude);
        if (!match) {
          setLocate({ status: 'error', message: 'No seeded locality near you yet — try searching instead.' });
          return;
        }
        setLocate({ status: 'idle' });
        navigate(`/l/${match.locality.id}`, { state: { distanceKm: match.distanceKm } });
      },
      () => setLocate({ status: 'error', message: 'Location permission denied.' }),
      { timeout: 10_000 },
    );
  }

  const searching = query.trim().length >= 2;

  return (
    <>
      <div className="rounded-b-3xl bg-[#FBF7F0] text-on-surface">
        <header className="sticky top-0 z-30 bg-[#FBF7F0] px-6 pb-3 pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locate.status === 'locating'}
              className="flex min-w-0 items-center gap-2 text-left disabled:opacity-60"
            >
              <Icon name="location_on" fill className="shrink-0 text-on-surface" size={22} />
              <span className="min-w-0">
                <span className="flex items-center gap-0.5 text-body-lg font-semibold leading-tight">
                  Pune
                  <Icon name="expand_more" size={18} />
                </span>
                <span className="mt-0.5 block truncate text-label-sm text-on-surface/70">
                  {locate.status === 'locating'
                    ? 'Finding your location…'
                    : `${pins.length || '—'} localities`}
                </span>
              </span>
            </button>
            <Link
              to="/account"
              aria-label="Account"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/10 ring-1 ring-black/10 active:scale-95"
            >
              <Icon name="person" fill size={18} />
            </Link>
          </div>

          <SearchBar
            value={query}
            onChange={setQuery}
            trailing={
              <button
                type="button"
                aria-label={locate.status === 'locating' ? 'Finding your location…' : 'Use my location'}
                title="Use my location"
                onClick={useMyLocation}
                disabled={locate.status === 'locating'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white active:scale-90 disabled:opacity-60"
              >
                <Icon name={locate.status === 'locating' ? 'progress_activity' : 'my_location'} size={20} />
              </button>
            }
          />

          {locate.status === 'error' && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-black/10 px-3 py-2 text-body-md text-on-surface">
              <Icon name="error" size={18} />
              {locate.message}
            </p>
          )}
        </header>

        {!searching && (
          <div className="px-6 pb-3 pt-4">
            <div className="relative overflow-hidden rounded-[28px] bg-primary px-md py-5 text-on-primary">
              <img
                src="/cityservice-apps-backdrop.svg"
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-45"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-black/20 to-transparent" />
              <div className="relative [text-shadow:0_1px_1px_rgba(0,0,0,0.7),0_2px_10px_rgba(0,0,0,0.55)]">
                <p className="text-label-bold uppercase tracking-[0.14em] text-white/90">CityService</p>
                <h2 className="mt-2 text-headline-lg-mobile font-headline-lg-mobile text-white">
                  What actually works where you live?
                </h2>
                <p className="mt-2 max-w-[34ch] text-body-md text-white/90">
                  See which delivery, ride and quick-commerce apps really serve an address.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="animate-fade-up px-6 pb-lg pt-4">
        {searching ? (
          <section className="flex flex-col gap-sm">
            <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">
              Results for “{query.trim()}”
            </h3>
            {suggestions.length === 0 ? (
              <EmptyState
                icon="search_off"
                title="Nothing matched"
                body="Only Pune localities are seeded so far. Try “Shinde Vasti”, “Baner” or a 411xxx pincode."
              />
            ) : (
              <div className="flex flex-col gap-sm">
                {suggestions.map((suggestion) => {
                  const pin = pinsById.get(suggestion.locality.id);
                  return (
                    <LocalityRow
                      key={suggestion.locality.id}
                      suggestion={suggestion}
                      trailing={
                        <span className="flex shrink-0 items-center gap-1">
                          {pin && <AvailabilityPill available={pin.available} total={pin.total} />}
                          <Icon name="chevron_right" className="text-outline" size={20} />
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-sm">
            <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">Explore by city</h3>
            <CityGrid />
          </section>
        )}
      </div>
    </>
  );
}
