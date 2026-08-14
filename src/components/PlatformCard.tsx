import { Link } from 'react-router-dom';
import type { ResolvedCoverage } from '../api/types';
import { formatEta } from '../lib/format';
import ConfidenceMeter from './ConfidenceMeter';
import Icon from './Icon';
import LogoTile from './LogoTile';
import StatusBadge from './StatusBadge';

interface PlatformCardProps {
  result: ResolvedCoverage;
  localityId: string;
  categoryLabel: string;
}

export default function PlatformCard({ result, localityId, categoryLabel }: PlatformCardProps) {
  const { platform, status, tier, caveat, details } = result;
  const dimmed = status === 'unavailable' || status === 'unknown';
  const eta = formatEta(details?.etaMinutes);

  return (
    <Link
      to={`/l/${localityId}/${platform.id}`}
      className={[
        'flex items-center gap-md rounded-xl border p-md transition-all duration-200 active:scale-[0.99]',
        dimmed
          ? 'border-outline-variant/30 bg-surface-container-lowest/60'
          : 'border-outline-variant/50 bg-surface-container-lowest shadow-soft hover:border-primary-container/40 hover:shadow-ambient',
      ].join(' ')}
    >
      <LogoTile platform={platform} muted={dimmed} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`truncate text-body-lg font-bold ${dimmed ? 'text-on-surface-variant' : 'text-on-surface'}`}>
            {platform.name}
          </h3>
          <StatusBadge status={status} />
        </div>

        <p className="truncate text-body-md text-on-surface-variant">
          {categoryLabel}
          {eta && ` · ${eta}`}
        </p>

        <div className="mt-1 flex items-center gap-2">
          <ConfidenceMeter tier={tier} />
          {caveat && <span className="truncate text-label-sm text-on-surface-variant">{caveat}</span>}
        </div>
      </div>

      <Icon name="chevron_right" className="shrink-0 text-outline" size={20} />
    </Link>
  );
}
