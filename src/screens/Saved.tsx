import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { LocalitySuggestion } from '../api/types';
import EmptyState from '../components/EmptyState';
import LocalityRow from '../components/LocalityRow';
import TopBar from '../components/TopBar';
import { savedStore } from '../lib/storage';

export default function Saved() {
  const [saved, setSaved] = useState<LocalitySuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.suggestionsFor(savedStore.all()).then((results) => {
      setSaved(results);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <TopBar title="Saved" />

      <div className="animate-fade-up flex flex-col gap-sm px-margin-mobile pb-lg pt-md">
        {!loading && saved.length === 0 ? (
          <EmptyState
            icon="bookmark_border"
            title="Nothing saved yet"
            body="Tap the bookmark on any locality to keep it here — handy when you're comparing areas to move to."
            action={
              <Link
                to="/"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-body-md font-bold text-on-primary"
              >
                Find a locality
              </Link>
            }
          />
        ) : (
          saved.map((suggestion) => (
            <LocalityRow key={suggestion.locality.id} suggestion={suggestion} icon="bookmark" />
          ))
        )}
      </div>
    </>
  );
}
