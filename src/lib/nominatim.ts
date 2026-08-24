const UA = 'CityService/0.1 (https://github.com/omkarande/CityService)';

const STOP_TOKENS = new Set(['india', 'pune', 'maharashtra', 'the', 'and']);

/** Ignore suburb-sized Nominatim boxes so the map zooms to the pin, not half of PCMC. */
const LOOSE_BBOX_DEG = 0.03;

type NominatimReverse = {
  display_name?: string;
  address?: {
    building?: string;
    amenity?: string;
    suburb?: string;
    neighbourhood?: string;
    village?: string;
    hamlet?: string;
    road?: string;
    city?: string;
    town?: string;
    state?: string;
  };
};

type NominatimSearch = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: string[];
  address?: NominatimReverse['address'];
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export type GeocodeHit = {
  lat: number;
  lng: number;
  name: string;
  city: string;
  state: string;
  /** Nominatim order: south, north, west, east. */
  boundingBox?: [number, number, number, number];
};

/** One autocomplete / nearby place from Photon or Nominatim. */
export type PlaceHit = {
  id: string;
  name: string;
  context: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
};

async function nominatim<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function placeName(addr: NominatimReverse['address'] | undefined, fallback: string): string {
  if (!addr) return fallback;
  return (
    addr.building ||
    addr.amenity ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.village ||
    addr.hamlet ||
    addr.road ||
    addr.city ||
    addr.town ||
    fallback
  );
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ name: string; city: string; state: string }> {
  const data = await nominatim<NominatimReverse>(
    `/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=jsonv2`,
  );
  const addr = data?.address;
  return {
    name: placeName(addr, 'Pinned location'),
    city: addr?.city || addr?.town || addr?.suburb || 'Unknown',
    state: addr?.state || '',
  };
}

function parseBoundingBox(raw?: string[]): GeocodeHit['boundingBox'] {
  if (!raw || raw.length !== 4) return undefined;
  const box = raw.map(Number) as [number, number, number, number];
  if (box.some((n) => !Number.isFinite(n))) return undefined;
  return box;
}

export function isLooseBoundingBox(box?: [number, number, number, number]): boolean {
  if (!box) return false;
  const [south, north, west, east] = box;
  return north - south > LOOSE_BBOX_DEG || east - west > LOOSE_BBOX_DEG;
}

function fromHit(hit: NominatimSearch, fallback: string): GeocodeHit | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addr = hit.address;
  return {
    lat,
    lng,
    name: placeName(addr, hit.display_name.split(',')[0] || fallback),
    city: addr?.city || addr?.town || addr?.suburb || '',
    state: addr?.state || '',
    boundingBox: parseBoundingBox(hit.boundingbox),
  };
}

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

/** Pin label: keep "Mustard Mart" even when OSM only knows Ravet. */
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

async function searchIndiaRows(query: string): Promise<NominatimSearch[]> {
  const rows = await nominatim<NominatimSearch[]>(
    `/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8&countrycodes=in`,
  );
  return rows ?? [];
}

function indiaPhoton(props: PhotonFeature['properties']): boolean {
  const country = (props?.countrycode || props?.country || '').toLowerCase();
  if (!country) return true;
  return country === 'in' || country === 'india';
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

function photonToPlace(feature: PhotonFeature): PlaceHit | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const props = feature.properties ?? {};
  if (!indiaPhoton(props)) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = props.name || props.street || props.locality || props.city;
  if (!name) return null;
  const context = placeContext([
    props.street && props.street !== name ? props.street : undefined,
    props.locality !== name ? props.locality : undefined,
    props.district !== name ? props.district : undefined,
    props.city !== name ? props.city : undefined,
    props.state,
  ]);
  return {
    id: `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`,
    name,
    context,
    lat,
    lng,
    city: props.city || '',
    state: props.state || '',
  };
}

async function fetchPhoton(
  query: string,
  opts?: { lat?: number; lng?: number; limit?: number },
): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    q,
    limit: String(opts?.limit ?? 8),
    lang: 'en',
  });
  if (Number.isFinite(opts?.lat) && Number.isFinite(opts?.lng)) {
    params.set('lat', String(opts!.lat));
    params.set('lon', String(opts!.lng));
  }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const places: PlaceHit[] = [];
    const seen = new Set<string>();
    for (const feature of body.features ?? []) {
      const place = photonToPlace(feature);
      if (!place || seen.has(place.id)) continue;
      seen.add(place.id);
      places.push(place);
    }
    return places;
  } catch {
    return [];
  }
}

function consider(
  best: { hit: GeocodeHit; score: number } | null,
  hit: GeocodeHit,
  score: number,
): { hit: GeocodeHit; score: number } {
  if (!best || score > best.score) return { hit, score };
  return best;
}

async function searchPhoton(query: string): Promise<{ hit: GeocodeHit; score: number } | null> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { features?: PhotonFeature[] };
    let best: { hit: GeocodeHit; score: number } | null = null;
    for (const feature of body.features ?? []) {
      const place = photonToPlace(feature);
      if (!place) continue;
      const label = `${place.name} ${place.context}`;
      const hit: GeocodeHit = {
        lat: place.lat,
        lng: place.lng,
        name: place.name,
        city: place.city,
        state: place.state,
      };
      best = consider(best, hit, tokenOverlapScore(query, label));
    }
    return best;
  } catch {
    return null;
  }
}

