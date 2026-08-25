import type {
  AreaResult,
  Category,
  Coverage,
  Locality,
  LocalitySuggestion,
  MapPin,
  Platform,
  ResolvedCoverage,
  UserReport,
  Verdict,
} from './types';
import { Capacitor } from '@capacitor/core';
import { reportStore, reporterId } from '../lib/storage';
import { forwardGeocode } from '../lib/nominatim';

function apiBase(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // Capacitor WebView is https://localhost — relative /api would miss Render.
  if (Capacitor.isNativePlatform()) return 'https://cityservice.onrender.com';
  return '';
}

const base = apiBase();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as T | { error?: string } | null;
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && body.error
        ? String(body.error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

let categories: Category[] = [];
let platforms: Platform[] = [];
let localities: Locality[] = [];
let ready: Promise<void> | null = null;

async function loadCatalog() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const catalog = await request<{
        categories: Category[];
        platforms: Platform[];
        localities: Locality[];
      }>('/api/catalog');
      categories = catalog.categories;
      platforms = catalog.platforms;
      localities = catalog.localities;
      return;
    } catch (err) {
      lastError = err;
      // Render free tier can take ~30–40s to wake.
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }
  throw lastError;
}

export const httpAdapter = {
  async ready(): Promise<void> {
    ready ??= loadCatalog();
    await ready;
  },

  categories(): Category[] {
    return categories;
  },

  platforms(): Platform[] {
    return platforms;
  },

  localities(): Locality[] {
    return localities;
  },

  async getLocality(id: string): Promise<Locality | null> {
    await httpAdapter.ready();
    return localities.find((l) => l.id === id) ?? null;
  },

  async search(query: string): Promise<LocalitySuggestion[]> {
    return request(`/api/search?q=${encodeURIComponent(query)}`);
  },

  async popular(): Promise<LocalitySuggestion[]> {
    return request('/api/popular');
  },

  async suggestionsFor(ids: string[]): Promise<LocalitySuggestion[]> {
    return request('/api/suggestions', { method: 'POST', body: JSON.stringify({ ids }) });
  },

  async nearest(lat: number, lng: number): Promise<{ locality: Locality; distanceKm: number } | null> {
    return request(`/api/nearest?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
  },

  async mapPins(): Promise<MapPin[]> {
    return request('/api/map-pins');
  },

  async getArea(localityId: string): Promise<AreaResult | null> {
    try {
      return await request(`/api/area/${encodeURIComponent(localityId)}`);
    } catch {
      return null;
    }
  },

  async getPlatformAt(
    localityId: string,
    platformId: string,
  ): Promise<{ locality: Locality; breadcrumb: string[]; resolved: ResolvedCoverage } | null> {
    try {
      return await request(
        `/api/area/${encodeURIComponent(localityId)}/${encodeURIComponent(platformId)}`,
      );
    } catch {
      return null;
    }
  },

  async submitReport(input: {
    platformId: string;
    areaId: string;
    verdict: Verdict;
    atLocation?: boolean;
    note?: string;
  }): Promise<UserReport> {
    const report: UserReport = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      platformId: input.platformId,
      areaId: input.areaId,
      verdict: input.verdict,
      reportedAt: new Date().toISOString(),
      note: input.note,
      atLocation: input.atLocation ?? false,
      reporterId: reporterId(),
    };
    reportStore.add(report);
    return report;
  },

  myReport(platformId: string, areaId: string): UserReport | undefined {
    return reportStore.mine(platformId, areaId);
  },

  async probeLogin(password: string): Promise<void> {
    await request('/api/probe/login', { method: 'POST', body: JSON.stringify({ password }) });
  },

  async probeMe(): Promise<boolean> {
    try {
      await request('/api/probe/me');
      return true;
    } catch {
      return false;
    }
  },

  async probeRecord(input: {
    platformId: string;
    areaId: string;
    status: Coverage['status'];
    etaMinutes?: number;
    storeName?: string;
    note?: string;
  }): Promise<Coverage> {
    const body = await request<{ coverage: Coverage }>('/api/probe/record', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return body.coverage;
  },

  async coverageRecords(): Promise<Coverage[]> {
    const body = await request<{ records: Coverage[] }>('/api/coverage');
    return body.records;
  },

  async reverse(lat: number, lng: number): Promise<{ name: string; city: string; state: string }> {
    return request(`/api/reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
  },

  async geocode(query: string) {
    try {
      return await request<{
        lat: number;
        lng: number;
        name: string;
        city: string;
        state: string;
        boundingBox?: [number, number, number, number];
      }>(`/api/geocode?q=${encodeURIComponent(query)}`);
    } catch {
      return forwardGeocode(query);
    }
  },

  async getAt(lat: number, lng: number, q?: string): Promise<AreaResult> {
    const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (q) qs.set('q', q);
    return request(`/api/at?${qs.toString()}`);
  },

  async probePlace(input: { lat: number; lng: number; name?: string }): Promise<Locality> {
    const body = await request<{ locality: Locality }>('/api/probe/place', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await httpAdapter.refresh();
    return body.locality;
  },

  async refresh(): Promise<void> {
    ready = loadCatalog();
    await ready;
  },
};
