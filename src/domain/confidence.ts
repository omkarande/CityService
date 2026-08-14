/**
 * Confidence scoring.
 *
 * Pure functions, no I/O, no React — this module moves to the server unchanged
 * when the backend lands. See ARCHITECTURE.md §3.
 */

import type { CategoryId, ConfidenceTier, ResolutionPath, SourceKind } from '../api/types';

/**
 * How fast a claim goes stale, by category. Quick-commerce radii move every
 * few weeks; Amazon's serviceability barely moves in a year.
 */
export const HALF_LIFE_DAYS: Record<CategoryId, number> = {
  'quick-commerce': 60,
  'food-delivery': 90,
  grocery: 120,
  'ride-hailing': 180,
  'bike-taxi': 180,
  courier: 180,
  'home-services': 180,
  pharmacy: 180,
  ecommerce: 365,
};

export const SOURCE_WEIGHT: Record<SourceKind, number> = {
  official: 1.0,
  probe: 0.8,
  seed: 0.6,
  'user-report': 0.5,
  'seed-placeholder': 0.45,
};

/** Cost of each rung we drop down the fallback ladder. */
export const LADDER_MULTIPLIER: Record<ResolutionPath, number> = {
  exact: 1.0,
  polygon: 0.9,
  pincode: 0.8,
  city: 0.45,
  none: 0,
};

export const TIER_THRESHOLDS = { verified: 0.7, likely: 0.4 } as const;

/**
 * Invented seed data must never read as authoritative. It can reach "likely"
 * (so the UI is demonstrable) but is held just below the verified threshold.
 * Once real user reports corroborate a placeholder, the resolver swaps the
 * effective source to `user-report` and this ceiling stops applying.
 */
export const PLACEHOLDER_CEILING = 0.69;

/** Reports needed before crowd agreement counts at full strength. */
const VOLUME_SATURATION = 5;

export interface Evidence {
  positive: number;
  negative: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function daysBetween(from: string | Date, to: Date): number {
  const start = typeof from === 'string' ? new Date(from) : from;
  return Math.max(0, (to.getTime() - start.getTime()) / 86_400_000);
}

/** Exponential decay: exactly 0.5 at one half-life. */
export function recencyFactor(lastVerifiedAt: string, categoryId: CategoryId, now: Date): number {
  const halfLife = HALF_LIFE_DAYS[categoryId] ?? 180;
  return Math.pow(2, -daysBetween(lastVerifiedAt, now) / halfLife);
}

/** Laplace-smoothed, so 1-of-1 doesn't read as certainty. */
export function agreementRatio({ positive, negative }: Evidence): number {
  return (positive + 1) / (positive + negative + 2);
}

export function volumeFactor({ positive, negative }: Evidence): number {
  return Math.min(1, (positive + negative) / VOLUME_SATURATION);
}

/**
 * What the crowd adds to (or takes from) the source's base trust.
 * Ranges -0.5..+0.5: unanimous agreement at volume lifts, disagreement drags.
 */
export function crowdLift(evidence: Evidence): number {
  return 0.5 * volumeFactor(evidence) * (2 * agreementRatio(evidence) - 1);
}

/** Enough people disagree with the recorded status that we should say so. */
export function isDisputed(evidence: Evidence): boolean {
  return evidence.positive + evidence.negative >= 3 && agreementRatio(evidence) < 0.5;
}

export interface ScoreInput {
  source: SourceKind;
  evidence: Evidence;
  lastVerifiedAt: string;
  categoryId: CategoryId;
  path: ResolutionPath;
  now: Date;
}

export function scoreConfidence(input: ScoreInput): number {
  const ladder = LADDER_MULTIPLIER[input.path];
  if (ladder === 0) return 0;

  const weight = clamp(SOURCE_WEIGHT[input.source] + crowdLift(input.evidence), 0.1, 1);
  const recency = recencyFactor(input.lastVerifiedAt, input.categoryId, input.now);

  let confidence = weight * recency * ladder;
  if (input.source === 'seed-placeholder') {
    confidence = Math.min(confidence, PLACEHOLDER_CEILING);
  }
  return Math.round(clamp(confidence, 0, 1) * 1000) / 1000;
}

export function tierFor(confidence: number): ConfidenceTier {
  if (confidence >= TIER_THRESHOLDS.verified) return 'verified';
  if (confidence >= TIER_THRESHOLDS.likely) return 'likely';
  return 'unconfirmed';
}
