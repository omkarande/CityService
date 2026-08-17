import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import LocalityRow from '../components/LocalityRow';
import SearchBar from '../components/SearchBar';
import SearchMap from '../components/SearchMap';
import TopBar from '../components/TopBar';

/**
 * The dedicated search screen: type a locality/pincode, see it plotted on a
 * map alongside every other match, then pick the right one from the list
 * below. Kept off Home on purpose — Home stays a plain landing screen.
 */
export default function Search() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocalitySuggestion[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);

  useEffect(() => {
    api.mapPins().then(setPins);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.search(query).then((results) => {
        if (!cancelled) setSuggestions(results);
      });
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.locality.id, p])), [pins]);
  const searching = query.trim().length >= 2;

  return (
    <>
      <TopBar back backLabel="Search" />

      <div className="flex flex-col gap-md px-margin-mobile pt-md">
        <SearchBar value={query} onChange={setQuery} autoFocus />

        {!searching && (
          <EmptyState
            icon="search"
            title="Find a locality"
            body="Search by name, alias or pincode — right down to a single vasti or society."
          />
        )}

        {searching && suggestions.length === 0 && (
          <EmptyState
            icon="search_off"
            title="Nothing matched"
            body="Only Pune localities are seeded so far. Try “Shinde Vasti”, “Baner” or a 411xxx pincode."
          />
        )}

        {searching && suggestions.length > 0 && (
          <div className="animate-fade-up flex flex-col gap-sm pb-lg">
            <SearchMap suggestions={suggestions} pinsById={pinsById} />
            <p className="flex items-start gap-1.5 text-label-sm text-on-surface-variant">
              <Icon name="touch_app" size={14} className="mt-0.5 shrink-0 text-outline" />
              Drag the black pin (or tap anywhere on the map) to fine-tune the exact spot, or tap a result below.
            </p>

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
          </div>
        )}
      </div>
    </>
  );
}
