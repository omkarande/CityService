import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, usesHttpApi } from '../api/client';
import type { CoverageStatus, Locality, LocalitySuggestion, Platform } from '../api/types';
import SearchMap from '../components/SearchMap';
import { getCurrentCoords, LocationPermissionError } from '../lib/location';

const STATUS_BTN: { status: CoverageStatus; label: string; className: string }[] = [
  { status: 'available', label: 'Available', className: 'bg-success-container text-success' },
  { status: 'partial', label: 'Partial', className: 'bg-warning-container text-warning' },
  { status: 'unavailable', label: 'Unavailable', className: 'bg-danger-container text-danger' },
  { status: 'unknown', label: 'Unknown', className: 'bg-neutral-container text-neutral' },
];

type AuthState = 'checking' | 'login' | 'ok';
type Tab = 'location' | 'service';

export default function Probe() {
  const platforms = useMemo(() => api.platforms(), []);
  const [params, setParams] = useSearchParams();
  const [auth, setAuth] = useState<AuthState>(usesHttpApi ? 'checking' : 'ok');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('location');
  const [locating, setLocating] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [locality, setLocality] = useState<Locality | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? '');
  const [eta, setEta] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePlatform = platforms.find((p) => p.id === platformId) ?? null;
  const latParam = params.get('lat');
  const lngParam = params.get('lng');
  const emptyPins = useMemo(() => new Map(), []);

  useEffect(() => {
    if (!usesHttpApi) {
      setAuth('ok');
      return;
    }
    let cancelled = false;
    api.probeMe().then((ok) => {
      if (!cancelled) setAuth(ok ? 'ok' : 'login');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lat = latParam != null ? Number(latParam) : NaN;
    const lng = lngParam != null ? Number(lngParam) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setCoords({ lat, lng });
    let cancelled = false;
    api.reverse(lat, lng).then((geo) => {
      if (!cancelled && !placeName) setPlaceName(geo.name);
    });
    return () => {
      cancelled = true;
    };
    // Only hydrate from the URL once those params change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latParam, lngParam]);

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

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.probeLogin(password);
      setPassword('');
      setAuth('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function setUrlCoords(lat: number, lng: number) {
    setCoords({ lat, lng });
    setLocality(null);
    const next = new URLSearchParams(params);
    next.set('lat', String(lat));
    next.set('lng', String(lng));
    setParams(next, { replace: true });
  }

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      const c = await getCurrentCoords();
      setUrlCoords(c.latitude, c.longitude);
      setTab('service');
    } catch (err) {
      const message =
        err instanceof LocationPermissionError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Location permission denied.';
      setError(message);
    } finally {
      setLocating(false);
    }
  }

  function pickKnown(place: Locality) {
    setLocality(place);
    setCoords(place.center);
    setPlaceName(place.name);
    setQuery(place.name);
    setSuggestions([]);
    const next = new URLSearchParams(params);
    next.set('lat', String(place.center.lat));
    next.set('lng', String(place.center.lng));
    setParams(next, { replace: true });
    setTab('service');
  }

  async function record(status: CoverageStatus) {
    if (!coords && !locality) {
      setError('Set a location first.');
      setTab('location');
      return;
    }
    if (!activePlatform) {
      setError('Pick a service.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const etaMinutes = eta.trim() ? Number(eta) : undefined;
      let area = locality;
      if (!area && coords) {
        area = await api.probePlace({ lat: coords.lat, lng: coords.lng, name: placeName.trim() || undefined });
        setLocality(area);
      }
      if (!area) throw new Error('Could not save this place.');
      await api.probeRecord({
        platformId: activePlatform.id,
        areaId: area.id,
        status,
        etaMinutes: etaMinutes != null && !Number.isNaN(etaMinutes) ? etaMinutes : undefined,
        note: note.trim() || undefined,
      });
      setFlash(`${activePlatform.name} → ${status}`);
      setEta('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (auth === 'checking') {
    return (
      <div className="min-h-[100dvh] bg-surface-container-low px-4 py-8 text-on-surface">
        <p className="text-body-md text-on-surface/70">Checking team access…</p>
      </div>
    );
  }

  if (auth === 'login') {
    return (
      <div className="mx-auto min-h-[100dvh] max-w-md bg-surface-container-low px-4 py-8 text-on-surface">
        <Link to="/" className="text-label-sm font-semibold text-primary">
          ← CityService
        </Link>
        <h1 className="mt-3 font-headline-md text-headline-md">Team access</h1>
        {error && <p className="mt-4 rounded-lg bg-danger-container px-3 py-2 text-body-md text-danger">{error}</p>}
        <form onSubmit={submitPassword} className="mt-5 rounded-xl bg-surface p-5 shadow-soft">
          <label className="block text-label-sm text-on-surface/60">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-label-bold text-on-primary disabled:opacity-40"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  const where = locality?.name || placeName || (coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : '');

  return (
    <div className="min-h-[100dvh] bg-surface-container-low px-4 py-6 text-on-surface">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="text-label-sm font-semibold text-primary">
          ← CityService
        </Link>
        <h1 className="mt-2 font-headline-md text-headline-md">Add coverage</h1>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
          <button
            type="button"
            onClick={() => setTab('location')}
            className={`rounded-full py-2 text-label-bold ${tab === 'location' ? 'bg-primary text-on-primary' : 'text-on-surface/70'}`}
          >
            Location
          </button>
          <button
            type="button"
            onClick={() => setTab('service')}
            className={`rounded-full py-2 text-label-bold ${tab === 'service' ? 'bg-primary text-on-primary' : 'text-on-surface/70'}`}
          >
            Service
          </button>
        </div>

        {error && <p className="mt-4 rounded-lg bg-danger-container px-3 py-2 text-body-md text-danger">{error}</p>}
        {flash && <p className="mt-4 rounded-lg bg-success-container px-3 py-2 text-body-md text-success">{flash}</p>}

        {tab === 'location' && (
          <section className="mt-5 rounded-xl bg-surface p-5 shadow-soft">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="w-full rounded-lg bg-primary px-3 py-3 text-label-bold text-on-primary disabled:opacity-50"
            >
              {locating ? 'Finding you…' : 'Use current location'}
            </button>
            {where && <p className="mt-3 text-body-md text-on-surface/70">{where}</p>}
            <div className="mt-4">
              <SearchMap
                suggestions={[]}
                pinsById={emptyPins}
                queryName={placeName}
                initialCenter={coords}
                showCompactConfirm
                confirmLabel="Use this pin"
                onConfirm={(lat, lng) => {
                  setUrlCoords(lat, lng);
                  setTab('service');
                }}
                onPinChange={(lat, lng) => {
                  setUrlCoords(lat, lng);
                }}
              />
            </div>
            <label className="mt-4 block text-label-sm text-on-surface/60">
              Place name (optional)
              <input
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="Vicky Properties"
                className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md"
              />
            </label>
            <label className="mt-3 block text-label-sm text-on-surface/60">
              Or search a known area
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ravet, Baner…"
                className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md"
              />
            </label>
            {suggestions.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-lg border border-outline-variant/40">
                {suggestions.map((s) => (
                  <li key={s.locality.id}>
                    <button
                      type="button"
                      onClick={() => pickKnown(s.locality)}
                      className="w-full px-3 py-2 text-left text-body-md hover:bg-surface-container-low"
                    >
                      {s.locality.name}
                      <span className="block text-label-sm text-on-surface/50">{s.context}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {(coords || locality) && (
              <button
                type="button"
                onClick={() => setTab('service')}
                className="mt-4 w-full rounded-lg bg-surface-container-high px-3 py-2 text-label-bold"
              >
                Next: service
              </button>
            )}
          </section>
        )}

        {tab === 'service' && (
          <section className="mt-5 rounded-xl bg-surface p-5 shadow-soft">
            <p className="mb-3 text-body-md text-on-surface/70">{where || 'Set a location first'}</p>
            <label className="block text-label-sm text-on-surface/60">
              Service
              <select
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md"
              >
                {platforms.map((p: Platform) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-label-sm text-on-surface/60">
              Time (minutes)
              <input
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                inputMode="numeric"
                placeholder="10"
                className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md"
              />
            </label>
            <label className="mt-3 block text-label-sm text-on-surface/60">
              Description
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you saw"
                className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-body-md"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUS_BTN.map((btn) => (
                <button
                  key={btn.status}
                  type="button"
                  disabled={busy}
                  onClick={() => record(btn.status)}
                  className={`rounded-lg px-3 py-3 text-label-bold ${btn.className}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
