const UA = 'CityService/0.1 (https://github.com/omkarande/CityService)';

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

export type GeocodeHit = {
  lat: number;
  lng: number;
  name: string;
  city: string;
  state: string;
  /** Nominatim order: south, north, west, east. */
  boundingBox?: [number, number, number, number];
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

async function searchIndia(query: string): Promise<GeocodeHit | null> {
  const rows = await nominatim<NominatimSearch[]>(
    `/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5&countrycodes=in`,
  );
  const hit = rows?.[0];
  if (!hit) return null;
  return fromHit(hit, query);
}

export async function forwardGeocode(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const primary = await searchIndia(q);
  if (primary) return primary;
  const comma = q.lastIndexOf(',');
  if (comma === -1) return null;
  const tail = q.slice(comma + 1).trim();
  if (tail.length < 3 || normalizeForTail(tail) === normalizeForTail(q)) return null;
  return searchIndia(tail);
}

function normalizeForTail(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ');
}
