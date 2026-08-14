import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import CityGrid from '../components/CityGrid';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LocalityRow from '../components/LocalityRow';
import MapPreview from '../components/MapPreview';
import SearchBar from '../components/SearchBar';
import { recentStore } from '../lib/storage';

type LocateState = { status: 'idle' } | { status: 'locating' } | { status: 'error'; message: string };

export default function Home() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [recent, setRecent] = useState<LocalitySuggestion[]>([]);
  const [popular, setPopular] = useState<LocalitySuggestion[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [locate, setLocate] = useState<LocateState>({ status: 'idle' });

  const platforms = api.platforms();

  useEffect(() => {
    api.popular().then(setPopular);
    api.mapPins().then(setPins);
    api.suggestionsFor(recentStore.all()).then(setRecent);
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

  /** The four least-covered areas make the sharpest demo on the map card. */
  const highlights = useMemo(
    () => [...pins].sort((a, b) => a.available / (a.total || 1) - b.available / (b.total || 1)).slice(0, 4),
    [pins],
  );

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

  const withPin = (suggestion: LocalitySuggestion) => {
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
  };

  return (
    <>
      {/* Brand + heading share one card so the name and the pitch read as a single unit,
          not a nav bar sitting on top of a separate section. */}
      <div className="animate-fade-up flex flex-col gap-3 rounded-b-2xl bg-surface-container-lowest px-margin-mobile pb-lg pt-3 shadow-soft">
        <div className="flex items-center gap-2">
          <button
            aria-label="Menu"
            className="-ml-2 rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-95"
          >
            <Icon name="menu" />
          </button>
          <h1 className="text-headline-md font-headline-md font-bold text-primary">CityService</h1>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-label-bold text-primary">
            <Icon name="explore" size={14} />
            Pune · {pins.length || '—'} localities
          </p>
          <h2 className="mt-1 text-headline-md font-headline-md text-on-surface">
            What actually works where you live?
          </h2>
          <p className="mt-1 max-w-[38ch] text-body-md text-on-surface-variant">
            See which delivery, ride and quick-commerce apps really serve an address.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar value={query} onChange={setQuery} />
          </div>
          <button
            aria-label={locate.status === 'locating' ? 'Finding your location…' : 'Use my location'}
            title="Use my location"
            onClick={useMyLocation}
            disabled={locate.status === 'locating'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary shadow-soft transition-colors hover:bg-surface-container-low active:scale-90 disabled:opacity-60"
          >
            <Icon name={locate.status === 'locating' ? 'progress_activity' : 'my_location'} size={20} />
          </button>
        </div>

        {locate.status === 'error' && (
          <p className="flex items-start gap-2 rounded-lg bg-error-container px-3 py-2 text-body-md text-on-error-container">
            <Icon name="error" size={18} />
            {locate.message}
          </p>
        )}
      </div>

      <div className="animate-fade-up flex flex-col gap-lg px-margin-mobile pb-lg pt-lg">
        {searching ? (
          <Section title={`Results for “${query.trim()}”`}>
            {suggestions.length === 0 ? (
              <EmptyState
                icon="search_off"
                title="Nothing matched"
                body="Only Pune localities are seeded so far. Try “Shinde Vasti”, “Baner” or a 411xxx pincode."
              />
            ) : (
              suggestions.map(withPin)
            )}
          </Section>
        ) : (
          <>
            <Section title="Explore by city">
              <CityGrid />
            </Section>

            {pins.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">
                  See it on the map
                </h3>
                <MapPreview pins={pins} highlights={highlights} />
                <p className="text-label-sm text-on-surface-variant">
                  Drag or pinch to zoom into a specific area, then tap it to jump to the nearest locality we
                  track. Green means most apps work there, red means few do.
                </p>
              </section>
            )}

            {recent.length > 0 && <Section title="Recently checked">{recent.map(withPin)}</Section>}

            <Section title="Popular areas">{popular.map(withPin)}</Section>

            <Section title="How it works">
              <Step
                n={1}
                icon="location_on"
                title="Pick your locality"
                body="Search by name or pincode — right down to village level."
              />
              <Step
                n={2}
                icon="checklist"
                title="See what's live there"
                body="Every app, with how sure we are and when it was last checked."
              />
              <Step
                n={3}
                icon="thumbs_up_down"
                title="Keep it honest"
                body="Report what you find. A real report always outranks our guess."
              />
            </Section>

            <AboutSection platformNames={platforms.map((p) => p.name)} />
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-sm">
      <h3 className="text-label-bold uppercase tracking-wider text-on-surface-variant">{title}</h3>
      <div className="flex flex-col gap-sm">{children}</div>
    </section>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
        <Icon name={icon} size={20} />
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
          {n}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-body-lg font-semibold text-on-surface">{title}</span>
        <span className="block text-body-md text-on-surface-variant">{body}</span>
      </span>
    </div>
  );
}

/** Closes the loop with a plain-English answer to "what does this app do". */
function AboutSection({ platformNames }: { platformNames: string[] }) {
  return (
    <section className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-md">
      <p className="flex items-center gap-2 text-label-bold uppercase tracking-wider text-primary">
        <Icon name="info" size={16} />
        What is CityService?
      </p>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Every ride-hailing, delivery and quick-commerce app keeps its own private map of where it actually works —
        and none of them show it to you until after you've installed the app, signed up, and typed in your
        address. CityService puts that answer up front.
      </p>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Search a locality — right down to a single vasti or society — and see which of these actually serve it,
        confirmed by the people who live there:
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {platformNames.map((name) => (
          <span
            key={name}
            className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}
