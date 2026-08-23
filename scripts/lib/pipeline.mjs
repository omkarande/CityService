// Shared Pune+PCMC coverage pipeline (ARCHITECTURE.md §10).
// Used by pick-next-check, record-check, infer-hubs, and the Vite /probe API.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.join(__dirname, '..', '..', 'src', 'data');

export const TIER_1_PLATFORMS = [
  'zepto',
  'blinkit',
  'instamart',
  'swiggy',
  'zomato',
  'amazon',
  'flipkart',
  'bigbasket',
];

export const QCOMM_PLATFORMS = ['zepto', 'blinkit', 'instamart'];

export const DEFAULT_RINGS = {
  zepto: { innerKm: 2.5, edgeKm: 4.5 },
  blinkit: { innerKm: 3, edgeKm: 5 },
  instamart: { innerKm: 3, edgeKm: 5 },
};

const STATUSES = ['available', 'partial', 'unavailable', 'unknown'];

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function loadUniverse() {
  const raw = readJson(path.join(dataDir, 'pincodes.pune-pcmc.json'));
  return raw.pincodes
    .filter((p) => p.area === 'PMC' || p.area === 'PCMC')
    .filter((p) => p.lat != null && p.lng != null);
}

export function loadLocalities() {
  return readJson(path.join(dataDir, 'localities.pune.json'));
}

export function loadPlatforms() {
  return readJson(path.join(dataDir, 'platforms.json'));
}

export function loadCoverage() {
  return readJson(path.join(dataDir, 'coverage.seed.json'));
}

export function loadHubsFile() {
  const file = path.join(dataDir, 'hubs.pune-pcmc.json');
  if (!existsSync(file)) return { hubs: [] };
  return readJson(file);
}

export function loadPlacedHubs() {
  return loadHubsFile().hubs.filter((h) => h.lat != null && h.lng != null);
}

export function loadCheckpoints(universe) {
  const file = path.join(dataDir, 'checkpoints.log.json');
  if (existsSync(file)) return readJson(file);

  const localities = loadLocalities();
  const coverage = loadCoverage();
  const localityById = new Map(localities.map((l) => [l.id, l]));

  const seeded = [];
  for (const record of coverage.records) {
    if (record.source !== 'probe') continue;
    const locality = localityById.get(record.areaId);
    const pincode = locality?.pincode;
    if (!pincode || !universe.some((p) => p.pincode === pincode)) continue;
    seeded.push({
      pincode,
      platformId: record.platformId,
      status: record.status,
      checkedAt: record.lastVerifiedAt,
      source: 'probe',
    });
  }
  writeJson(file, seeded);
  return seeded;
}

export function ringForDistance(distKm, hub) {
  const inner = hub.innerKm ?? DEFAULT_RINGS[hub.platformId]?.innerKm ?? 2.5;
  const edge = hub.edgeKm ?? DEFAULT_RINGS[hub.platformId]?.edgeKm ?? 4.5;
  if (distKm <= inner) return 'inner';
  if (distKm <= edge) return 'edge';
  if (distKm <= edge + 1.5) return 'just-outside';
  return 'outside';
}

export function nearestHub(point, platformId) {
  const hubs = loadPlacedHubs().filter((h) => h.platformId === platformId);
  let best = null;
  let bestDist = Infinity;
  for (const hub of hubs) {
    const d = haversineKm(point, hub);
    if (d < bestDist) {
      bestDist = d;
      best = hub;
    }
  }
  if (!best) return null;
  return { hub: best, distKm: bestDist, ring: ringForDistance(bestDist, best) };
}

function coarseGrid(universe, target = 15) {
  if (universe.length <= target) return universe.map((p) => p.pincode);
  const chosen = [universe[0]];
  const remaining = universe.slice(1);
  while (chosen.length < target && remaining.length > 0) {
    let best = null;
    let bestDist = -1;
    for (const candidate of remaining) {
      const minDist = Math.min(...chosen.map((c) => haversineKm(c, candidate)));
      if (minDist > bestDist) {
        bestDist = minDist;
        best = candidate;
      }
    }
    chosen.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return chosen.map((p) => p.pincode);
}

function isAvailable(status) {
  return status === 'available' || status === 'partial';
}

function localityForPincode(pincode, localities, pin) {
  const matches = localities.filter((l) => l.pincode === pincode);
  if (matches.length > 0) {
    const rank = { suburb: 0, locality: 1, village: 2, city: 3, pincode: 4 };
    return [...matches].sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9))[0];
  }
  if (!pin) return null;
  let best = null;
  let bestDist = Infinity;
  for (const locality of localities) {
    if (locality.kind === 'city' || !locality.center) continue;
    const d = haversineKm(pin, locality.center);
    if (d < bestDist) {
      bestDist = d;
      best = locality;
    }
  }
  return best;
}

