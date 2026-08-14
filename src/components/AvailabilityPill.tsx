import { coverageColor } from '../lib/format';

interface AvailabilityPillProps {
  available: number;
  total: number;
}

/** Compact "9/15" chip, coloured the same way as map pins and coverage rows. */
export default function AvailabilityPill({ available, total }: AvailabilityPillProps) {
  const ratio = total === 0 ? 0 : available / total;

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-1 text-label-bold text-on-surface-variant">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: coverageColor(ratio) }}
        aria-hidden="true"
      />
      {available}/{total}
    </span>
  );
}
