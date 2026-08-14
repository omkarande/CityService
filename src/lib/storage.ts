/**
 * localStorage wrapper. Everything is best-effort — private browsing and
 * storage-disabled contexts must degrade to "nothing saved", never crash.
 *
 * In phase 2, reports move to the server and this keeps only the offline queue.
 */

import type { UserReport } from '../api/types';

const KEYS = {
  reports: 'cityservice.reports.v1',
  saved: 'cityservice.saved.v1',
  recent: 'cityservice.recent.v1',
  reporterId: 'cityservice.reporterId.v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled storage — the app still works, it just forgets */
  }
}

/** Stable anonymous id so one person's repeat reports can be recognised. */
export function reporterId(): string {
  let id = read<string>(KEYS.reporterId, '');
  if (!id) {
    id = `anon-${Math.random().toString(36).slice(2, 10)}`;
    write(KEYS.reporterId, id);
  }
  return id;
}

export const reportStore = {
  all: (): UserReport[] => read<UserReport[]>(KEYS.reports, []),

  add(report: UserReport): UserReport[] {
    // One vote per person per platform+area: a re-vote replaces the old one.
    const next = reportStore
      .all()
      .filter((r) => !(r.reporterId === report.reporterId && r.platformId === report.platformId && r.areaId === report.areaId));
    next.push(report);
    write(KEYS.reports, next);
    return next;
  },

  mine(platformId: string, areaId: string): UserReport | undefined {
    const me = reporterId();
    return reportStore.all().find((r) => r.reporterId === me && r.platformId === platformId && r.areaId === areaId);
  },

  clear(): void {
    write(KEYS.reports, []);
  },
};

export const savedStore = {
  all: (): string[] => read<string[]>(KEYS.saved, []),

  has: (localityId: string): boolean => savedStore.all().includes(localityId),

  toggle(localityId: string): string[] {
    const current = savedStore.all();
    const next = current.includes(localityId)
      ? current.filter((id) => id !== localityId)
      : [localityId, ...current];
    write(KEYS.saved, next);
    return next;
  },
};

const RECENT_LIMIT = 6;

export const recentStore = {
  all: (): string[] => read<string[]>(KEYS.recent, []),

  push(localityId: string): string[] {
    const next = [localityId, ...recentStore.all().filter((id) => id !== localityId)].slice(0, RECENT_LIMIT);
    write(KEYS.recent, next);
    return next;
  },
};
