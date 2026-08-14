/**
 * The data contract for CityService.
 *
 * These types are the boundary between screens and data. The mock adapter
 * fabricates them from local JSON today; a real backend will serve exactly the
 * same shapes tomorrow. Screens must never import from `src/data` directly.
 *
 * See ARCHITECTURE.md §2.
 */

// ---------------------------------------------------------------- Geography

export type AreaKind = 'city' | 'suburb' | 'locality' | 'village' | 'pincode';

export interface Locality {
  /** Stable slug, e.g. 'pune-chikhali-shinde-vasti'. Used in URLs. */
  id: string;
  name: string;
  /** Alternate spellings and transliterations, matched during search. */
  aliases: string[];
  kind: AreaKind;
  /** Walk this up to reach the city. Null only for a city itself. */
  parentId: string | null;
  pincode: string | null;
  city: string;
  state: string;
  center: { lat: number; lng: number };
}

// ---------------------------------------------------------------- Platforms

export type CategoryId =
  | 'ride-hailing'
  | 'bike-taxi'
  | 'food-delivery'
  | 'quick-commerce'
  | 'grocery'
  | 'ecommerce'
  | 'courier'
  | 'home-services'
  | 'pharmacy';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string; // Material Symbols ligature
}

export interface Platform {
  id: string; // 'zepto'
  name: string; // 'Zepto'
  categoryId: CategoryId;
  brandColor: string;
  /**
   * Brand mark served from `/logos`. Omitted where no usable asset exists —
   * the tile then falls back to initials on the brand colour, so a missing or
   * broken logo never leaves a hole in the list.
   */
  logoUrl?: string;
  initials: string;
  website: string;
}

// ----------------------------------------------------------------- Coverage

export type CoverageStatus = 'available' | 'partial' | 'unavailable' | 'unknown';

/**
 * Where a coverage claim came from, ordered by how much we trust it.
 * `seed-placeholder` means "we made this up to make the prototype run" — it is
 * capped at the lowest confidence tier and must never read as verified.
 */
export type SourceKind = 'official' | 'probe' | 'seed' | 'user-report' | 'seed-placeholder';

export interface CoverageDetails {
  /** [min, max] minutes — wait time for rides, delivery time for the rest. */
  etaMinutes?: [number, number];
  coverageStrength?: 'wide' | 'partial' | 'edge';
  deliveryFee?: number;
  minOrder?: number;
  note?: string;
}

/** One raw claim: this platform, this area, this status, from this source. */
export interface Coverage {
  platformId: string;
  areaId: string;
  status: CoverageStatus;
  source: SourceKind;
  lastVerifiedAt: string; // ISO 8601
  /**
   * Evidence is counted *relative to the recorded status*, not to availability:
   * `positive` corroborates whatever `status` says, `negative` contradicts it.
   * So a record of `unavailable` with { positive: 9 } means nine people agreed
   * the service does not work there. This keeps the agreement math uniform
   * across all four statuses.
   */
  evidence: { positive: number; negative: number };
  details?: CoverageDetails;
}

// ------------------------------------------------------------- User reports

export type Verdict = 'works' | 'not-working';

export interface UserReport {
  id: string;
  platformId: string;
  areaId: string;
  verdict: Verdict;
  reportedAt: string;
  note?: string;
  /** Reports made from inside the area carry more weight than remote ones. */
  atLocation: boolean;
  reporterId: string;
}

// ------------------------------------------------------------- API responses

export type ConfidenceTier = 'verified' | 'likely' | 'unconfirmed';

/** How far down the fallback ladder we had to go to answer. */
export type ResolutionPath = 'exact' | 'pincode' | 'polygon' | 'city' | 'none';

/** A single row on the results screen: the answer plus how much to trust it. */
export interface ResolvedCoverage {
  platform: Platform;
  status: CoverageStatus;
  confidence: number; // 0..1
  tier: ConfidenceTier;
  resolvedFrom: ResolutionPath;
  /** The area the winning record was actually recorded against. */
  resolvedAreaName: string | null;
  lastVerifiedAt: string | null;
  source: SourceKind | null;
  details?: CoverageDetails;
  /** Human-readable caveat, e.g. "Estimated from Pune city data". */
  caveat: string | null;
}

export interface AreaResult {
  locality: Locality;
  /** Full parent chain, nearest first: ['Chikhali', 'Pune', 'Maharashtra']. */
  breadcrumb: string[];
  results: ResolvedCoverage[];
  generatedAt: string;
}

/** One locality plotted on a map, sized up by how much of the catalogue works. */
export interface MapPin {
  locality: Locality;
  available: number;
  total: number;
}

export interface LocalitySuggestion {
  locality: Locality;
  /** 'Chikhali · Pune · 411062' — always shown, several localities share a name. */
  context: string;
  score: number;
}
