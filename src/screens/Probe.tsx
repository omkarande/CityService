import { useCallback, useEffect, useState } from 'react';
import type { CoverageStatus } from '../api/types';
import Icon from '../components/Icon';

type Ring = 'inner' | 'edge' | 'just-outside' | 'outside';

interface QueueItem {
  pincode: string;
  platformId: string;
  platformName: string;
  website: string | null;
  priority: number;
  reason: string;
  area: string;
  placeString: string;
  localityId: string | null;
  localityName: string | null;
  hubName: string | null;
  hubDistanceKm: number | null;
  ring: Ring | null;
}

interface Hub {
  id: string;
  platformId: string;
  name: string;
  areaHint?: string;
  lat: number | null;
  lng: number | null;
  innerKm: number;
  edgeKm: number;
}

interface ProbeState {
  universeSize: number;
  checkpoints: number;
  probeRecords: number;
  inferredRecords: number;
  hubs: Hub[];
  queue: QueueItem[];
}

const STATUS_BTN: { status: CoverageStatus; label: string; className: string }[] = [
  { status: 'available', label: 'Available', className: 'bg-success-container text-success hover:ring-success' },
  { status: 'partial', label: 'Partial', className: 'bg-warning-container text-warning hover:ring-warning' },
  { status: 'unavailable', label: 'Unavailable', className: 'bg-danger-container text-danger hover:ring-danger' },
  { status: 'unknown', label: 'Unknown', className: 'bg-neutral-container text-neutral hover:ring-outline' },
];

