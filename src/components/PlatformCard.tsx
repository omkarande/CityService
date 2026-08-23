import { Link } from 'react-router-dom';
import type { ResolvedCoverage } from '../api/types';
import { formatEta } from '../lib/format';
import ConfidenceMeter from './ConfidenceMeter';
import Icon from './Icon';
import LogoTile from './LogoTile';
import StatusBadge from './StatusBadge';

interface PlatformCardProps {
  result: ResolvedCoverage;
  to: string;
  categoryLabel: string;
}

export default function PlatformCard({ result, to, categoryLabel }: PlatformCardProps) {
  const { platform, status, tier, caveat, details } = result;
  const dimmed = status === 'unavailable' || status === 'unknown';
  const eta = formatEta(details?.etaMinutes);
  const className = [
    'flex flex-col gap-2 rounded-xl border p-md transition-all duration-200',
    dimmed
      ? 'border-outline-variant/30 bg-surface-container-lowest/60'
      : 'border-outline-variant/50 bg-surface-container-lowest shadow-soft hover:border-primary-container/40 hover:shadow-ambient',
    to ? 'active:scale-[0.99]' : '',
  ].join(' ');

  const body = (
    <>
      <div className="flex items-center gap-md">
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
          <div className="mt-1">
            <ConfidenceMeter tier={tier} />
          </div>
        </div>
        {to ? <Icon name="chevron_right" className="shrink-0 text-outline" size={20} /> : null}
      </div>
      {caveat && <p className="text-label-sm text-on-surface/55">{caveat}</p>}
    </>
  );

  if (!to) return <div className={className}>{body}</div>;
  return (
    <Link to={to} className={className}>
      {body}
    </Link>
  );
}
