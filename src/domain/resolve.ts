/**
 * The fallback ladder: given a locality and a platform, find the best coverage
 * claim we hold and say how much of a stretch it was to apply it here.
 *
 * Pure functions — server-portable. See ARCHITECTURE.md §3.
 */

import type {
  Coverage,
  CoverageStatus,
  Locality,
  Platform,
  ResolutionPath,
  ResolvedCoverage,
  SourceKind,
  UserReport,
} from '../api/types';
import {
  Evidence,
  HALF_LIFE_DAYS,
  daysBetween,
  isDisputed,
  scoreConfidence,
  tierFor,
} from './confidence';
import { EXACT_KM, GENERAL_KM, NEARBY_KM, SHOW_ORIGIN_KM, formatOffset, haversineKm } from './geo';

/** Sort order on the results list: useful answers first, "no idea" last. */
const STATUS_RANK: Record<CoverageStatus, number> = {
  available: 0,
  partial: 1,
  unavailable: 2,
  unknown: 3,
};

/** Does a "works" report agree with this recorded status? */
const statusIsPositive = (status: CoverageStatus) => status === 'available' || status === 'partial';

/** Parent chain, nearest first, excluding the locality itself. */
export function ancestorChain(localityId: string, byId: Map<string, Locality>): Locality[] {
  const chain: Locality[] = [];
  const seen = new Set<string>([localityId]);
  let current = byId.get(localityId)?.parentId ?? null;

  while (current && !seen.has(current)) {
    const parent = byId.get(current);
    if (!parent) break;
    chain.push(parent);
    seen.add(current);
    current = parent.parentId;
  }
  return chain;
}

interface Candidate {
  record: Coverage;
  path: ResolutionPath;
  area: Locality | undefined;
  distanceKm: number | null;
}

function isLiveCheck(source: SourceKind): boolean {
  return source === 'probe' || source === 'official';
}

function isSpecificPlace(area: Locality): boolean {
  return area.kind !== 'city' && area.kind !== 'suburb';
}

/** Nearest village / building / GPS / pincode with any coverage, within maxKm. */
function nearestSpecific(
  origin: Locality['center'],
  records: Coverage[],
  byId: Map<string, Locality>,
  maxKm: number,
  excludeId?: string,
): { record: Coverage; area: Locality; distanceKm: number } | null {
  let best: { record: Coverage; area: Locality; distanceKm: number } | null = null;
  for (const record of records) {
    const area = byId.get(record.areaId);
    if (!area || area.id === excludeId || !isSpecificPlace(area)) continue;
    const distanceKm = haversineKm(origin, area.center);
    if (distanceKm > maxKm) continue;
    const live = isLiveCheck(record.source);
    const bestLive = best ? isLiveCheck(best.record.source) : false;
    if (
      !best ||
      distanceKm < best.distanceKm - 0.005 ||
      (Math.abs(distanceKm - best.distanceKm) <= 0.005 && live && !bestLive)
    ) {
      best = { record, area, distanceKm };
    }
  }
  return best;
}

function nearestGeneral(
  origin: Locality['center'],
  records: Coverage[],
  byId: Map<string, Locality>,
): { record: Coverage; area: Locality; distanceKm: number } | null {
  let best: { record: Coverage; area: Locality; distanceKm: number } | null = null;
  for (const record of records) {
    const area = byId.get(record.areaId);
    if (!area || (area.kind !== 'suburb' && area.kind !== 'city')) continue;
    const distanceKm = haversineKm(origin, area.center);
    if (distanceKm > GENERAL_KM) continue;
    if (!best || distanceKm < best.distanceKm) best = { record, area, distanceKm };
  }
  return best;
}

/**
 * Walk the ladder for one platform at a known locality:
 *   1. a record on this exact locality
 *   2. a specific DB place with coverage within 3 km
 *   3. a record on a different locality sharing the pincode
 *   4. a record on the nearest ancestor (suburb → city)
 */
export function pickRecord(
  target: Locality,
  records: Coverage[],
  byId: Map<string, Locality>,
): Candidate | null {
  const exact = records.find((r) => r.areaId === target.id);
  if (exact) return { record: exact, path: 'exact', area: target, distanceKm: 0 };

  const nearby = nearestSpecific(target.center, records, byId, NEARBY_KM, target.id);
  if (nearby) return { record: nearby.record, path: 'nearby', area: nearby.area, distanceKm: nearby.distanceKm };

  if (target.pincode) {
    const samePin = records.find((r) => {
      const area = byId.get(r.areaId);
      return area && area.id !== target.id && area.pincode === target.pincode;
    });
    if (samePin) {
      const area = byId.get(samePin.areaId);
      return {
        record: samePin,
        path: 'pincode',
        area,
        distanceKm: area ? haversineKm(target.center, area.center) : null,
      };
    }
  }

  for (const ancestor of ancestorChain(target.id, byId)) {
    const inherited = records.find((r) => r.areaId === ancestor.id);
    if (inherited) {
      return {
        record: inherited,
        path: 'city',
        area: ancestor,
        distanceKm: haversineKm(target.center, ancestor.center),
      };
    }
  }

  return null;
}