export default function Probe() {
  const [state, setState] = useState<ProbeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [eta, setEta] = useState('');
  const [storeName, setStoreName] = useState('');
  const [note, setNote] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/probe/state?count=8');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Could not load queue (${res.status}). Is npm run dev running?`);
    }
    setState(await res.json());
  }, []);

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, [refresh]);

  const current = state?.queue[0] ?? null;

  async function copyPlace() {
    if (!current) return;
    await navigator.clipboard.writeText(current.placeString);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function openSite() {
    if (!current?.website) return;
    window.open(current.website, '_blank', 'noopener,noreferrer');
  }

  async function record(status: CoverageStatus) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/probe/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pincode: current.pincode,
          platformId: current.platformId,
          status,
          areaId: current.localityId,
          etaMinutes: eta ? Number(eta) : undefined,
          storeName: storeName || undefined,
          note: note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Record failed');
      setFlash(`${current.platformName} @ ${current.pincode} → ${status}`);
      setEta('');
      setStoreName('');
      setNote('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function runInfer() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/probe/infer', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Infer failed');
      setFlash(`Inferred ${body.written?.length ?? 0} hub-disk records`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-container-low px-4 py-6 text-on-surface md:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label-sm font-label-sm uppercase tracking-wide text-on-surface/60">Dev only</p>
            <h1 className="font-headline-md text-headline-md">Probe console</h1>
            <p className="mt-1 max-w-xl text-body-md text-on-surface/70">
              Open the platform, set this place in their location picker, then record what they render. No
              private APIs — a live site check.
            </p>
          </div>
          {state && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-label-sm text-on-surface/70 sm:grid-cols-4">
              <div>
                <dt className="text-on-surface/45">Pincodes</dt>
                <dd className="text-body-lg font-semibold text-on-surface">{state.universeSize}</dd>
              </div>
              <div>
                <dt className="text-on-surface/45">Checkpoints</dt>
                <dd className="text-body-lg font-semibold text-on-surface">{state.checkpoints}</dd>
              </div>
              <div>
                <dt className="text-on-surface/45">Live probes</dt>
                <dd className="text-body-lg font-semibold text-on-surface">{state.probeRecords}</dd>
              </div>
              <div>
                <dt className="text-on-surface/45">Hub inferences</dt>
                <dd className="text-body-lg font-semibold text-on-surface">{state.inferredRecords}</dd>
              </div>
            </dl>
          )}
        </header>

        {error && (
          <p className="mb-4 rounded-lg bg-danger-container px-3 py-2 text-body-md text-danger">{error}</p>
        )}
        {flash && (
          <p className="mb-4 rounded-lg bg-success-container px-3 py-2 text-body-md text-success">{flash}</p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="rounded-xl bg-surface p-5 shadow-soft">
            {!current ? (
              <p className="text-body-md text-on-surface/70">
                Queue is empty. Every tier-1 pair is logged, or sits inside a known hub inner disk.
              </p>
            ) : (
              <>
                <div className="mb-1 text-label-sm font-label-sm uppercase tracking-wide text-on-surface/50">
                  Next check
                </div>
                <h2 className="font-headline-md text-headline-md">
                  {current.platformName} · {current.pincode}
                </h2>
                <p className="mt-1 text-body-lg">{current.placeString}</p>
                <p className="mt-2 text-body-md text-on-surface/65">{current.reason}</p>
                {current.hubDistanceKm != null && (
                  <p className="mt-1 text-label-sm text-on-surface/55">
                    {current.hubDistanceKm} km from {current.hubName} ({current.ring})
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyPlace}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-label-bold text-on-primary"
                  >
                    <Icon name="content_copy" size={16} />
                    {copied ? 'Copied' : 'Copy place'}
                  </button>
                  <button
                    type="button"
                    onClick={openSite}
                    disabled={!current.website}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2 text-label-bold text-on-surface disabled:opacity-40"
                  >
                    <Icon name="open_in_new" size={16} />
                    Open {current.platformName}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <label className="block text-label-sm text-on-surface/60">
                    ETA minutes
                    <input
                      value={eta}
                      onChange={(e) => setEta(e.target.value)}
                      inputMode="numeric"
                      placeholder="8"
                      className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface"
                    />
                  </label>
                  <label className="block text-label-sm text-on-surface/60 sm:col-span-2">
                    Store name the UI showed
                    <input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="MIDC"
                      className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface"
                    />
                  </label>
                  <label className="block text-label-sm text-on-surface/60 sm:col-span-3">
                    Note
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What you actually saw"
                      className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface"
                    />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STATUS_BTN.map((btn) => (
                    <button
                      key={btn.status}
                      type="button"
                      disabled={busy}
                      onClick={() => record(btn.status)}
                      className={`rounded-lg px-3 py-3 text-label-bold ring-2 ring-transparent disabled:opacity-50 ${btn.className}`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <h3 className="mb-2 text-label-bold">Up next</h3>
              <ol className="space-y-2 text-body-md">
                {(state?.queue ?? []).slice(1).map((item) => (
                  <li key={`${item.pincode}-${item.platformId}`} className="text-on-surface/75">
                    <span className="font-semibold text-on-surface">
                      {item.platformName} · {item.pincode}
                    </span>
                    <span className="block text-label-sm text-on-surface/50">{item.reason}</span>
                  </li>
                ))}
                {(state?.queue.length ?? 0) <= 1 && (
                  <li className="text-on-surface/45">Nothing queued after this one.</li>
                )}
              </ol>
            </section>

            <section className="rounded-xl bg-surface p-4 shadow-soft">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-label-bold">Hubs</h3>
                <button
                  type="button"
                  onClick={runInfer}
                  disabled={busy}
                  className="text-label-sm font-semibold text-primary disabled:opacity-40"
                >
                  Infer disks
                </button>
              </div>
              <ul className="space-y-2 text-body-md">
                {(state?.hubs ?? []).map((hub) => (
                  <li key={hub.id}>
                    <span className="font-semibold">{hub.name}</span>
                    <span className="text-on-surface/55"> · {hub.platformId}</span>
                    <span className="block text-label-sm text-on-surface/50">
                      inner {hub.innerKm} km · edge {hub.edgeKm} km
                      {hub.lat == null ? ' · no coordinates yet' : ''}
                    </span>
                  </li>
                ))}
                {(state?.hubs.length ?? 0) === 0 && (
                  <li className="text-on-surface/45">None yet — record a store name from a live check.</li>
                )}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
