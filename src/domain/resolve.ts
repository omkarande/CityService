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
}

/**
 * Walk the ladder for one platform:
 *   1. a record on this exact locality
 *   2. a record on a different locality sharing the pincode
 *   3. a record on the nearest ancestor (suburb → city)
 */
export function pickRecord(
  target: Locality,
  records: Coverage[],
  byId: Map<string, Locality>,
): Candidate | null {
  const exact = records.find((r) => r.areaId === target.id);
  if (exact) return { record: exact, path: 'exact', area: target };

  if (target.pincode) {
    const samePin = records.find((r) => {
      const area = byId.get(r.areaId);
      return area && area.id !== target.id && area.pincode === target.pincode;
    });
    if (samePin) return { record: samePin, path: 'pincode', area: byId.get(samePin.areaId) };
  }

  for (const ancestor of ancestorChain(target.id, byId)) {
    const inherited = records.find((r) => r.areaId === ancestor.id);
    if (inherited) return { record: inherited, path: 'city', area: ancestor };
  }

  return null;
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
): string | null {
  if (path === 'none') return 'No coverage data for this area yet.';
  if (disputed) return 'Recent reports disagree with this status.';
  if (path === 'pincode') return `Recorded for ${areaName}, which shares pincode ${pincode}.`;
  if (path === 'city') return `Estimated from ${areaName} data — not checked for this locality.`;
  if (stale) return 'Not checked recently — may be out of date.';
  return null;
}

export interface ResolveOptions {
  now?: Date;
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

  if (!candidate) {
    return {
      platform,
      status: 'unknown',
      confidence: 0,
      tier: 'unconfirmed',
      resolvedFrom: 'none',
      resolvedAreaName: null,
      lastVerifiedAt: null,
      source: null,
      caveat: buildCaveat('none', null, null, false, false),
    };
  }

  const { record, path, area } = candidate;
  const merged = mergeReports(record, reports, target.id);

  /*
   * Once someone reports from the locality itself we hold direct evidence
   * about it, so the inheritance penalty no longer applies — the answer is
   * about this place now, not borrowed from a neighbour.
   */
  const hasLocalEvidence = reportsFor(reports, platform.id, target.id).length > 0;
  const effectivePath: ResolutionPath = hasLocalEvidence ? 'exact' : path;
  const effectiveArea = hasLocalEvidence ? target : area;

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

  return {
    platform,
    status: record.status,
    confidence,
    tier: tierFor(confidence),
    resolvedFrom: effectivePath,
    resolvedAreaName: effectiveArea?.name ?? null,
    lastVerifiedAt: merged.lastVerifiedAt,
    source: merged.source,
    details: record.details,
    caveat: buildCaveat(
      effectivePath,
      effectiveArea?.name ?? null,
      effectiveArea?.pincode ?? null,
      disputed,
      stale,
    ),
  };
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