/**
 * Answer from a GPS / geocoded point that may not be a saved locality.
 *   1. specific DB place within 150 m → this place (confidence); still name it if the pin is offset
 *   2. specific DB place within 3 km → nearby real data
 *   3. suburb/city record within 15 km → general area
 */
export function pickRecordFromPoint(
  origin: Locality['center'],
  records: Coverage[],
  byId: Map<string, Locality>,
): Candidate | null {
  const here = nearestSpecific(origin, records, byId, EXACT_KM);
  if (here) return { record: here.record, path: 'exact', area: here.area, distanceKm: here.distanceKm };

  const nearby = nearestSpecific(origin, records, byId, NEARBY_KM);
  if (nearby) return { record: nearby.record, path: 'nearby', area: nearby.area, distanceKm: nearby.distanceKm };

  const general = nearestGeneral(origin, records, byId);
  if (general) return { record: general.record, path: 'city', area: general.area, distanceKm: general.distanceKm };

  return null;
}

export function queryLocality(origin: Locality['center'], name: string, city = '', state = ''): Locality {
  const safeLat = origin.lat.toFixed(5);
  const safeLng = origin.lng.toFixed(5);
  return {
    id: `at-${safeLat}-${safeLng}`,
    name,
    aliases: [],
    kind: 'locality',
    parentId: null,
    pincode: null,
    city: city || '',
    state: state || '',
    center: origin,
  };
}

/** Title stays the searched name; breadcrumb is reverse-geocode context (road, Ravet, Pune). */
export function describeAtPlace(
  origin: Locality['center'],
  geo: { name: string; city: string; state: string },
  searchedName?: string,
): { locality: Locality; breadcrumb: string[] } {
  const name = searchedName?.trim() || geo.name || 'Pinned location';
  const locality = queryLocality(origin, name, geo.city, geo.state);
  const breadcrumb = [geo.name, geo.city, geo.state]
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index)
    .filter((part) => part.toLowerCase() !== name.toLowerCase());
  return { locality, breadcrumb };
}

/** Reports about a given platform at a given area. */
export function reportsFor(reports: UserReport[], platformId: string, areaId: string): UserReport[] {
  return reports.filter((r) => r.platformId === platformId && r.areaId === areaId);
}

/**
 * Fold user reports into a record's evidence.
 *
 * Reports are matched against `targetAreaId` — the locality the user actually
 * asked about — not against the area the record happens to live on. Someone
 * standing in Shinde Vasti is giving evidence about Shinde Vasti even when the
 * displayed status was inherited from Chikhali.
 *
 * Reports made from inside the area count double. Crucially, once a
 * placeholder record has real reports attached, its effective source stops
 * being `seed-placeholder` — real humans now carry the claim, so the
 * placeholder confidence ceiling no longer applies.
 */
export function mergeReports(
  record: Coverage,
  reports: UserReport[],
  targetAreaId: string,
): { evidence: Evidence; source: SourceKind; lastVerifiedAt: string } {
  const relevant = reportsFor(reports, record.platformId, targetAreaId);
  if (relevant.length === 0) {
    return { evidence: record.evidence, source: record.source, lastVerifiedAt: record.lastVerifiedAt };
  }

  const positiveStatus = statusIsPositive(record.status);
  let positive = record.evidence.positive;
  let negative = record.evidence.negative;
  let latest = record.lastVerifiedAt;

  for (const report of relevant) {
    const weight = report.atLocation ? 2 : 1;
    const agrees = (report.verdict === 'works') === positiveStatus;
    if (agrees) positive += weight;
    else negative += weight;
    if (report.reportedAt > latest) latest = report.reportedAt;
  }

  return {
    evidence: { positive, negative },
    source: record.source === 'seed-placeholder' ? 'user-report' : record.source,
    lastVerifiedAt: latest,
  };
}

