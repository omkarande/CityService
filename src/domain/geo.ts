import type { Locality } from '../api/types';

/** Treat a pin as “this place” for confidence (same building). */
export const EXACT_KM = 0.15;

/** Hide the “checked Xm away” line only when the pin is this close to that place. */
export const SHOW_ORIGIN_KM = 0.02;

/** Nearby live checks may be borrowed up to this far. */
export const NEARBY_KM = 3;

/** General suburb/city data is only used inside this radius. */
export const GENERAL_KM = 15;

export function haversineKm(a: Locality['center'], b: Locality['center']): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "200 m" / "1.2 km" — used in card footers. */
export function formatOffset(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
