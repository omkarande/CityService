import { describe, expect, it } from 'vitest';
import {
  catalogAreaQueries,
  geocodeQueryVariants,
  pinLabelForQuery,
  placeContext,
  splitPlaceQuery,
  tokenOverlapScore,
} from './nominatim';

describe('geocodeQueryVariants', () => {
  it('turns a comma address into a first+last Pune query', () => {
    const variants = geocodeQueryVariants('advait vihar , shinde vasti , ravet');
    expect(variants[0]).toBe('advait vihar, ravet, Pune, Maharashtra, India');
    expect(variants).toContain('shinde vasti, ravet, Pune');
    expect(variants).toContain('ravet, Pune, Maharashtra, India');
  });
});

describe('tokenOverlapScore', () => {
  it('prefers a Ravet hit over a random Vihar in Punawale', () => {
    const query = 'advait vihar, shinde vasti, ravet';
    const ravet = tokenOverlapScore(query, 'Ravet, Pimpri-Chinchwad, Pune, Maharashtra, India');
    const punawale = tokenOverlapScore(query, 'Green Vihar, Punawale, Pune, Maharashtra, India');
    expect(ravet).toBeGreaterThan(punawale);
  });
});

describe('placeContext', () => {
  it('joins unique suburb and city bits', () => {
    expect(placeContext(['Ravet', 'Ravet', 'Pune', 'Maharashtra'])).toBe('Ravet · Pune · Maharashtra');
  });
});

describe('splitPlaceQuery', () => {
  it('treats the first comma part as the shop and the rest as the area', () => {
    expect(splitPlaceQuery('mustard mart, shinde vasti, ravet')).toEqual({
      name: 'mustard mart',
      area: 'shinde vasti, ravet',
      parts: ['mustard mart', 'shinde vasti', 'ravet'],
    });
  });
});

describe('pinLabelForQuery', () => {
  it('keeps the shop name when OSM only matched the suburb', () => {
    expect(pinLabelForQuery('mustard mart, shinde vasti, ravet', 'Ravet')).toBe('Mustard Mart');
  });
});

describe('catalogAreaQueries', () => {
  it('also searches the area tail so Ravet still appears', () => {
    expect(catalogAreaQueries('mustard mart, shinde vasti, ravet')).toEqual([
      'mustard mart, shinde vasti, ravet',
      'shinde vasti, ravet',
      'ravet',
    ]);
  });
});
