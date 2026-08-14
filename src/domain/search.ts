/**
 * Locality search. Deliberately simple and dependency-free: name, alias and
 * pincode matching with a relevance score. Swap for a real index server-side
 * once the dataset outgrows a single city.
 */

import type { Locality, LocalitySuggestion } from '../api/types';
import { ancestorChain } from './resolve';

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining accents
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ') // keep latin, digits, devanagari
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(haystack: string, needle: string, weights: [number, number, number]): number {
  const h = normalize(haystack);
  if (!h) return 0;
  if (h === needle) return weights[0];
  if (h.startsWith(needle)) return weights[1];
  if (h.includes(needle)) return weights[2];
  // Match against any word boundary: "vasti" should find "Shinde Vasti".
  if (h.split(' ').some((word) => word.startsWith(needle))) return weights[2] - 5;
  return 0;
}

/**
 * "Chikhali · Pune · 411062" — always rendered under the name, because
 * several localities across Maharashtra share a name.
 */
export function buildContext(locality: Locality, byId: Map<string, Locality>): string {
  const parents = ancestorChain(locality.id, byId).map((a) => a.name);
  const parts = [...parents];
  if (!parts.includes(locality.city) && locality.city !== locality.name) parts.push(locality.city);
  if (locality.pincode) parts.push(locality.pincode);
  return parts.join(' · ');
}

export function searchLocalities(
  query: string,
  localities: Locality[],
  byId: Map<string, Locality>,
  limit = 8,
): LocalitySuggestion[] {
  const needle = normalize(query);
  if (needle.length < 2) return [];

  const scored: LocalitySuggestion[] = [];

  for (const locality of localities) {
    let score = matchScore(locality.name, needle, [100, 80, 60]);

    for (const alias of locality.aliases) {
      score = Math.max(score, matchScore(alias, needle, [90, 70, 50]));
    }

    if (locality.pincode) {
      score = Math.max(score, matchScore(locality.pincode, needle, [85, 55, 30]));
    }

    // A locality is a weak match for its own city name, so "Pune" surfaces
    // the city itself first and its suburbs underneath.
    if (locality.city !== locality.name) {
      score = Math.max(score, matchScore(locality.city, needle, [25, 20, 10]));
    }

    if (score > 0) {
      scored.push({ locality, context: buildContext(locality, byId), score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.locality.name.localeCompare(b.locality.name))
    .slice(0, limit);
}
