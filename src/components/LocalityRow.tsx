import { Link } from 'react-router-dom';
import type { LocalitySuggestion } from '../api/types';
import Icon from './Icon';

interface LocalityRowProps {
  suggestion: LocalitySuggestion;
  /** Leading icon — 'history' for recents, 'bookmark' for saved, etc. */
  icon?: string;
  trailing?: React.ReactNode;
}

export default function LocalityRow({ suggestion, icon = 'location_on', trailing }: LocalityRowProps) {
  const { locality, context } = suggestion;

  return (
    <Link
      to={`/l/${locality.id}`}
      className="flex items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 transition-colors hover:border-primary-container/40 hover:bg-surface-container-low active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon name={icon} size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-semibold text-on-surface">{locality.name}</span>
        <span className="block truncate text-body-md text-on-surface-variant">{context}</span>
      </span>

      {trailing ?? <Icon name="chevron_right" className="shrink-0 text-outline" size={20} />}
    </Link>
  );
}
