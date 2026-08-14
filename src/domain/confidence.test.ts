import { describe, expect, it } from 'vitest';
import {
  HALF_LIFE_DAYS,
  PLACEHOLDER_CEILING,
  TIER_THRESHOLDS,
  agreementRatio,
  crowdLift,
  isDisputed,
  recencyFactor,
  scoreConfidence,
  tierFor,
} from './confidence';

const NOW = new Date('2026-08-12T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('recencyFactor', () => {
  it('is 1 for a claim verified today', () => {
    expect(recencyFactor(daysAgo(0), 'quick-commerce', NOW)).toBeCloseTo(1, 5);
  });

  it('is exactly 0.5 at one half-life', () => {
    const halfLife = HALF_LIFE_DAYS['quick-commerce'];
    expect(recencyFactor(daysAgo(halfLife), 'quick-commerce', NOW)).toBeCloseTo(0.5, 5);
  });

  it('decays quick-commerce faster than ecommerce', () => {
    const quick = recencyFactor(daysAgo(90), 'quick-commerce', NOW);
    const shopping = recencyFactor(daysAgo(90), 'ecommerce', NOW);
    expect(quick).toBeLessThan(shopping);
  });
});

describe('agreementRatio', () => {
  it('treats no evidence as a coin flip', () => {
    expect(agreementRatio({ positive: 0, negative: 0 })).toBe(0.5);
  });

  it('does not treat a single report as certainty', () => {
    expect(agreementRatio({ positive: 1, negative: 0 })).toBeLessThan(0.7);
  });

  it('approaches 1 with unanimous volume', () => {
    expect(agreementRatio({ positive: 50, negative: 0 })).toBeGreaterThan(0.95);
  });
});

describe('crowdLift', () => {
  it('is neutral with no reports', () => {
    expect(crowdLift({ positive: 0, negative: 0 })).toBe(0);
  });

  it('never exceeds ±0.5', () => {
    expect(crowdLift({ positive: 100, negative: 0 })).toBeLessThanOrEqual(0.5);
    expect(crowdLift({ positive: 0, negative: 100 })).toBeGreaterThanOrEqual(-0.5);
  });

  it('drags confidence down when the crowd disagrees', () => {
    expect(crowdLift({ positive: 1, negative: 9 })).toBeLessThan(0);
  });
});

describe('isDisputed', () => {
  it('ignores thin evidence', () => {
    expect(isDisputed({ positive: 0, negative: 2 })).toBe(false);
  });

  it('flags a contested record', () => {
    expect(isDisputed({ positive: 2, negative: 8 })).toBe(true);
  });

  it('does not flag agreement', () => {
    expect(isDisputed({ positive: 9, negative: 1 })).toBe(false);
  });
});

describe('scoreConfidence', () => {
  const base = {
    evidence: { positive: 10, negative: 0 },
    lastVerifiedAt: daysAgo(1),
    categoryId: 'ride-hailing' as const,
    path: 'exact' as const,
    now: NOW,
  };

  it('rewards official, fresh, corroborated data', () => {
    expect(scoreConfidence({ ...base, source: 'official' })).toBeGreaterThan(TIER_THRESHOLDS.verified);
  });

  it('holds placeholder data below the verified threshold, however good it looks', () => {
    const score = scoreConfidence({ ...base, source: 'seed-placeholder' });
    expect(score).toBeLessThanOrEqual(PLACEHOLDER_CEILING);
    expect(tierFor(score)).not.toBe('verified');
  });

  it('returns zero when nothing resolved', () => {
    expect(scoreConfidence({ ...base, source: 'official', path: 'none' })).toBe(0);
  });

  it('penalises each rung down the ladder', () => {
    const exact = scoreConfidence({ ...base, source: 'official', path: 'exact' });
    const pincode = scoreConfidence({ ...base, source: 'official', path: 'pincode' });
    const city = scoreConfidence({ ...base, source: 'official', path: 'city' });
    expect(exact).toBeGreaterThan(pincode);
    expect(pincode).toBeGreaterThan(city);
  });

  it('never exceeds 1', () => {
    const score = scoreConfidence({
      ...base,
      source: 'official',
      evidence: { positive: 1000, negative: 0 },
    });
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('tierFor', () => {
  it('buckets on the documented thresholds', () => {
    expect(tierFor(0.95)).toBe('verified');
    expect(tierFor(TIER_THRESHOLDS.verified)).toBe('verified');
    expect(tierFor(TIER_THRESHOLDS.verified - 0.01)).toBe('likely');
    expect(tierFor(TIER_THRESHOLDS.likely)).toBe('likely');
    expect(tierFor(TIER_THRESHOLDS.likely - 0.01)).toBe('unconfirmed');
    expect(tierFor(0)).toBe('unconfirmed');
  });
});
