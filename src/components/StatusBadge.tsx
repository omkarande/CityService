import type { CoverageStatus } from '../api/types';
import { STATUS_LABEL } from '../lib/format';

const STYLES: Record<CoverageStatus, { chip: string; dot: string }> = {
  available: { chip: 'bg-success-container text-success', dot: 'bg-success-bright' },
  partial: { chip: 'bg-warning-container text-warning', dot: 'bg-warning-bright' },
  unavailable: { chip: 'bg-danger-container text-danger', dot: 'bg-danger-bright' },
  unknown: { chip: 'bg-neutral-container text-neutral', dot: 'bg-neutral' },
};

interface StatusBadgeProps {
  status: CoverageStatus;
  size?: 'sm' | 'lg';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = STYLES[status];
  const isLarge = size === 'lg';

  return (
    <span
      className={[
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold',
        style.chip,
        isLarge ? 'px-3 py-1.5 text-body-md' : 'px-2 py-0.5 text-label-bold',
      ].join(' ')}
    >
      <span className={`rounded-full ${style.dot} ${isLarge ? 'h-2 w-2' : 'h-1.5 w-1.5'}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}