function buildCaveat(
  path: ResolutionPath,
  areaName: string | null,
  pincode: string | null,
  disputed: boolean,
  stale: boolean,
  distanceKm: number | null,
): string | null {
  if (path === 'none') return 'No coverage data for this area yet.';
  if (disputed) return 'Recent reports disagree with this status.';
  const borrowed = areaName && distanceKm != null && distanceKm >= SHOW_ORIGIN_KM;
  if ((path === 'nearby' || path === 'exact') && borrowed) {
    return `Real data checked ${formatOffset(distanceKm)} away (${areaName})`;
  }
  if (path === 'nearby' && areaName) {
    return `Real data checked ${formatOffset(distanceKm ?? 0)} away (${areaName})`;
  }
  if (path === 'pincode') return `Recorded for ${areaName}, which shares pincode ${pincode}.`;
  if (path === 'city') return `General area data (${areaName})`;
  if (stale) return 'Not checked recently. May be out of date.';
  return null;
}

export interface ResolveOptions {
  now?: Date;
}

function unknownResult(platform: Platform): ResolvedCoverage {
  return {
    platform,
    status: 'unknown',
    confidence: 0,
    tier: 'unconfirmed',
    resolvedFrom: 'none',
    resolvedAreaName: null,
    resolvedAreaId: null,
    distanceKm: null,
    lastVerifiedAt: null,
    source: null,
    caveat: buildCaveat('none', null, null, false, false, null),
  };
}

function finalize(
  platform: Platform,
  candidate: Candidate,
  reports: UserReport[],
  asked: Locality | null,
  now: Date,
): ResolvedCoverage {
  const askedAreaId = asked?.id ?? '';
  const { record, path, area, distanceKm } = candidate;
  const merged = mergeReports(record, reports, askedAreaId);
  const hasLocalEvidence = asked ? reportsFor(reports, platform.id, asked.id).length > 0 : false;
  const effectivePath: ResolutionPath = hasLocalEvidence ? 'exact' : path;
  const effectiveArea = hasLocalEvidence && asked ? asked : area;

  const confidence = scoreConfidence({
    source: merged.source,
    evidence: merged.evidence,
    lastVerifiedAt: merged.lastVerifiedAt,
    categoryId: platform.categoryId,
    path: effectivePath,
    now,
  });

  const disputed = isDisputed(merged.evidence);
  const stale = daysBetween(merged.lastVerifiedAt, now) > HALF_LIFE_DAYS[platform.categoryId];

  const borrowed = distanceKm != null && distanceKm >= SHOW_ORIGIN_KM;

  return {
    platform,
    status: record.status,
    confidence,
    tier: tierFor(confidence),
    resolvedFrom: effectivePath,
    resolvedAreaName: effectiveArea?.name ?? null,
    resolvedAreaId: effectiveArea?.id ?? null,
    distanceKm: effectivePath === 'exact' && !borrowed ? 0 : distanceKm,
    lastVerifiedAt: merged.lastVerifiedAt,
    source: merged.source,
    details: record.details,
    caveat: buildCaveat(
      effectivePath,
      effectiveArea?.name ?? null,
      effectiveArea?.pincode ?? null,
      disputed,
      stale,
      distanceKm,
    ),
  };
}

export function resolveOne(
  platform: Platform,
  target: Locality,
  coverage: Coverage[],
  byId: Map<string, Locality>,
  reports: UserReport[],
  now: Date,
): ResolvedCoverage {
  const candidate = pickRecord(
    target,
    coverage.filter((c) => c.platformId === platform.id),
    byId,
  );
  if (!candidate) return unknownResult(platform);
  return finalize(platform, candidate, reports, target, now);
}

export function resolveOneFromPoint(
  platform: Platform,
  origin: Locality['center'],
  coverage: Coverage[],
  byId: Map<string, Locality>,
  reports: UserReport[],
  now: Date,
): ResolvedCoverage {
  const candidate = pickRecordFromPoint(
    origin,
    coverage.filter((c) => c.platformId === platform.id),
    byId,
  );
  if (!candidate) return unknownResult(platform);
  return finalize(platform, candidate, reports, null, now);
}

export function resolveArea(
  target: Locality,
  platforms: Platform[],
  coverage: Coverage[],
  byId: Map<string, Locality>,
  reports: UserReport[],
  options: ResolveOptions = {},
): ResolvedCoverage[] {
  const now = options.now ?? new Date();

  return platforms
    .map((platform) => resolveOne(platform, target, coverage, byId, reports, now))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.confidence - a.confidence ||
        a.platform.name.localeCompare(b.platform.name),
    );
}

export function resolveAreaFromPoint(
  origin: Locality['center'],
  platforms: Platform[],
  coverage: Coverage[],
  byId: Map<string, Locality>,
  reports: UserReport[],
  options: ResolveOptions = {},
): ResolvedCoverage[] {
  const now = options.now ?? new Date();

  return platforms
    .map((platform) => resolveOneFromPoint(platform, origin, coverage, byId, reports, now))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.confidence - a.confidence ||
        a.platform.name.localeCompare(b.platform.name),
    );
}