export async function forwardGeocode(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (q.length < 3) return null;

  let best: { hit: GeocodeHit; score: number } | null = null;
  for (const variant of geocodeQueryVariants(q).slice(0, 4)) {
    const rows = await searchIndiaRows(variant);
    for (const row of rows) {
      const parsed = fromHit(row, q);
      if (!parsed) continue;
      best = consider(best, parsed, tokenOverlapScore(q, row.display_name));
    }
    if (best && best.score >= 18) break;
  }

  if (!best || best.score < 8) {
    const photon = await searchPhoton(q);
    if (photon && (!best || photon.score > best.score)) best = photon;
  }

  if (!best) return null;
  return { ...best.hit, name: pinLabelForQuery(q, best.hit.name) };
}

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { name, area } = splitPlaceQuery(q);

  const lookups = [q, area, name && area ? `${name}, ${area}, Pune` : '', name ? `${name}, Pune` : ''].filter(
    (value, index, all) => value && value.length >= 2 && all.indexOf(value) === index,
  );

  const seen = new Set<string>();
  const merged: PlaceHit[] = [];
  const addPlace = (place: PlaceHit) => {
    if (seen.has(place.id)) return;
    seen.add(place.id);
    merged.push(place);
  };

  for (const lookup of lookups.slice(0, 3)) {
    const photon = await fetchPhoton(lookup, { limit: 8 });
    for (const place of photon) addPlace(place);
    if (merged.length >= 8) break;
  }

  if (merged.length < 4) {
    for (const variant of geocodeQueryVariants(q).slice(0, 3)) {
      const rows = await searchIndiaRows(variant);
      for (const row of rows) {
        const parsed = fromHit(row, q);
        if (!parsed) continue;
        addPlace({
          id: `${parsed.name.toLowerCase()}|${parsed.lat.toFixed(4)}|${parsed.lng.toFixed(4)}`,
          name: parsed.name,
          context: placeContext([parsed.city, parsed.state]),
          lat: parsed.lat,
          lng: parsed.lng,
          city: parsed.city,
          state: parsed.state,
        });
      }
      if (merged.length >= 8) break;
    }
  }

  let areaHit: PlaceHit | undefined = merged.find((place) => {
    if (!area) return false;
    const blob = `${place.name} ${place.context}`.toLowerCase();
    return queryTokens(area).every((token) => blob.includes(token) || token.length < 4);
  });

  if (!areaHit && area) {
    const rows = await searchIndiaRows(`${area}, Pune, Maharashtra, India`);
    const parsed = rows[0] ? fromHit(rows[0], area) : null;
    if (parsed) {
      areaHit = {
        id: `area|${parsed.lat.toFixed(4)}|${parsed.lng.toFixed(4)}`,
        name: parsed.name,
        context: placeContext([parsed.city, parsed.state]),
        lat: parsed.lat,
        lng: parsed.lng,
        city: parsed.city,
        state: parsed.state,
      };
      addPlace(areaHit);
    }
  }

  if (name && areaHit) {
    const shops = await searchOverpassName(name, areaHit.lat, areaHit.lng);
    for (const shop of shops) addPlace(shop);
  }

  const nameTokens = queryTokens(name);
  const foundShop = merged.some((place) =>
    nameTokens.some((token) => place.name.toLowerCase().includes(token)),
  );
  if (name && area && areaHit && !foundShop) {
    merged.unshift({
      id: `typed|${name.toLowerCase()}|${areaHit.lat.toFixed(4)}`,
      name: titleCasePlace(name),
      context: `Near ${areaHit.name}${areaHit.context ? ` · ${areaHit.context}` : ''} — not listed, drop a pin`,
      lat: areaHit.lat,
      lng: areaHit.lng,
      city: areaHit.city,
      state: areaHit.state,
    });
  }

  return merged.slice(0, 8);
}

type OverpassEl = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string; 'addr:suburb'?: string; 'addr:city'?: string };
};

async function searchOverpassName(name: string, lat: number, lng: number): Promise<PlaceHit[]> {
  const needle = name.replace(/["\\]/g, ' ').trim();
  if (needle.length < 3) return [];
  const body =
    `[out:json][timeout:12];(nwr["name"~"${needle.split(/\s+/)[0]}",i](around:3500,${lat},${lng}););out center 8;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'text/plain; charset=UTF-8' },
      body,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { elements?: OverpassEl[] };
    const places: PlaceHit[] = [];
    for (const el of json.elements ?? []) {
      const plat = el.lat ?? el.center?.lat;
      const plng = el.lon ?? el.center?.lon;
      const label = el.tags?.name;
      if (!label || plat == null || plng == null) continue;
      if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
      places.push({
        id: `osm|${label.toLowerCase()}|${plat.toFixed(4)}|${plng.toFixed(4)}`,
        name: label,
        context: placeContext([el.tags?.['addr:suburb'], el.tags?.['addr:city']]),
        lat: plat,
        lng: plng,
        city: el.tags?.['addr:city'] || '',
        state: '',
      });
    }
    return places;
  } catch {
    return [];
  }
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function nearbyPlaces(
  lat: number,
  lng: number,
  hint?: string,
): Promise<PlaceHit[]> {
  const reverse = await reverseGeocode(lat, lng);
  const queries = [hint, reverse.name, reverse.city].filter(
    (value, index, all): value is string =>
      typeof value === 'string' && value.length >= 3 && all.indexOf(value) === index,
  );

  const seen = new Set<string>();
  const around: PlaceHit[] = [];
  for (const q of queries.slice(0, 2)) {
    const rows = await fetchPhoton(q, { lat, lng, limit: 12 });
    for (const place of rows) {
      if (seen.has(place.id)) continue;
      const distance = kmBetween({ lat, lng }, place);
      if (distance < 0.08 || distance > 2.5) continue;
      seen.add(place.id);
      around.push(place);
    }
    if (around.length >= 8) break;
  }
  return around.slice(0, 8);
}
