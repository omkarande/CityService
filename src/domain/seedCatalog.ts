/**
 * Versioned JSON → the catalog we load into memory or upsert into Postgres.
 *
 * Named localities and coverage come from src/data. Pincode centroids fill
 * search gaps. Hub rings (M4) write source:seed coverage without touching
 * live probe rows.
 */

import localitiesJson from '../data/localities.pune.json';
import platformsJson from '../data/platforms.json';
import categoriesJson from '../data/categories.json';
import coverageJson from '../data/coverage.seed.json';
import pincodesJson from '../data/pincodes.pune-pcmc.json';
import hubsJson from '../data/hubs.pune-pcmc.json';
import type { Category, Coverage, Locality, Platform, SourceKind } from '../api/types';
import { haversineKm } from './geo';

const QCOMM = ['zepto', 'blinkit', 'instamart'] as const;

const DEFAULT_RINGS: Record<string, { innerKm: number; edgeKm: number }> = {
  zepto: { innerKm: 2.5, edgeKm: 4.5 },
  blinkit: { innerKm: 3, edgeKm: 5 },
  instamart: { innerKm: 3, edgeKm: 5 },
};

type PincodeRow = {
  pincode: string;
  officeNames: string[];
  area: string;
  lat?: number | null;
  lng?: number | null;
};

type HubRow = {
  platformId: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  innerKm?: number;
  edgeKm?: number;
  firstSeenAt?: string;
};

export function seedCoverageMayOverwrite(existing: SourceKind | undefined): boolean {
  return existing !== 'probe';
}

export function pincodeToLocality(row: PincodeRow, named: Locality[]): Locality | null {
  if (row.lat == null || row.lng == null) return null;
  if (named.some((l) => l.pincode === row.pincode)) return null;
  const parentId = row.area === 'PCMC' ? 'pimpri-chinchwad' : 'pune';
  const aliases = row.officeNames.filter((name) => {
    const n = name.trim().toLowerCase();
    return n.length > 2 && n !== 'pune' && n !== 'pimpri-chinchwad';
  });
  return {
    id: `pin-${row.pincode}`,
    name: row.pincode,
    aliases,
    kind: 'pincode',
    parentId,
    pincode: row.pincode,
    city: 'Pune',
    state: 'Maharashtra',
    center: { lat: row.lat, lng: row.lng },
  };
}

function ringForDistance(distKm: number, hub: HubRow): 'inner' | 'edge' | 'outside' {
  const defaults = DEFAULT_RINGS[hub.platformId] ?? { innerKm: 2.5, edgeKm: 4.5 };
  const inner = hub.innerKm ?? defaults.innerKm;
  const edge = hub.edgeKm ?? defaults.edgeKm;
  if (distKm <= inner) return 'inner';
  if (distKm <= edge) return 'edge';
  return 'outside';
}

export function applyHubInferences(
  localities: Locality[],
  coverage: Coverage[],
  hubs: HubRow[],
): Coverage[] {
  const placed = hubs.filter(
    (h): h is HubRow & { lat: number; lng: number } =>
      QCOMM.includes(h.platformId as (typeof QCOMM)[number]) && h.lat != null && h.lng != null,
  );
  if (placed.length === 0) return coverage;

  const next = [...coverage];
  const index = new Map(next.map((r, i) => [`${r.platformId}:${r.areaId}`, i]));

  for (const locality of localities) {
    if (locality.kind === 'city') continue;
    for (const platformId of QCOMM) {
      let best: (typeof placed)[number] | null = null;
      let bestKm = Infinity;
      for (const hub of placed.filter((h) => h.platformId === platformId)) {
        const km = haversineKm(locality.center, { lat: hub.lat, lng: hub.lng });
        if (km < bestKm) {
          bestKm = km;
          best = hub;
        }
      }
      if (!best) continue;
      const ring = ringForDistance(bestKm, best);
      if (ring === 'outside') continue;

      const key = `${platformId}:${locality.id}`;
      const existingIdx = index.get(key);
      const existing = existingIdx != null ? next[existingIdx] : undefined;
      if (!seedCoverageMayOverwrite(existing?.source)) continue;

      const record: Coverage = {
        platformId,
        areaId: locality.id,
        status: ring === 'inner' ? 'available' : 'partial',
        source: 'seed',
        lastVerifiedAt: best.firstSeenAt || '2026-08-14T00:00:00Z',
        evidence: { positive: 0, negative: 0 },
        details: {
          coverageStrength: ring === 'inner' ? 'wide' : 'edge',
          note: `Inferred from ${platformId} hub ${best.name} (${bestKm.toFixed(1)} km, ${ring} ring). Not a live check.`,
        },
      };
      if (existingIdx != null) next[existingIdx] = record;
      else {
        index.set(key, next.length);
        next.push(record);
      }
    }
  }
  return next;
}

export function loadSeedCatalog(): {
  categories: Category[];
  platforms: Platform[];
  localities: Locality[];
  coverage: Coverage[];
} {
  const named = localitiesJson as unknown as Locality[];
  const pincodes = ((pincodesJson as { pincodes: PincodeRow[] }).pincodes ?? [])
    .map((row) => pincodeToLocality(row, named))
    .filter((l): l is Locality => Boolean(l));
  const localities = [...named, ...pincodes];
  const coverage = applyHubInferences(
    localities,
    (coverageJson as { records: Coverage[] }).records,
    (hubsJson as { hubs: HubRow[] }).hubs ?? [],
  );
  return {
    categories: categoriesJson as Category[],
    platforms: platformsJson as unknown as Platform[],
    localities,
    coverage,
  };
}
