/**
 * Mock adapter: serves the API contract from local seed JSON.
 *
 * This is the only module that knows `src/data` exists. Swapping in a real
 * backend means writing an `httpAdapter` with the same shape and changing one
 * line in `client.ts` — no screen changes.
 */

import { loadSeedCatalog } from '../domain/seedCatalog';
import { ancestorChain, describeAtPlace, resolveArea, resolveAreaFromPoint, resolveOne } from '../domain/resolve';
import { EXACT_KM, haversineKm } from '../domain/geo';
import { buildContext, searchLocalities } from '../domain/search';
import { gpsPlaceStore, mergeCoverage, probeStore, reportStore, reporterId } from '../lib/storage';
import { forwardGeocode, reverseGeocode } from '../lib/nominatim';
import type {
  AreaResult,
  Category,
  Coverage,
  Locality,
  LocalitySuggestion,
  MapPin,
  Platform,
  ResolvedCoverage,
  UserReport,
  Verdict,
} from './types';

const catalog = loadSeedCatalog();
const LOCALITIES = catalog.localities;
const PLATFORMS = catalog.platforms;
const CATEGORIES = catalog.categories;
const COVERAGE_SEED = catalog.coverage;

function allLocalities(): Locality[] {
  const extra = gpsPlaceStore.all();
  const seen = new Set(LOCALITIES.map((l) => l.id));
  return [...LOCALITIES, ...extra.filter((l) => !seen.has(l.id))];
}

function allById(): Map<string, Locality> {
  return new Map(allLocalities().map((l) => [l.id, l]));
}

/** Localities surfaced on the empty home screen. */
const POPULAR_IDS = [
  'pune-chikhali-shinde-vasti',
  'pune-baner',
  'pune-wagholi',
  'pune-hinjewadi',
  'pune-talegaon-dabhade',
  'pune-moshi',
];

/** Enough latency to make loading states real, not enough to annoy. */
const latency = <T>(value: T, ms = 90): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function breadcrumbFor(locality: Locality): string[] {
  const byId = allById();
  const parents = ancestorChain(locality.id, byId).map((a) => a.name);
  return [...parents, locality.state];
}

function toSuggestion(locality: Locality): LocalitySuggestion {
  return { locality, context: buildContext(locality, allById()), score: 0 };
}

function coverageNow(): Coverage[] {
  return mergeCoverage(COVERAGE_SEED);
}

function gpsPlaceId(lat: number, lng: number): string {
  return `gps-${lat.toFixed(4).replace('-', 'm')}-${lng.toFixed(4).replace('-', 'm')}`;
}

