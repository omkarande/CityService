import type { CoverageStatus, ConfidenceTier } from '../api/types';

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
