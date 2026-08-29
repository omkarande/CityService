import { describe, expect, it } from 'vitest';
import type { Coverage, Locality } from '../api/types';
import {
  applyHubInferences,
  loadSeedCatalog,
  pincodeToLocality,
  seedCoverageMayOverwrite,
} from './seedCatalog';

const PLACE: Locality = {
  id: 'pimpri-chinchwad',
  name: 'Pimpri Chinchwad',
  aliases: [],
  kind: 'suburb',
  parentId: 'pune',
  pincode: '411018',
  city: 'Pune',
  state: 'Maharashtra',
  center: { lat: 18.6298, lng: 73.7997 },
};

describe('seedCoverageMayOverwrite', () => {
  it('never overwrites a live probe', () => {
    expect(seedCoverageMayOverwrite('probe')).toBe(false);
  });

  it('upserts placeholders and inferred seed', () => {
    expect(seedCoverageMayOverwrite('seed-placeholder')).toBe(true);
    expect(seedCoverageMayOverwrite('seed')).toBe(true);
    expect(seedCoverageMayOverwrite(undefined)).toBe(true);
  });
});

describe('pincodeToLocality', () => {
  it('skips a pincode already owned by a named locality', () => {
    expect(
      pincodeToLocality(
        { pincode: '411018', officeNames: ['Pimpri'], area: 'PCMC', lat: 18.6, lng: 73.8 },
        [PLACE],
      ),
    ).toBeNull();
  });

  it('turns an untracked centroid into a searchable pincode place', () => {
    const pin = pincodeToLocality(
      { pincode: '411001', officeNames: ['Pune', 'Ghorpuri Bazar'], area: 'PMC', lat: 18.53, lng: 73.88 },
      [PLACE],
    );
    expect(pin?.id).toBe('pin-411001');
    expect(pin?.kind).toBe('pincode');
    expect(pin?.aliases).toContain('Ghorpuri Bazar');
    expect(pin?.aliases).not.toContain('Pune');
  });
});

describe('applyHubInferences', () => {
  it('does not replace a probe with a hub ring', () => {
    const probe: Coverage = {
      platformId: 'zepto',
      areaId: PLACE.id,
      status: 'available',
      source: 'probe',
      lastVerifiedAt: '2026-08-14T00:00:00Z',
      evidence: { positive: 1, negative: 0 },
    };
    const next = applyHubInferences(
      [PLACE],
      [probe],
      [{ platformId: 'zepto', name: 'MIDC', lat: 18.632, lng: 73.803, innerKm: 2.5, edgeKm: 4.5 }],
    );
    expect(next).toHaveLength(1);
    expect(next[0].source).toBe('probe');
  });

  it('marks a nearby suburb as inferred seed when there is no probe', () => {
    const next = applyHubInferences(
      [PLACE],
      [],
      [{ platformId: 'zepto', name: 'MIDC', lat: 18.632, lng: 73.803, innerKm: 2.5, edgeKm: 4.5 }],
    );
    expect(next[0]).toMatchObject({
      platformId: 'zepto',
      areaId: PLACE.id,
      source: 'seed',
      status: 'available',
    });
  });
});

describe('loadSeedCatalog', () => {
  it('keeps named Pune places, adds gap pincodes, and preserves the Pimpri Zepto probe', () => {
    const catalog = loadSeedCatalog();
    expect(catalog.localities.some((l) => l.id === 'pimpri-chinchwad')).toBe(true);
    expect(catalog.localities.some((l) => l.id === 'pin-411001')).toBe(true);
    expect(catalog.localities.some((l) => l.id === 'pin-411018')).toBe(false);
    const zepto = catalog.coverage.find((r) => r.platformId === 'zepto' && r.areaId === 'pimpri-chinchwad');
    expect(zepto?.source).toBe('probe');
    expect(catalog.coverage.some((r) => r.source === 'seed' && r.platformId === 'zepto' && r.areaId.startsWith('pin-'))).toBe(
      true,
    );
  });
});
