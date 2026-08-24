import { describe, expect, it } from 'vitest';
import type { Locality } from '../api/types';
import localitiesJson from '../data/localities.pune.json';
import { searchLocalities } from './search';

const localities = localitiesJson as Locality[];
const byId = new Map(localities.map((l) => [l.id, l]));

describe('searchLocalities', () => {
  it('finds Ravet by name', () => {
    const hits = searchLocalities('ravet', localities, byId);
    expect(hits.some((h) => h.locality.id === 'pune-ravet')).toBe(true);
  });

  it('finds the seeded Chikhali Shinde Vasti', () => {
    const hits = searchLocalities('shinde vasti', localities, byId);
    expect(hits.some((h) => h.locality.id === 'pune-chikhali-shinde-vasti')).toBe(true);
  });

  it('does not treat Chikhali Shinde Vasti as a hit for shinde vasti, ravet', () => {
    const hits = searchLocalities('shinde vasti, ravet', localities, byId);
    expect(hits.some((h) => h.locality.id === 'pune-chikhali-shinde-vasti')).toBe(false);
  });

  it('does not treat Chikhali Shinde Vasti as a hit for shinde vasti ravet', () => {
    const hits = searchLocalities('shinde vasti ravet', localities, byId);
    expect(hits.some((h) => h.locality.id === 'pune-chikhali-shinde-vasti')).toBe(false);
  });
});
