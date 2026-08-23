import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ancestorChain, describeAtPlace, resolveArea, resolveAreaFromPoint, resolveOne } from '../src/domain/resolve.ts';
import { EXACT_KM, haversineKm } from '../src/domain/geo.ts';
import { buildContext, searchLocalities } from '../src/domain/search.ts';
import type { Coverage, CoverageStatus, Locality, SourceKind } from '../src/api/types.ts';
import { createStore } from './store.ts';
import { forwardGeocode, reverseGeocode } from '../src/lib/nominatim.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const COOKIE = 'probe_session';
const STATUSES: CoverageStatus[] = ['available', 'partial', 'unavailable', 'unknown'];

const POPULAR_IDS = [
  'pune-chikhali-shinde-vasti',
  'pune-baner',
  'pune-wagholi',
  'pune-hinjewadi',
  'pune-talegaon-dabhade',
  'pune-moshi',
];

function probeSecret(): string {
  return (process.env.PROBE_SECRET ?? '').trim();
}

function sessionToken(): string {
  const secret = probeSecret();
  if (!secret) return '';
  return createHmac('sha256', secret).update('cityservice-probe').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function isProbeAuthed(req: express.Request): boolean {
  const secret = probeSecret();
  if (!secret) return false;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ') && safeEqual(auth.slice(7), secret)) return true;
  const token = parseCookies(req.headers.cookie)[COOKIE];
  const expected = sessionToken();
  return Boolean(token && expected && safeEqual(token, expected));
}

function requireProbe(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!probeSecret()) {
    res.status(503).json({ error: 'PROBE_SECRET is not configured on the server.' });
    return;
  }
  if (!isProbeAuthed(req)) {
    res.status(401).json({ error: 'Team password required.' });
    return;
  }
  next();
}

function loadDotEnv() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function gpsPlaceId(lat: number, lng: number): string {
  const latKey = lat.toFixed(4).replace('-', 'm');
  const lngKey = lng.toFixed(4).replace('-', 'm');
  return `gps-${latKey}-${lngKey}`;
}

async function findOrCreatePlace(
  store: Awaited<ReturnType<typeof createStore>>['store'],
  lat: number,
  lng: number,
  name?: string,
): Promise<Locality> {
  const origin = { lat, lng };
  const localities = await store.localities();
  let nearest: Locality | null = null;
  let nearestKm = Infinity;
  for (const locality of localities) {
    const km = haversineKm(origin, locality.center);
    if (km <= EXACT_KM && km < nearestKm) {
      nearest = locality;
      nearestKm = km;
    }
  }
  if (nearest) return nearest;

  const geo = await reverseGeocode(lat, lng);
  const place: Locality = {
    id: gpsPlaceId(lat, lng),
    name: name?.trim() || geo.name,
    aliases: [],
    kind: 'locality',
    parentId: null,
    pincode: null,
    city: geo.city,
    state: geo.state,
    center: origin,
  };
  return store.insertLocality(place);
}

function breadcrumbFor(locality: Locality, byId: Map<string, Locality>): string[] {
  const parents = ancestorChain(locality.id, byId).map((a) => a.name);
  return [...parents, locality.state];
}

