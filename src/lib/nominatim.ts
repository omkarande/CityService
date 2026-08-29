/** Query helpers for catalog search and pin labels. Place lookup is Google Places. */

const STOP_TOKENS = new Set(['india', 'pune', 'maharashtra', 'the', 'and']);

export type GeocodeHit = {
  lat: number;
  lng: number;
  name: string;
  city: string;
  state: string;
};

/** One autocomplete / nearby place. Autocomplete rows may omit coords until Place Details. */
export type PlaceHit = {
  id: string;
  name: string;
  context: string;
  lat: number | null;
  lng: number | null;
  city: string;
  state: string;
};

export function splitPlaceQuery(query: string): { name: string; area: string; parts: string[] } {
  const parts = query
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  if (parts.length === 0) return { name: query.trim(), area: '', parts: [] };
  if (parts.length === 1) return { name: parts[0], area: '', parts };
  return { name: parts[0], area: parts.slice(1).join(', '), parts };
}

export function titleCasePlace(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

/** Pin label: keep "Mustard Mart" even when geocode only knows Ravet. */
export function pinLabelForQuery(query: string, hitName: string): string {
  const { name, area } = splitPlaceQuery(query);
  if (!area || !name) return hitName || titleCasePlace(query);
  const first = name.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (first.length >= 3 && hitName.toLowerCase().includes(first)) return hitName;
  return titleCasePlace(name);
}

export function catalogAreaQueries(query: string): string[] {
  const { area, parts } = splitPlaceQuery(query);
  const out: string[] = [];
  const add = (value: string) => {
    const next = value.trim();
    if (next.length < 2) return;
    if (out.some((row) => row.toLowerCase() === next.toLowerCase())) return;
    out.push(next);
  };
  add(query);
  add(area);
  if (parts.length > 0) add(parts[parts.length - 1]);
  return out;
}

export function geocodeQueryVariants(query: string): string[] {
  const cleaned = query.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const variants: string[] = [];
  const add = (value: string) => {
    const next = value.replace(/\s+/g, ' ').trim();
    if (next.length < 3) return;
    if (variants.some((existing) => existing.toLowerCase() === next.toLowerCase())) return;
    variants.push(next);
  };

  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    add(`${first}, ${last}, Pune, Maharashtra, India`);
    add(`${first}, ${last}, Pune`);
    add(`${first}, ${last}`);
    if (parts.length >= 3) {
      add(`${first}, ${parts.slice(1).join(', ')}, Pune`);
      add(`${parts[parts.length - 2]}, ${last}, Pune`);
    }
    add(`${last}, Pune, Maharashtra, India`);
    add(cleaned);
    add(last);
  } else {
    add(`${cleaned}, Pune, Maharashtra, India`);
    add(cleaned);
  }
  return variants;
}

export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

export function tokenOverlapScore(query: string, haystack: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;
  const blob = haystack.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (blob.includes(token)) score += token.length >= 5 ? 12 : 6;
  }
  const { name, area } = splitPlaceQuery(query);
  const firstWord = name.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (firstWord.length >= 4 && blob.includes(firstWord)) score += 24;
  const lastPart = (area || name).split(',').pop()?.trim().toLowerCase();
  const lastToken = lastPart?.split(/\s+/)[0];
  if (lastToken && lastToken.length >= 3 && blob.includes(lastToken)) score += 15;
  return score;
}

export function placeContext(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const next = part?.trim();
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out.join(' · ');
}
