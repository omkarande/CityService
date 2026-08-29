import type { GeocodeHit, PlaceHit } from './nominatim';
import { pinLabelForQuery } from './nominatim';

const PLACES = 'https://places.googleapis.com/v1';
const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';
/** Labels around the chosen pin only. Search and the pin itself are not limited to this. */
const NEARBY_RADIUS_M = 3_000;

function serverKey(): string {
  const key = (process.env.GOOGLE_MAPS_SERVER_KEY ?? '').trim();
  if (!key) throw new Error('GOOGLE_MAPS_SERVER_KEY is not configured on the server.');
  return key;
}

type PlacesError = { error?: { message?: string; status?: string } };

async function placesPost<T>(path: string, fieldMask: string, body: unknown): Promise<T> {
  const res = await fetch(`${PLACES}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': serverKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & PlacesError;
  if (!res.ok) {
    throw new Error(json.error?.message || `Places request failed (${res.status})`);
  }
  return json;
}

async function placesGet<T>(path: string, fieldMask: string): Promise<T> {
  const res = await fetch(`${PLACES}${path}`, {
    headers: {
      'X-Goog-Api-Key': serverKey(),
      'X-Goog-FieldMask': fieldMask,
    },
  });
  const json = (await res.json()) as T & PlacesError;
  if (!res.ok) {
    throw new Error(json.error?.message || `Places request failed (${res.status})`);
  }
  return json;
}

function textOf(value?: { text?: string } | string): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.text ?? '';
}

function component(components: Array<{ longText?: string; types?: string[] }> | undefined, type: string): string {
  return components?.find((part) => part.types?.includes(type))?.longText ?? '';
}

export async function googleAutocomplete(input: string, sessionToken?: string): Promise<PlaceHit[]> {
  const q = input.trim();
  if (q.length < 2) return [];

  const body = await placesPost<{
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  }>(
    '/places:autocomplete',
    'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    {
      input: q,
      includedRegionCodes: ['in'],
      languageCode: 'en',
      ...(sessionToken ? { sessionToken } : {}),
    },
  );

  const hits: PlaceHit[] = [];
  for (const row of body.suggestions ?? []) {
    const pred = row.placePrediction;
    const id = pred?.placeId;
    const name = textOf(pred?.structuredFormat?.mainText) || textOf(pred?.text);
    if (!id || !name) continue;
    hits.push({
      id,
      name,
      context: textOf(pred?.structuredFormat?.secondaryText),
      lat: null,
      lng: null,
      city: '',
      state: '',
    });
  }
  return hits.slice(0, 8);
}

export async function googlePlaceDetails(placeId: string, sessionToken?: string): Promise<GeocodeHit | null> {
  const id = placeId.trim().replace(/^places\//, '');
  if (!id) return null;
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '';
  const place = await placesGet<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    shortFormattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: Array<{ longText?: string; types?: string[] }>;
  }>(
    `/places/${encodeURIComponent(id)}${qs}`,
    'id,displayName,formattedAddress,shortFormattedAddress,location,addressComponents',
  );

  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat: lat as number,
    lng: lng as number,
    name: textOf(place.displayName) || place.shortFormattedAddress || 'Pinned location',
    city: component(place.addressComponents, 'locality') || component(place.addressComponents, 'sublocality'),
    state: component(place.addressComponents, 'administrative_area_level_1'),
  };
}

async function geocodeJson(params: string): Promise<(GeocodeResult & { lat?: number; lng?: number }) | null> {
  const url = `${GEOCODE}?${params}&language=en&region=in&key=${encodeURIComponent(serverKey())}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    status?: string;
    results?: Array<GeocodeResult & { geometry?: { location?: { lat?: number; lng?: number } } }>;
    error_message?: string;
  };
  if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(json.error_message || `Geocoding failed (${json.status})`);
  }
  const result = json.results?.[0];
  if (!result) return null;
  return {
    ...result,
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
  };
}

export async function googleForwardGeocode(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (q.length < 3) return null;

  const result = await geocodeJson(`address=${encodeURIComponent(q)}`);
  const lat = result?.lat;
  const lng = result?.lng;
  if (!result || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const parts = result.address_components;
  return {
    lat: lat as number,
    lng: lng as number,
    name: pinLabelForQuery(
      q,
      geocodeComponent(parts, 'premise') ||
        geocodeComponent(parts, 'establishment') ||
        result.formatted_address?.split(',')[0] ||
        q,
    ),
    city: geocodeComponent(parts, 'locality') || geocodeComponent(parts, 'sublocality') || '',
    state: geocodeComponent(parts, 'administrative_area_level_1') || '',
  };
}

export async function googleNearbyPlaces(lat: number, lng: number): Promise<PlaceHit[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const body = await placesPost<{
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      shortFormattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      types?: string[];
    }>;
  }>(
    '/places:searchNearby',
    'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types',
    {
      maxResultCount: 15,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: NEARBY_RADIUS_M },
      },
    },
  );

  const hits: PlaceHit[] = [];
  const seen = new Set<string>();
  for (const place of body.places ?? []) {
    const plat = place.location?.latitude;
    const plng = place.location?.longitude;
    const name = textOf(place.displayName);
    const id = place.id || `${name}|${plat}|${plng}`;
    if (!name || !Number.isFinite(plat) || !Number.isFinite(plng) || seen.has(id)) continue;
    seen.add(id);
    hits.push({
      id,
      name,
      context: place.shortFormattedAddress || place.formattedAddress || '',
      lat: plat as number,
      lng: plng as number,
      city: '',
      state: '',
    });
  }
  return hits.slice(0, 12);
}

type GeocodeComponent = { long_name?: string; types?: string[] };
type GeocodeResult = {
  formatted_address?: string;
  address_components?: GeocodeComponent[];
};

function geocodeComponent(parts: GeocodeComponent[] | undefined, type: string): string {
  return parts?.find((part) => part.types?.includes(type))?.long_name ?? '';
}

export async function googleReverseGeocode(
  lat: number,
  lng: number,
): Promise<{ name: string; city: string; state: string }> {
  const result = await geocodeJson(`latlng=${encodeURIComponent(`${lat},${lng}`)}`);
  const parts = result?.address_components;
  const name =
    geocodeComponent(parts, 'premise') ||
    geocodeComponent(parts, 'subpremise') ||
    geocodeComponent(parts, 'establishment') ||
    geocodeComponent(parts, 'point_of_interest') ||
    geocodeComponent(parts, 'route') ||
    geocodeComponent(parts, 'neighborhood') ||
    geocodeComponent(parts, 'sublocality') ||
    geocodeComponent(parts, 'sublocality_level_1') ||
    geocodeComponent(parts, 'locality') ||
    result?.formatted_address?.split(',')[0] ||
    'Pinned location';
  return {
    name,
    city:
      geocodeComponent(parts, 'locality') ||
      geocodeComponent(parts, 'sublocality') ||
      geocodeComponent(parts, 'administrative_area_level_2') ||
      '',
    state: geocodeComponent(parts, 'administrative_area_level_1') || '',
  };
}
