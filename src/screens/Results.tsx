import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { AreaResult, CategoryId } from '../api/types';
import CategoryChips from '../components/CategoryChips';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import PlatformCard from '../components/PlatformCard';
import { ListSkeleton } from '../components/Skeleton';
import TopBar from '../components/TopBar';
import { formatDistance } from '../lib/format';
import { recentStore, savedStore } from '../lib/storage';

export default function Results() {
  const { localityId = '' } = useParams();
  const routeState = useLocation().state as { distanceKm?: number } | null;

  const [area, setArea] = useState<AreaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryId | 'all'>('all');
  const [saved, setSaved] = useState(false);

  const categories = api.categories();
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.getArea(localityId).then((result) => {
      if (cancelled) return;
      setArea(result);
      setLoading(false);
      if (result) {
        recentStore.push(result.locality.id);
        setSaved(savedStore.has(result.locality.id));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [localityId]);

  const visible = useMemo(() => {
    if (!area) return [];
    return filter === 'all' ? area.results : area.results.filter((r) => r.platform.categoryId === filter);
  }, [area, filter]);

  const summary = useMemo(() => {
    const counts = { available: 0, partial: 0, unavailable: 0, unknown: 0 };
    area?.results.forEach((r) => (counts[r.status] += 1));
    return counts;
  }, [area]);

  const availableCategories = useMemo(
    () => new Set((area?.results ?? []).map((r) => r.platform.categoryId)),
    [area],
  );

  function toggleSave() {
    if (!area) return;
    savedStore.toggle(area.locality.id);
    setSaved(savedStore.has(area.locality.id));
  }

  if (!loading && !area) {
    return (
      <>
        <TopBar back backLabel="Back" />
        <div className="px-margin-mobile py-lg">
          <EmptyState
            icon="wrong_location"
            title="We don't know this place yet"
            body="Only Pune localities are seeded right now. Try searching for another area."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        back
        backLabel="Back"
        action={
          <button
            onClick={toggleSave}
            aria-label={saved ? 'Remove from saved' : 'Save this locality'}
            aria-pressed={saved}
            className="rounded-full p-2 text-primary transition-colors hover:bg-surface-container-highest active:scale-90"
          >
            <Icon name="bookmark" fill={saved} />
          </button>
        }
      />

      <div className="animate-fade-up flex flex-col gap-md px-margin-mobile pb-lg pt-md">
        <header>
          <h2 className="text-headline-lg-mobile font-headline-lg text-on-surface">
            {area ? area.locality.name : '—'}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {area?.breadcrumb.join(' · ')}
            {area?.locality.pincode && ` · ${area.locality.pincode}`}
          </p>
          {routeState?.distanceKm !== undefined && (
            <p className="mt-1 inline-flex items-center gap-1 text-label-bold text-primary">
              <Icon name="near_me" size={14} />
              {formatDistance(routeState.distanceKm)}
            </p>
          )}
        </header>

        {area && (
          <div className="grid grid-cols-4 gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-soft">
            <Stat value={summary.available} label="Available" tone="text-success" />
            <Stat value={summary.partial} label="Patchy" tone="text-warning" />
            <Stat value={summary.unavailable} label="No service" tone="text-danger" />
            <Stat value={summary.unknown} label="Unknown" tone="text-neutral" />
          </div>
        )}

        <CategoryChips
          categories={categories}
          available={availableCategories}
          selected={filter}
          onSelect={setFilter}
        />

        {loading ? (
          <ListSkeleton />
        ) : (
          <div className="flex flex-col gap-md">
            {visible.map((result) => (
              <PlatformCard
                key={result.platform.id}
                result={result}
                localityId={localityId}
                categoryLabel={categoryById.get(result.platform.categoryId)?.label ?? ''}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-headline-md font-headline-md font-bold ${tone}`}>{value}</span>
      <span className="text-center text-label-sm text-on-surface-variant">{label}</span>
    </div>
  );
}