export const mockAdapter = {
  categories(): Category[] {
    return CATEGORIES;
  },

  platforms(): Platform[] {
    return PLATFORMS;
  },

  localities(): Locality[] {
    return allLocalities();
  },

  async coverageRecords(): Promise<Coverage[]> {
    return coverageNow();
  },

  async getLocality(id: string): Promise<Locality | null> {
    return latency(allById().get(id) ?? null, 0);
  },

  async search(query: string): Promise<LocalitySuggestion[]> {
    return latency(searchLocalities(query, allLocalities(), allById()), 60);
  },

  async popular(): Promise<LocalitySuggestion[]> {
    const picks = POPULAR_IDS.map((id) => allById().get(id)).filter((l): l is Locality => Boolean(l));
    return latency(picks.map(toSuggestion), 0);
  },

  async suggestionsFor(ids: string[]): Promise<LocalitySuggestion[]> {
    const picks = ids.map((id) => allById().get(id)).filter((l): l is Locality => Boolean(l));
    return latency(picks.map(toSuggestion), 0);
  },

  /** Nearest seeded locality to a GPS fix, with the distance we had to travel. */
  async nearest(lat: number, lng: number): Promise<{ locality: Locality; distanceKm: number } | null> {
    const candidates = allLocalities().filter((l) => l.kind !== 'city' && l.kind !== 'pincode');
    if (candidates.length === 0) return null;

    let best = candidates[0];
    let bestKm = haversineKm({ lat, lng }, best.center);
    for (const locality of candidates.slice(1)) {
      const km = haversineKm({ lat, lng }, locality.center);
      if (km < bestKm) {
        best = locality;
        bestKm = km;
      }
    }
    return latency({ locality: best, distanceKm: bestKm }, 120);
  },

  /** One pin per locality for the map: how much of the catalogue works there. */
  async mapPins(): Promise<MapPin[]> {
    const reports = reportStore.all();
    const byId = allById();
    const pins = allLocalities().filter((l) => l.kind !== 'city' && l.kind !== 'pincode').map((locality) => {
      const results = resolveArea(locality, PLATFORMS, coverageNow(), byId, reports);
      return {
        locality,
        available: results.filter((r) => r.status === 'available').length,
        total: results.length,
      };
    });
    return latency(pins, 60);
  },

  async getArea(localityId: string): Promise<AreaResult | null> {
    const locality = allById().get(localityId);
    if (!locality) return latency(null, 60);

    return latency({
      locality,
      breadcrumb: breadcrumbFor(locality),
      results: resolveArea(locality, PLATFORMS, coverageNow(), allById(), reportStore.all()),
      generatedAt: new Date().toISOString(),
    });
  },

  async getPlatformAt(
    localityId: string,
    platformId: string,
  ): Promise<{ locality: Locality; breadcrumb: string[]; resolved: ResolvedCoverage } | null> {
    const locality = allById().get(localityId);
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (!locality || !platform) return latency(null, 60);

    return latency({
      locality,
      breadcrumb: breadcrumbFor(locality),
      resolved: resolveOne(platform, locality, coverageNow(), allById(), reportStore.all(), new Date()),
    });
  },

  /**
   * Reports are recorded against the area the *user asked about*, not the area
   * the answer was inherited from — a Shinde Vasti report is evidence about
   * Shinde Vasti, even if the displayed status came from Chikhali.
   */
  async submitReport(input: {
    platformId: string;
    areaId: string;
    verdict: Verdict;
    atLocation?: boolean;
    note?: string;
  }): Promise<UserReport> {
    const report: UserReport = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platformId: input.platformId,
      areaId: input.areaId,
      verdict: input.verdict,
      reportedAt: new Date().toISOString(),
      note: input.note,
      atLocation: input.atLocation ?? false,
      reporterId: reporterId(),
    };
    reportStore.add(report);
    return latency(report, 200);
  },

  myReport(platformId: string, areaId: string): UserReport | undefined {
    return reportStore.mine(platformId, areaId);
  },

  async ready(): Promise<void> {
    /* seed JSON is already in memory */
  },

  async probeLogin(password: string): Promise<void> {
    void password;
  },

  async probeMe(): Promise<boolean> {
    return true;
  },

  async probeRecord(input: {
    platformId: string;
    areaId: string;
    status: Coverage['status'];
    etaMinutes?: number;
    storeName?: string;
    note?: string;
  }): Promise<Coverage> {
    const locality = allById().get(input.areaId);
    const platform = PLATFORMS.find((p) => p.id === input.platformId);
    const etaMinutes =
      input.etaMinutes != null && !Number.isNaN(input.etaMinutes)
        ? ([input.etaMinutes, input.etaMinutes] as [number, number])
        : undefined;
    const detailsNote =
      input.note?.trim() ||
      `Live check on ${platform?.name ?? input.platformId}${locality?.pincode ? ` for pincode ${locality.pincode}` : ''}.`;
    const record: Coverage = {
      platformId: input.platformId,
      areaId: input.areaId,
      status: input.status,
      source: 'probe',
      lastVerifiedAt: new Date().toISOString(),
      evidence: { positive: 1, negative: 0 },
      details: {
        ...(etaMinutes ? { etaMinutes } : {}),
        coverageStrength: input.status === 'available' ? 'wide' : input.status === 'partial' ? 'edge' : undefined,
        note: input.storeName?.trim() ? `${detailsNote} Store: ${input.storeName.trim()}.` : detailsNote,
      },
    };
    if (!record.details?.coverageStrength && record.details) {
      delete record.details.coverageStrength;
    }
    probeStore.upsert(record);
    try {
      await fetch('/api/probe/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pincode: locality?.pincode,
          platformId: input.platformId,
          status: input.status,
          areaId: input.areaId,
          etaMinutes: input.etaMinutes,
          storeName: input.storeName,
          note: input.note,
        }),
      });
    } catch {
      /* Vite disk plugin is optional */
    }
    return record;
  },

  async reverse(lat: number, lng: number): Promise<{ name: string; city: string; state: string }> {
    return reverseGeocode(lat, lng);
  },

  async geocode(query: string) {
    return forwardGeocode(query);
  },

  async getAt(lat: number, lng: number, q?: string): Promise<AreaResult> {
    const geo = await reverseGeocode(lat, lng);
    const { locality, breadcrumb } = describeAtPlace({ lat, lng }, geo, q);
    return latency({
      locality,
      breadcrumb,
      results: resolveAreaFromPoint({ lat, lng }, PLATFORMS, coverageNow(), allById(), reportStore.all()),
      generatedAt: new Date().toISOString(),
    });
  },

  async probePlace(input: { lat: number; lng: number; name?: string }): Promise<Locality> {
    const origin = { lat: input.lat, lng: input.lng };
    let nearest: Locality | null = null;
    let nearestKm = Infinity;
    for (const locality of allLocalities()) {
      const km = haversineKm(origin, locality.center);
      if (km <= EXACT_KM && km < nearestKm) {
        nearest = locality;
        nearestKm = km;
      }
    }
    if (nearest) return nearest;
    const geo = await reverseGeocode(input.lat, input.lng);
    const place: Locality = {
      id: gpsPlaceId(input.lat, input.lng),
      name: input.name?.trim() || geo.name,
      aliases: [],
      kind: 'locality',
      parentId: null,
      pincode: null,
      city: geo.city,
      state: geo.state,
      center: origin,
    };
    gpsPlaceStore.upsert(place);
    return place;
  },

  async refresh(): Promise<void> {
    /* mock catalog is always current */
  },
};

export type MockAdapter = typeof mockAdapter;
