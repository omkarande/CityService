import { describe, expect, it } from 'vitest';
import type { Coverage, Locality, Platform, UserReport } from '../api/types';
import { ancestorChain, mergeReports, resolveArea, resolveOne } from './resolve';
import localitiesJson from '../data/localities.pune.json';
import platformsJson from '../data/platforms.json';
import coverageJson from '../data/coverage.seed.json';

const NOW = new Date('2026-08-12T00:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

// --------------------------------------------------------------- fixtures

const CITY: Locality = {
  id: 'city',
  name: 'Metropolis',
  aliases: [],
  kind: 'city',
  parentId: null,
  pincode: null,
  city: 'Metropolis',
  state: 'State',
  center: { lat: 0, lng: 0 },
};

const SUBURB: Locality = { ...CITY, id: 'suburb', name: 'Suburb', kind: 'suburb', parentId: 'city', pincode: '111111' };
const TARGET: Locality = { ...CITY, id: 'target', name: 'Target', kind: 'village', parentId: 'suburb', pincode: '111111' };
const SIBLING: Locality = { ...CITY, id: 'sibling', name: 'Sibling', kind: 'village', parentId: 'suburb', pincode: '111111' };

const BY_ID = new Map([CITY, SUBURB, TARGET, SIBLING].map((l) => [l.id, l]));

const PLATFORM: Platform = {
  id: 'p1',
  name: 'Platform One',
  categoryId: 'ride-hailing',
  brandColor: '#000',
  initials: 'P1',
  website: 'https://example.com',
};

const record = (areaId: string, over: Partial<Coverage> = {}): Coverage => ({
  platformId: 'p1',
  areaId,
  status: 'available',
  source: 'seed',
  lastVerifiedAt: daysAgo(1),
  evidence: { positive: 5, negative: 0 },
  ...over,
});

const resolve = (coverage: Coverage[], reports: UserReport[] = []) =>
  resolveOne(PLATFORM, TARGET, coverage, BY_ID, reports, NOW);

// ------------------------------------------------------------------ tests

describe('ancestorChain', () => {
  it('walks parents nearest-first', () => {
    expect(ancestorChain('target', BY_ID).map((l) => l.id)).toEqual(['suburb', 'city']);
  });

  it('returns nothing for a root city', () => {
    expect(ancestorChain('city', BY_ID)).toEqual([]);
  });

  it('survives a cyclic parent reference', () => {
    const a: Locality = { ...CITY, id: 'a', parentId: 'b' };
    const b: Locality = { ...CITY, id: 'b', parentId: 'a' };
    const cyclic = new Map([
      ['a', a],
      ['b', b],
    ]);
    expect(ancestorChain('a', cyclic).length).toBeLessThanOrEqual(2);
  });
});

describe('the fallback ladder', () => {
  it('prefers an exact record over everything else', () => {
    const result = resolve([record('city'), record('sibling'), record('target')]);
    expect(result.resolvedFrom).toBe('exact');
    expect(result.resolvedAreaName).toBe('Target');
    expect(result.caveat).toBeNull();
  });

  it('falls back to a locality sharing the pincode', () => {
    const result = resolve([record('city'), record('sibling')]);
    expect(result.resolvedFrom).toBe('pincode');
    expect(result.resolvedAreaName).toBe('Sibling');
    expect(result.caveat).toContain('111111');
  });

  it('falls back to the nearest ancestor last', () => {
    const result = resolve([record('city')]);
    expect(result.resolvedFrom).toBe('city');
    expect(result.resolvedAreaName).toBe('Metropolis');
    expect(result.caveat).toContain('Estimated from');
  });

  it('prefers a nearer ancestor over a further one', () => {
    const result = resolve([record('city'), record('suburb')]);
    expect(result.resolvedAreaName).toBe('Suburb');
  });

  it('reports unknown when it holds nothing at all', () => {
    const result = resolve([]);
    expect(result.status).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.resolvedFrom).toBe('none');
    expect(result.tier).toBe('unconfirmed');
  });

  it('degrades confidence with each rung', () => {
    const exact = resolve([record('target')]).confidence;
    const pincode = resolve([record('sibling')]).confidence;
    const city = resolve([record('city')]).confidence;
    expect(exact).toBeGreaterThan(pincode);
    expect(pincode).toBeGreaterThan(city);
  });
});

describe('trust invariants', () => {
  it('never marks a city-level guess as verified, even with perfect data', () => {
    const perfect = record('city', {
      source: 'official',
      lastVerifiedAt: daysAgo(0),
      evidence: { positive: 500, negative: 0 },
    });
    const result = resolve([perfect]);
    expect(result.resolvedFrom).toBe('city');
    expect(result.tier).not.toBe('verified');
  });

  it('never marks uncorroborated placeholder data as verified', () => {
    const placeholder = record('target', {
      source: 'seed-placeholder',
      lastVerifiedAt: daysAgo(0),
      evidence: { positive: 500, negative: 0 },
    });
    expect(resolve([placeholder]).tier).not.toBe('verified');
  });

  it('lets real user reports lift a placeholder past the ceiling', () => {
    const placeholder = record('target', {
      source: 'seed-placeholder',
      lastVerifiedAt: daysAgo(30),
      evidence: { positive: 3, negative: 0 },
    });
    const reports: UserReport[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      platformId: 'p1',
      areaId: 'target',
      verdict: 'works',
      reportedAt: daysAgo(0),
      atLocation: true,
      reporterId: `u${i}`,
    }));

    const before = resolve([placeholder]);
    const after = resolve([placeholder], reports);

    expect(after.confidence).toBeGreaterThan(before.confidence);
    expect(after.source).toBe('user-report');
    expect(after.tier).toBe('verified');
  });

  it('promotes an inherited row once someone reports from the locality itself', () => {
    const inherited = record('city', { source: 'seed-placeholder', evidence: { positive: 4, negative: 0 } });
    const localReport: UserReport = {
      id: 'r1',
      platformId: 'p1',
      areaId: 'target',
      verdict: 'works',
      reportedAt: daysAgo(0),
      atLocation: true,
      reporterId: 'u1',
    };

    const before = resolve([inherited]);
    const after = resolve([inherited], [localReport]);

    expect(before.resolvedFrom).toBe('city');
    expect(after.resolvedFrom).toBe('exact');
    expect(after.resolvedAreaName).toBe('Target');
    expect(after.caveat).toBeNull();
    expect(after.confidence).toBeGreaterThan(before.confidence);
  });

  it('flags a record the crowd contradicts', () => {
    const contested = record('target', { evidence: { positive: 1, negative: 9 } });
    expect(resolve([contested]).caveat).toContain('disagree');
  });

  it('warns when an exact record has gone stale', () => {
    const old = record('target', { lastVerifiedAt: daysAgo(400) });
    expect(resolve([old]).caveat).toContain('out of date');
  });
});

