import type { AreaKind, CoverageStatus, ConfidenceTier } from '../api/types';

/** "today" / "3 days ago" / "5 months ago" — freshness is a headline fact here. */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  if (days <= 0) {
    const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours <= 0) return 'just now';
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatEta(eta?: [number, number]): string | null {
  if (!eta) return null;
  const [min, max] = eta;
  return min === max ? `${min} min` : `${min}–${max} min`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

export const STATUS_LABEL: Record<CoverageStatus, string> = {
  available: 'Available',
  partial: 'Patchy',
  unavailable: 'Not available',
  unknown: 'Unknown',
};

export const TIER_LABEL: Record<ConfidenceTier, string> = {
  verified: 'Verified',
  likely: 'Likely',
  unconfirmed: 'Unconfirmed',
};

export const COVERAGE_LABEL: Record<string, string> = {
  wide: 'Wide',
  partial: 'Partial',
  edge: 'Edge of range',
};

/** "Baner" → "BA", "Shinde Vasti" → "SV" — a stable 2-letter avatar mark for anything with a name. */
export function initialsOf(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Turns a display label into a URL-safe id fragment, e.g. "T. Nagar" → "t-nagar". */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Map-pin colour by the share of the catalogue that works in an area. */
export function coverageColor(ratio: number): string {
  if (ratio >= 0.6) return '#36b37e';
  if (ratio >= 0.3) return '#ffab00';
  return '#ff5630';
}

/** 0–5 stars, half-star steps, from the share of the catalogue that works here. */
export function starsFor(available: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((available / total) * 5 * 2) / 2;
}

/** Words for a star rating, independent of exactly how it was computed. */
export function starRatingLabel(stars: number): string {
  if (stars >= 4.5) return 'Excellent coverage';
  if (stars >= 3.5) return 'Good coverage';
  if (stars >= 2.5) return 'Average coverage';
  if (stars >= 1.5) return 'Below average coverage';
  if (stars > 0) return 'Poor coverage';
  return 'No coverage';
}

/** Same thresholds as coverageColor, in words rather than a colour. */
export function coverageLabel(available: number, total: number): string {
  if (total === 0) return 'No data yet';
  const ratio = available / total;
  if (ratio >= 0.6) return 'Good coverage';
  if (ratio >= 0.3) return 'Limited coverage';
  if (available === 0) return 'None available yet';
  return 'Few services';
}

/** Only the kinds worth calling out — 'locality' and 'city' are the uninformative default. */
export const KIND_LABEL: Partial<Record<AreaKind, string>> = {
  suburb: 'Suburb',
  village: 'Village',
  pincode: 'Pincode area',
};

/**
 * Brand colours run from near-black (Uber) to bright yellow (Blinkit), so the
 * logo tile picks its own text colour rather than assuming white.
 */
export function readableTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance > 0.5 ? '#051a3e' : '#ffffff';
}
