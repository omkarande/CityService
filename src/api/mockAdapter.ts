/**
 * Mock adapter: serves the API contract from local seed JSON.
 *
 * This is the only module that knows `src/data` exists. Swapping in a real
 * backend means writing an `httpAdapter` with the same shape and changing one
 * line in `client.ts` — no screen changes.
 */

import localitiesJson from '../data/localities.pune.json';
import platformsJson from '../data/platforms.json';
import categoriesJson from '../data/categories.json';
import coverageJson from '../data/coverage.seed.json';

import { ancestorChain, resolveArea, resolveOne } from '../domain/resolve';
import { buildContext, searchLocalities } from '../domain/search';
import { reportStore, reporterId } from '../lib/storage';
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

const LOCALITIES = localitiesJson as unknown as Locality[];
const PLATFORMS = platformsJson as unknown as Platform[];
const CATEGORIES = categoriesJson as unknown as Category[];
const COVERAGE = (coverageJson as { records: unknown[] }).records as Coverage[];

const BY_ID = new Map(LOCALITIES.map((l) => [l.id, l]));

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
  const parents = ancestorChain(locality.id, BY_ID).map((a) => a.name);
  return [...parents, locality.state];
}

function toSuggestion(locality: Locality): LocalitySuggestion {
  return { locality, context: buildContext(locality, BY_ID), score: 0 };
}

function haversineKm(a: Locality['center'], b: Locality['center']): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const mockAdapter = {
  categories(): Category[] {
    return CATEGORIES;
  },

  platforms(): Platform[] {
    return PLATFORMS;
  },

  async getLocality(id: string): Promise<Locality | null> {
    return latency(BY_ID.get(id) ?? null, 0);
  },

  async search(query: string): Promise<LocalitySuggestion[]> {
    return latency(searchLocalities(query, LOCALITIES, BY_ID), 60);
  },

  async popular(): Promise<LocalitySuggestion[]> {
    const picks = POPULAR_IDS.map((id) => BY_ID.get(id)).filter((l): l is Locality => Boolean(l));
    return latency(picks.map(toSuggestion), 0);
  },

  async suggestionsFor(ids: string[]): Promise<LocalitySuggestion[]> {
    const picks = ids.map((id) => BY_ID.get(id)).filter((l): l is Locality => Boolean(l));
    return latency(picks.map(toSuggestion), 0);
  },

  /** Nearest seeded locality to a GPS fix, with the distance we had to travel. */
  async nearest(lat: number, lng: number): Promise<{ locality: Locality; distanceKm: number } | null> {
    const candidates = LOCALITIES.filter((l) => l.kind !== 'city');
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
    const pins = LOCALITIES.filter((l) => l.kind !== 'city').map((locality) => {
      const results = resolveArea(locality, PLATFORMS, COVERAGE, BY_ID, reports);
      return {
        locality,
        available: results.filter((r) => r.status === 'available').length,
        total: results.length,
      };
    });
    return latency(pins, 60);
  },

  async getArea(localityId: string): Promise<AreaResult | null> {
    const locality = BY_ID.get(localityId);
    if (!locality) return latency(null, 60);

    return latency({
      locality,
      breadcrumb: breadcrumbFor(locality),
      results: resolveArea(locality, PLATFORMS, COVERAGE, BY_ID, reportStore.all()),
      generatedAt: new Date().toISOString(),
    });
  },

  async getPlatformAt(
    localityId: string,
    platformId: string,
  ): Promise<{ locality: Locality; breadcrumb: string[]; resolved: ResolvedCoverage } | null> {
    const locality = BY_ID.get(localityId);
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (!locality || !platform) return latency(null, 60);

    return latency({
      locality,
      breadcrumb: breadcrumbFor(locality),
      resolved: resolveOne(platform, locality, COVERAGE, BY_ID, reportStore.all(), new Date()),
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
};

export type MockAdapter = typeof mockAdapter;