describe('mergeReports', () => {
  const base = record('target', { status: 'unavailable', evidence: { positive: 2, negative: 0 } });

  const report = (verdict: UserReport['verdict'], atLocation = false): UserReport => ({
    id: 'r',
    platformId: 'p1',
    areaId: 'target',
    verdict,
    reportedAt: daysAgo(0),
    atLocation,
    reporterId: 'u',
  });

  it('counts evidence against the recorded status, not against availability', () => {
    // The record says "unavailable", so a "not-working" report corroborates it.
    const merged = mergeReports(base, [report('not-working')], 'target');
    expect(merged.evidence).toEqual({ positive: 3, negative: 0 });
  });

  it('counts a contradicting report as negative', () => {
    const merged = mergeReports(base, [report('works')], 'target');
    expect(merged.evidence).toEqual({ positive: 2, negative: 1 });
  });

  it('double-weights reports made from inside the area', () => {
    const merged = mergeReports(base, [report('not-working', true)], 'target');
    expect(merged.evidence).toEqual({ positive: 4, negative: 0 });
  });

  it('ignores reports for other platforms or areas', () => {
    const merged = mergeReports(
      base,
      [
        { ...report('works'), platformId: 'other' },
        { ...report('works'), areaId: 'elsewhere' },
      ],
      'target',
    );
    expect(merged.evidence).toEqual(base.evidence);
  });

  it('attaches reports made about the asked-for area to an inherited record', () => {
    const inherited = record('city', { status: 'available', evidence: { positive: 4, negative: 0 } });
    const merged = mergeReports(inherited, [report('works')], 'target');
    expect(merged.evidence).toEqual({ positive: 5, negative: 0 });
  });

  it('leaves a non-placeholder source alone', () => {
    expect(mergeReports(record('target', { source: 'official' }), [report('works')], 'target').source).toBe(
      'official',
    );
  });
});

describe('resolveArea ordering', () => {
  it('puts usable answers first and unknowns last', () => {
    const platforms: Platform[] = [
      { ...PLATFORM, id: 'unknown-one', name: 'Unknown' },
      { ...PLATFORM, id: 'gone', name: 'Gone' },
      { ...PLATFORM, id: 'works', name: 'Works' },
    ];
    const coverage: Coverage[] = [
      { ...record('target'), platformId: 'gone', status: 'unavailable' },
      { ...record('target'), platformId: 'works', status: 'available' },
    ];

    const order = resolveArea(TARGET, platforms, coverage, BY_ID, [], { now: NOW }).map((r) => r.platform.id);
    expect(order).toEqual(['works', 'gone', 'unknown-one']);
  });
});

// ------------------------------------------------- against the real seed data

describe('Shinde Vasti (seed data)', () => {
  const localities = localitiesJson as unknown as Locality[];
  const byId = new Map(localities.map((l) => [l.id, l]));
  const platforms = platformsJson as unknown as Platform[];
  const coverage = (coverageJson as { records: unknown[] }).records as Coverage[];
  const target = byId.get('pune-chikhali-shinde-vasti')!;

  const results = resolveArea(target, platforms, coverage, byId, [], { now: NOW });
  const find = (id: string) => results.find((r) => r.platform.id === id)!;

  it('returns a row for every platform', () => {
    expect(results).toHaveLength(platforms.length);
  });

  it('uses the exact record for Uber', () => {
    expect(find('uber').resolvedFrom).toBe('exact');
    expect(find('uber').status).toBe('available');
  });

  it('inherits Zomato from Chikhali via the shared pincode', () => {
    expect(find('zomato').resolvedFrom).toBe('pincode');
    expect(find('zomato').resolvedAreaName).toBe('Chikhali');
  });

  it('falls back to Pune city for Ola', () => {
    expect(find('ola').resolvedFrom).toBe('city');
    expect(find('ola').resolvedAreaName).toBe('Pune');
  });

  it('knows Zepto does not deliver here', () => {
    expect(find('zepto').status).toBe('unavailable');
    expect(find('zepto').resolvedFrom).toBe('exact');
  });

  it('marks nothing as verified, because it is all placeholder data', () => {
    expect(results.every((r) => r.tier !== 'verified')).toBe(true);
  });

  it('exercises all three ladder rungs on one screen', () => {
    const paths = new Set(results.map((r) => r.resolvedFrom));
    expect(paths).toContain('exact');
    expect(paths).toContain('pincode');
    expect(paths).toContain('city');
  });
});