function placeString(pin, locality) {
  const city = pin.area === 'PCMC' ? 'Pimpri-Chinchwad' : 'Pune';
  const name = pin.officeNames?.[0] ?? locality?.name ?? pin.area;
  return `${name}, ${city}, ${pin.pincode}`;
}

export function suggest(count = 10) {
  const universe = loadUniverse();
  const localities = loadLocalities();
  const platforms = loadPlatforms();
  const byPincode = new Map(universe.map((p) => [p.pincode, p]));
  const checkpoints = loadCheckpoints(universe);
  const coarse = new Set(coarseGrid(universe));
  const platformById = new Map(platforms.map((p) => [p.id, p]));

  const allPlatformIds = platforms.map((p) => p.id);
  const suggestions = [];
  const BOUNDARY_DISTANCE_KM = 4;

  for (const platformId of allPlatformIds) {
    const checkedForPlatform = checkpoints.filter((c) => c.platformId === platformId);
    const checkedPincodes = new Set(checkedForPlatform.map((c) => c.pincode));
    const qcomm = QCOMM_PLATFORMS.includes(platformId);
    const hasHubs = qcomm && loadPlacedHubs().some((h) => h.platformId === platformId);

    for (let i = 0; i < checkedForPlatform.length; i++) {
      for (let j = i + 1; j < checkedForPlatform.length; j++) {
        const a = checkedForPlatform[i];
        const b = checkedForPlatform[j];
        if (isAvailable(a.status) === isAvailable(b.status)) continue;
        const pa = byPincode.get(a.pincode);
        const pb = byPincode.get(b.pincode);
        if (!pa || !pb) continue;
        const dist = haversineKm(pa, pb);
        if (dist > BOUNDARY_DISTANCE_KM * 2) continue;

        const midpoint = { lat: (pa.lat + pb.lat) / 2, lng: (pa.lng + pb.lng) / 2 };
        let nearest = null;
        let nearestDist = Infinity;
        for (const p of universe) {
          if (checkedPincodes.has(p.pincode)) continue;
          const d = haversineKm(midpoint, p);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = p;
          }
        }
        if (nearest && nearestDist <= BOUNDARY_DISTANCE_KM) {
          suggestions.push({
            pincode: nearest.pincode,
            platformId,
            priority: 0,
            reason: `boundary check — ${a.pincode} is ${a.status}, ${b.pincode} is ${b.status} (${dist.toFixed(1)}km apart)`,
          });
        }
      }
    }

    if (hasHubs) {
      for (const p of universe) {
        if (checkedPincodes.has(p.pincode)) continue;
        const near = nearestHub(p, platformId);
        if (!near) continue;
        if (near.ring === 'inner') continue;
        if (near.ring === 'edge') {
          suggestions.push({
            pincode: p.pincode,
            platformId,
            priority: 0.5,
            reason: `hub edge — ${near.distKm.toFixed(1)}km from ${near.hub.name} (check the rim, not the core)`,
          });
        } else if (near.ring === 'just-outside') {
          suggestions.push({
            pincode: p.pincode,
            platformId,
            priority: 0.7,
            reason: `just outside hub — ${near.distKm.toFixed(1)}km from ${near.hub.name} (likely the no-side of the edge)`,
          });
        }
      }

      for (const pincode of coarse) {
        if (checkedPincodes.has(pincode)) continue;
        const pin = byPincode.get(pincode);
        const near = pin ? nearestHub(pin, platformId) : null;
        if (near && near.ring !== 'outside') continue;
        suggestions.push({
          pincode,
          platformId,
          priority: 1,
          reason: near
            ? `coarse — ${near.distKm.toFixed(1)}km from ${near.hub.name}, far enough that a new store might exist`
            : 'coarse grid — no data near this pincode yet',
        });
      }
    } else {
      for (const pincode of coarse) {
        if (checkedPincodes.has(pincode)) continue;
        suggestions.push({
          pincode,
          platformId,
          priority: 1,
          reason: 'coarse grid — no data near this pincode yet',
        });
      }
    }
  }

  for (const platformId of allPlatformIds) {
    const checkedPincodes = new Set(
      checkpoints.filter((c) => c.platformId === platformId).map((c) => c.pincode),
    );
    for (const p of universe) {
      if (checkedPincodes.has(p.pincode)) continue;
      if (QCOMM_PLATFORMS.includes(platformId)) {
        const near = nearestHub(p, platformId);
        if (near?.ring === 'inner') continue;
      }
      suggestions.push({ pincode: p.pincode, platformId, priority: 2, reason: 'fill-in — not yet checked' });
    }
  }

  const seen = new Map();
  for (const s of suggestions) {
    const key = `${s.pincode}|${s.platformId}`;
    const existing = seen.get(key);
    if (!existing || s.priority < existing.priority) seen.set(key, s);
  }

  const ranked = [...seen.values()].sort((a, b) => a.priority - b.priority);
  const byPlatform = new Map();
  for (const s of ranked) {
    const list = byPlatform.get(s.platformId) ?? [];
    list.push(s);
    byPlatform.set(s.platformId, list);
  }
  const order = allPlatformIds.filter((id) => byPlatform.has(id));
  const picked = [];
  for (let i = 0; picked.length < count; i++) {
    let added = false;
    for (const id of order) {
      const item = byPlatform.get(id)?.[i];
      if (item) {
        picked.push(item);
        added = true;
        if (picked.length >= count) break;
      }
    }
    if (!added) break;
  }

  return picked.map((s) => {
      const pin = byPincode.get(s.pincode);
      const locality = localityForPincode(s.pincode, localities, pin);
      const platform = platformById.get(s.platformId);
      const near = pin ? nearestHub(pin, s.platformId) : null;
      return {
        ...s,
        area: pin?.area ?? '?',
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
        officeNames: pin?.officeNames ?? [],
        placeString: pin ? placeString(pin, locality) : s.pincode,
        localityId: locality?.id ?? null,
        localityName: locality?.name ?? null,
        platformName: platform?.name ?? s.platformId,
        website: platform?.website ?? null,
        hubName: near?.hub.name ?? null,
        hubDistanceKm: near ? Number(near.distKm.toFixed(2)) : null,
        ring: near?.ring ?? null,
      };
    });
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function recordCheck(input) {
  const pincode = String(input.pincode ?? '').trim();
  const platformId = String(input.platformId ?? '').trim();
  const status = String(input.status ?? '').trim();
  if (!pincode || !platformId) throw new Error('pincode and platformId are required');
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(', ')}`);

  const universe = loadUniverse();
  const pin = universe.find((p) => p.pincode === pincode);
  if (!pin) throw new Error(`pincode ${pincode} is not in the PMC/PCMC universe`);

  const localities = loadLocalities();
  const areaId = input.areaId || localityForPincode(pincode, localities, pin)?.id;
  if (!areaId) throw new Error(`no locality mapped to pincode ${pincode} — pass areaId`);

  const checkedAt = input.checkedAt || new Date().toISOString();
  const eta =
    Array.isArray(input.etaMinutes)
      ? input.etaMinutes
      : input.etaMinutes != null
        ? [Number(input.etaMinutes), Number(input.etaMinutes)]
        : undefined;

  const checkpoints = loadCheckpoints(universe);
  const existingIdx = checkpoints.findIndex((c) => c.pincode === pincode && c.platformId === platformId);
  const checkpoint = {
    pincode,
    platformId,
    status,
    checkedAt,
    source: 'probe',
    ...(input.note ? { note: input.note } : {}),
    ...(input.storeName ? { storeName: input.storeName } : {}),
  };
  if (existingIdx >= 0) checkpoints[existingIdx] = { ...checkpoints[existingIdx], ...checkpoint };
  else checkpoints.push(checkpoint);
  writeJson(path.join(dataDir, 'checkpoints.log.json'), checkpoints);

  const coverage = loadCoverage();
  const recIdx = coverage.records.findIndex((r) => r.platformId === platformId && r.areaId === areaId);
  const details = {
    ...(eta ? { etaMinutes: eta } : {}),
    coverageStrength: status === 'available' ? 'wide' : status === 'partial' ? 'edge' : undefined,
    note: input.note || `Live check on ${platformId} for pincode ${pincode}.`,
  };
  if (!details.coverageStrength) delete details.coverageStrength;

  const record = {
    platformId,
    areaId,
    status,
    source: 'probe',
    lastVerifiedAt: checkedAt,
    evidence: { positive: 1, negative: 0 },
    details,
  };

  if (recIdx >= 0) coverage.records[recIdx] = record;
  else {
    const firstPlaceholder = coverage.records.findIndex((r) => r.source === 'seed-placeholder');
    if (firstPlaceholder >= 0) coverage.records.splice(firstPlaceholder, 0, record);
    else coverage.records.push(record);
  }
  writeJson(path.join(dataDir, 'coverage.seed.json'), coverage);

  let hub = null;
  const storeName = typeof input.storeName === 'string' ? input.storeName.trim() : '';
  if (storeName && QCOMM_PLATFORMS.includes(platformId)) {
    const hubsFile = loadHubsFile();
    const id = `${platformId}-${slug(storeName)}`;
    const existing = hubsFile.hubs.find((h) => h.id === id || (h.platformId === platformId && h.name.toLowerCase() === storeName.toLowerCase()));
    const rings = DEFAULT_RINGS[platformId] ?? { innerKm: 2.5, edgeKm: 4.5 };
    const lat = input.storeLat != null ? Number(input.storeLat) : existing?.lat ?? null;
    const lng = input.storeLng != null ? Number(input.storeLng) : existing?.lng ?? null;
    hub = {
      id: existing?.id ?? id,
      platformId,
      name: storeName,
      areaHint: input.storeAreaHint || existing?.areaHint || placeString(pin, localityForPincode(pincode, localities, pin)),
      lat,
      lng,
      innerKm: existing?.innerKm ?? rings.innerKm,
      edgeKm: existing?.edgeKm ?? rings.edgeKm,
      source: existing?.source === 'probe-note' || lat != null ? existing?.source ?? 'probe-note' : 'probe-note',
      firstSeenAt: existing?.firstSeenAt ?? checkedAt,
    };
    if (existing) {
      const i = hubsFile.hubs.indexOf(existing);
      hubsFile.hubs[i] = { ...existing, ...hub };
    } else {
      hubsFile.hubs.push(hub);
    }
    writeJson(path.join(dataDir, 'hubs.pune-pcmc.json'), hubsFile);
  }

  return { checkpoint, coverage: record, hub, areaId };
}

export function inferHubs({ dryRun = false } = {}) {
  const localities = loadLocalities();
  const hubs = loadPlacedHubs().filter((h) => QCOMM_PLATFORMS.includes(h.platformId));
  const coverage = loadCoverage();
  const written = [];
  const skipped = [];

  for (const locality of localities) {
    if (locality.kind === 'city' || !locality.center) continue;
    for (const platformId of QCOMM_PLATFORMS) {
      const near = nearestHub(locality.center, platformId);
      if (!near || near.ring === 'outside' || near.ring === 'just-outside') continue;

      const existing = coverage.records.find((r) => r.platformId === platformId && r.areaId === locality.id);
      if (existing?.source === 'probe') {
        skipped.push({ areaId: locality.id, platformId, reason: 'existing probe' });
        continue;
      }

      const status = near.ring === 'inner' ? 'available' : 'partial';
      const record = {
        platformId,
        areaId: locality.id,
        status,
        source: 'seed',
        lastVerifiedAt: near.hub.firstSeenAt || new Date().toISOString(),
        evidence: { positive: 0, negative: 0 },
        details: {
          coverageStrength: near.ring === 'inner' ? 'wide' : 'edge',
          note: `Inferred from ${platformId} hub ${near.hub.name} (${near.distKm.toFixed(1)} km, ${near.ring} ring). Not a live check — a 5–6 km disk is not assumed.`,
        },
      };

      if (!dryRun) {
        if (existing) {
          const i = coverage.records.indexOf(existing);
          coverage.records[i] = record;
        } else {
          coverage.records.push(record);
        }
      }
      written.push({ ...record, distKm: Number(near.distKm.toFixed(2)), hubName: near.hub.name, ring: near.ring, replaced: existing?.source ?? null });
    }
  }

  if (!dryRun && written.length > 0) {
    coverage._inferredNote =
      'Some quick-commerce rows are source:seed inferred from hubs.pune-pcmc.json (inner disk = available, edge ring = partial). They are not live probes and stay below the verified ceiling.';
    writeJson(path.join(dataDir, 'coverage.seed.json'), coverage);
  }

  return { written, skipped, dryRun, hubsUsed: hubs.map((h) => h.id) };
}

export function pipelineState(queueCount = 8) {
  const universe = loadUniverse();
  const checkpoints = loadCheckpoints(universe);
  const coverage = loadCoverage();
  const hubsFile = loadHubsFile();
  return {
    universeSize: universe.length,
    checkpoints: checkpoints.length,
    probeRecords: coverage.records.filter((r) => r.source === 'probe').length,
    inferredRecords: coverage.records.filter((r) => r.source === 'seed' && r.details?.note?.startsWith('Inferred from')).length,
    hubs: hubsFile.hubs,
    queue: suggest(queueCount),
  };
}
