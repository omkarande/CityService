import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LocalityRow from '../components/LocalityRow';
import SearchBar from '../components/SearchBar';
import SearchMap from '../components/SearchMap';
import TopBar from '../components/TopBar';
import type { GeocodeHit } from '../lib/nominatim';
import { useVisibilityRefresh } from '../lib/useVisibilityRefresh';

/**
 * The dedicated search screen: type a locality/pincode, see it plotted on a
 * map alongside every other match, then pick the right one from the list
 * below. Unknown buildings get the same map so the user can drop a pin.
 */
export default function Search() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [geoHit, setGeoHit] = useState<GeocodeHit | null>(null);

  const loadPins = useCallback(() => {
    api.mapPins().then(setPins);
  }, []);
  useEffect(loadPins, [loadPins]);
  useVisibilityRefresh(loadPins);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setGeoHit(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = query.trim();
      const [results, hit] = await Promise.all([
        api.search(query),
        q.length >= 3 ? api.geocode(query) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setSuggestions(results);
      setGeoHit(hit);
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.locality.id, p])), [pins]);
  const searching = query.trim().length >= 2;
  const unknown = searching && suggestions.length === 0;

  return (
    <>
      <TopBar back backLabel="Search" />

      <div className="flex flex-col gap-md px-margin-mobile pt-md pb-lg">
        <SearchBar value={query} onChange={setQuery} autoFocus />

        {!searching && (
          <EmptyState
            icon="search"
            title="Find a locality"
            body="Search by name, alias or pincode — or type a building and drop a pin on the map."
          />
        )}

        {searching && (
          <div className="animate-fade-up flex flex-col gap-sm">
            <SearchMap
              suggestions={suggestions}
              pinsById={pinsById}
              queryName={query.trim()}
              initialCenter={geoHit}
              showCompactConfirm
              confirmLabel="Select this pinned location"
            />
            <p className="flex items-start gap-1.5 text-label-sm text-on-surface-variant">
              <Icon name="touch_app" size={14} className="mt-0.5 shrink-0 text-outline" />
              {unknown
                ? 'Map follows the place you typed. Drag the pin to the exact spot, then tap Select this pinned location.'
                : 'Map follows the place you typed. Drag the pin if needed, tap a labelled pin for a saved place, or select this pinned location.'}
            </p>

            {suggestions.length > 0 && (
              <div className="flex flex-col gap-sm">
                {suggestions.map((suggestion) => {
                  const pin = pinsById.get(suggestion.locality.id);
                  return (
                    <LocalityRow
                      key={suggestion.locality.id}
                      suggestion={suggestion}
                      trailing={
                        <span className="flex shrink-0 items-center gap-1">
                          {pin && <AvailabilityPill available={pin.available} total={pin.total} />}
                          <Icon name="chevron_right" className="text-outline" size={20} />
                        </span>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
