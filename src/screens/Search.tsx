import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion, MapPin } from '../api/types';
import AvailabilityPill from '../components/AvailabilityPill';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import PlaceRow from '../components/PlaceRow';
import SearchBar from '../components/SearchBar';
import SearchMap from '../components/SearchMap';
import TopBar from '../components/TopBar';
import type { PlaceHit } from '../lib/nominatim';
import { catalogAreaQueries, pinLabelForQuery } from '../lib/nominatim';
import { useVisibilityRefresh } from '../lib/useVisibilityRefresh';

type PickedPlace = {
  name: string;
  lat: number;
  lng: number;
  localityId?: string;
};

function newSessionToken(): string {
  return crypto.randomUUID();
}

/**
 * Google/Zomato-style picker: named autocomplete first, then a map with the
 * pin and nearby place names. Confirm goes to coverage for that point.
 */
export default function Search() {
  const navigate = useNavigate();
  const sessionToken = useRef(newSessionToken());

  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<LocalitySuggestion[]>([]);
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [around, setAround] = useState<PlaceHit[]>([]);
  const [mapBusy, setMapBusy] = useState(false);

  const loadPins = useCallback(() => {
    api.mapPins().then(setPins);
  }, []);
  useEffect(loadPins, [loadPins]);
  useVisibilityRefresh(loadPins);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCatalog([]);
      setPlaces([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const q = query.trim();
      const [savedLists, googleHits] = await Promise.all([
        Promise.all(catalogAreaQueries(q).map((part) => api.search(part))),
        q.length >= 2 ? api.searchPlaces(q, sessionToken.current) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      const byId = new Map<string, LocalitySuggestion>();
      for (const list of savedLists) {
        for (const row of list) byId.set(row.locality.id, row);
      }
      setCatalog([...byId.values()].sort((a, b) => b.score - a.score));
      setPlaces(googleHits);
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!picked) {
      setAround([]);
      return;
    }
    let cancelled = false;
    api.nearbyPlaces(picked.lat, picked.lng).then((rows) => {
      if (!cancelled) setAround(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [picked?.lat, picked?.lng]);

  const pinsById = useMemo(() => new Map(pins.map((p) => [p.locality.id, p])), [pins]);
  const searching = query.trim().length >= 2;
  const catalogNames = useMemo(
    () => new Set(catalog.map((row) => row.locality.name.toLowerCase())),
    [catalog],
  );
  const extraPlaces = places.filter((place) => !catalogNames.has(place.name.toLowerCase()));
  const mapMode = Boolean(picked);

  function openMap(place: PickedPlace) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setPicked(place);
  }

  function onQueryChange(value: string) {
    if (query.trim().length < 2 && value.trim().length >= 2) {
      sessionToken.current = newSessionToken();
    }
    setQuery(value);
    if (picked) setPicked(null);
  }

  async function openGooglePlace(place: PlaceHit) {
    if (place.lat != null && place.lng != null) {
      openMap({ name: place.name, lat: place.lat, lng: place.lng });
      sessionToken.current = newSessionToken();
      return;
    }
    const details = await api.placeDetails(place.id, sessionToken.current);
    sessionToken.current = newSessionToken();
    if (!details) return;
    openMap({ name: details.name || place.name, lat: details.lat, lng: details.lng });
  }

  async function showOnMap() {
    const q = query.trim();
    if (q.length < 2) return;
    setMapBusy(true);
    try {
      const hit = await api.geocode(q);
      if (hit) openMap({ name: pinLabelForQuery(q, hit.name), lat: hit.lat, lng: hit.lng });
    } finally {
      setMapBusy(false);
    }
  }

  async function onPinMove(lat: number, lng: number) {
    setPicked((current) => (current ? { ...current, lat, lng } : current));
    const geo = await api.reverse(lat, lng);
    setPicked((current) =>
      current && current.lat === lat && current.lng === lng
        ? { ...current, name: geo.name || current.name }
        : current,
    );
  }

  return (
    <>
      <TopBar
        back
        backLabel={mapMode ? 'Results' : 'Search'}
        onBack={mapMode ? () => setPicked(null) : undefined}
      />

      <div className="flex flex-col gap-md px-margin-mobile pt-md pb-lg">
        <SearchBar value={query} onChange={onQueryChange} autoFocus={!mapMode} />

        {!searching && !mapMode && (
          <EmptyState
            icon="search"
            title="Find a locality"
            body="Search a shop or society, then the area. For example Mustard Mart, Shinde Vasti, Ravet."
          />
        )}

        {searching && !mapMode && (
          <div className="animate-fade-up flex flex-col gap-sm">
            {catalog.length === 0 && extraPlaces.length === 0 && (
              <p className="px-1 text-body-md text-on-surface-variant">
                No listed match for this name. Add an area (for example Ravet) or use Show on map.
              </p>
            )}
            {catalog.map((suggestion) => {
              const pin = pinsById.get(suggestion.locality.id);
              return (
                <PlaceRow
                  key={suggestion.locality.id}
                  name={suggestion.locality.name}
                  context={suggestion.context}
                  onClick={() =>
                    openMap({
                      name: suggestion.locality.name,
                      lat: suggestion.locality.center.lat,
                      lng: suggestion.locality.center.lng,
                      localityId: suggestion.locality.id,
                    })
                  }
                  trailing={
                    <span className="flex shrink-0 items-center gap-1">
                      {pin && <AvailabilityPill available={pin.available} total={pin.total} />}
                      <button
                        type="button"
                        aria-label={`Open ${suggestion.locality.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/l/${suggestion.locality.id}`);
                        }}
                        className="rounded-full p-1 text-outline active:scale-90"
                      >
                        <Icon name="chevron_right" size={20} />
                      </button>
                    </span>
                  }
                />
              );
            })}

            {extraPlaces.map((place) => (
              <PlaceRow
                key={place.id}
                name={place.name}
                context={place.context}
                onClick={() => void openGooglePlace(place)}
              />
            ))}

            <PlaceRow
              name={mapBusy ? 'Finding this on the map…' : 'Show on map'}
              context="Drop a pin if the list is missing your society"
              icon="map"
              onClick={() => {
                if (!mapBusy) void showOnMap();
              }}
            />
          </div>
        )}

        {mapMode && picked && (
          <div className="animate-fade-up flex flex-col gap-sm">
            <p className="text-body-md text-on-surface">
              <span className="font-semibold">{picked.name}</span>
              <span className="text-on-surface-variant">. Drag the pin or tap a labelled place</span>
            </p>
            <SearchMap
              suggestions={catalog}
              pinsById={pinsById}
              queryName={picked.name}
              initialCenter={{ lat: picked.lat, lng: picked.lng }}
              pinLabel={picked.name}
              nearbyPlaces={around}
              showCompactConfirm
              confirmLabel="Select this pinned location"
              onNearbyPick={(place) => {
                if (place.lat != null && place.lng != null) {
                  openMap({ name: place.name, lat: place.lat, lng: place.lng });
                }
              }}
              onPinChange={onPinMove}
            />
          </div>
        )}
      </div>
    </>
  );
}