async function main() {
  loadDotEnv();
  const { store, usingPostgres } = await createStore();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON' });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, postgres: usingPostgres });
  });

  app.get('/api/catalog', async (_req, res) => {
    const [categories, platforms, localities] = await Promise.all([
      store.categories(),
      store.platforms(),
      store.localities(),
    ]);
    res.json({ categories, platforms, localities });
  });

  app.get('/api/platforms', async (_req, res) => {
    res.json(await store.platforms());
  });

  app.get('/api/coverage', async (_req, res) => {
    res.json({ records: await store.coverage() });
  });

  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q ?? '');
    const localities = await store.localities();
    const byId = new Map(localities.map((l) => [l.id, l]));
    res.json(searchLocalities(q, localities, byId));
  });

  app.get('/api/popular', async (_req, res) => {
    const localities = await store.localities();
    const byId = new Map(localities.map((l) => [l.id, l]));
    const picks = POPULAR_IDS.map((id) => byId.get(id)).filter((l): l is Locality => Boolean(l));
    res.json(picks.map((locality) => ({ locality, context: buildContext(locality, byId), score: 0 })));
  });

  app.post('/api/suggestions', async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
    const localities = await store.localities();
    const byId = new Map(localities.map((l) => [l.id, l]));
    const picks = ids.map((id) => byId.get(id)).filter((l): l is Locality => Boolean(l));
    res.json(picks.map((locality) => ({ locality, context: buildContext(locality, byId), score: 0 })));
  });

  app.get('/api/nearest', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const localities = await store.localities();
    const candidates = localities.filter((l) => l.kind !== 'city' && l.kind !== 'pincode');
    if (candidates.length === 0) {
      res.json(null);
      return;
    }
    let best = candidates[0];
    let bestKm = haversineKm({ lat, lng }, best.center);
    for (const locality of candidates.slice(1)) {
      const km = haversineKm({ lat, lng }, locality.center);
      if (km < bestKm) {
        best = locality;
        bestKm = km;
      }
    }
    res.json({ locality: best, distanceKm: bestKm });
  });

  app.get('/api/map-pins', async (_req, res) => {
    const [localities, platforms, coverage] = await Promise.all([
      store.localities(),
      store.platforms(),
      store.coverage(),
    ]);
    const byId = new Map(localities.map((l) => [l.id, l]));
    const pins = localities
      .filter((l) => l.kind !== 'city' && l.kind !== 'pincode')
      .map((locality) => {
        const results = resolveArea(locality, platforms, coverage, byId, []);
        return {
          locality,
          available: results.filter((r) => r.status === 'available').length,
          total: results.length,
        };
      });
    res.json(pins);
  });

  app.get('/api/area/:localityId', async (req, res) => {
    const [localities, platforms, coverage] = await Promise.all([
      store.localities(),
      store.platforms(),
      store.coverage(),
    ]);
    const byId = new Map(localities.map((l) => [l.id, l]));
    const locality = byId.get(req.params.localityId);
    if (!locality) {
      res.status(404).json(null);
      return;
    }
    res.json({
      locality,
      breadcrumb: breadcrumbFor(locality, byId),
      results: resolveArea(locality, platforms, coverage, byId, []),
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/api/area/:localityId/:platformId', async (req, res) => {
    const [localities, platforms, coverage] = await Promise.all([
      store.localities(),
      store.platforms(),
      store.coverage(),
    ]);
    const byId = new Map(localities.map((l) => [l.id, l]));
    const locality = byId.get(req.params.localityId);
    const platform = platforms.find((p) => p.id === req.params.platformId);
    if (!locality || !platform) {
      res.status(404).json(null);
      return;
    }
    res.json({
      locality,
      breadcrumb: breadcrumbFor(locality, byId),
      resolved: resolveOne(platform, locality, coverage, byId, [], new Date()),
    });
  });

  app.get('/api/reverse', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    res.json(await reverseGeocode(lat, lng));
  });

  app.get('/api/geocode', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const hit = await forwardGeocode(q);
    if (!hit) {
      res.status(404).json({ error: 'No match' });
      return;
    }
    res.json(hit);
  });

  app.get('/api/at', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const q = String(req.query.q ?? '').trim();
    const [localities, platforms, coverage] = await Promise.all([
      store.localities(),
      store.platforms(),
      store.coverage(),
    ]);
    const byId = new Map(localities.map((l) => [l.id, l]));
    const geo = await reverseGeocode(lat, lng);
    const { locality, breadcrumb } = describeAtPlace({ lat, lng }, geo, q || undefined);
    res.json({
      locality,
      breadcrumb,
      results: resolveAreaFromPoint({ lat, lng }, platforms, coverage, byId, []),
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/api/probe/me', (req, res) => {
    if (!isProbeAuthed(req)) {
      res.status(401).json({ ok: false });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/probe/login', (req, res) => {
    const secret = probeSecret();
    if (!secret) {
      res.status(503).json({ error: 'PROBE_SECRET is not configured on the server.' });
      return;
    }
    const password = String(req.body?.password ?? '');
    if (!safeEqual(password, secret)) {
      res.status(401).json({ error: 'Wrong password.' });
      return;
    }
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
    );
    res.json({ ok: true });
  });

  app.post('/api/probe/place', requireProbe, async (req, res) => {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
    const locality = await findOrCreatePlace(store, lat, lng, name);
    res.json({ locality });
  });

  app.post('/api/probe/record', requireProbe, async (req, res) => {
    const platformId = String(req.body?.platformId ?? '').trim();
    const areaId = String(req.body?.areaId ?? '').trim();
    const status = String(req.body?.status ?? '').trim() as CoverageStatus;
    if (!platformId || !areaId) {
      res.status(400).json({ error: 'platformId and areaId are required' });
      return;
    }
    if (!STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
      return;
    }

    const [localities, platforms] = await Promise.all([store.localities(), store.platforms()]);
    const locality = localities.find((l) => l.id === areaId);
    const platform = platforms.find((p) => p.id === platformId);
    if (!locality || !platform) {
      res.status(400).json({ error: 'Unknown locality or platform' });
      return;
    }

    const etaRaw = req.body?.etaMinutes;
    const etaMinutes =
      Array.isArray(etaRaw) && etaRaw.length === 2
        ? ([Number(etaRaw[0]), Number(etaRaw[1])] as [number, number])
        : etaRaw != null && etaRaw !== ''
          ? ([Number(etaRaw), Number(etaRaw)] as [number, number])
          : undefined;

    const noteParts = [
      typeof req.body?.note === 'string' && req.body.note.trim()
        ? req.body.note.trim()
        : `Live check on ${platform.name}${locality.pincode ? ` for pincode ${locality.pincode}` : ''}.`,
    ];
    if (typeof req.body?.storeName === 'string' && req.body.storeName.trim()) {
      noteParts.push(`Store: ${req.body.storeName.trim()}.`);
    }

    const details: Coverage['details'] = {
      note: noteParts.join(' '),
    };
    if (etaMinutes && etaMinutes.every((n) => Number.isFinite(n))) details.etaMinutes = etaMinutes;
    if (status === 'available') details.coverageStrength = 'wide';
    if (status === 'partial') details.coverageStrength = 'edge';

    const record: Coverage = {
      platformId,
      areaId,
      status,
      source: 'probe' as SourceKind,
      lastVerifiedAt: new Date().toISOString(),
      evidence: { positive: 1, negative: 0 },
      details,
    };

    await store.upsertCoverage(record);
    res.json({ coverage: record });
  });

  const dist = path.join(root, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.warn(`[cityservice] listening on :${PORT} (postgres=${usingPostgres})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
