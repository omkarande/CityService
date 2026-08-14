import type { ConfidenceTier } from '../api/types';
import { TIER_LABEL } from '../lib/format';

const SEGMENTS: Record<ConfidenceTier, { filled: number; color: string; text: string }> = {
  verified: { filled: 3, color: 'bg-success-bright', text: 'text-success' },
  likely: { filled: 2, color: 'bg-warning-bright', text: 'text-warning' },
  unconfirmed: { filled: 1, color: 'bg-neutral', text: 'text-neutral' },
};

interface ConfidenceMeterProps {
  tier: ConfidenceTier;
  /** Hide the word, keep the bars — for dense list rows. */
  compact?: boolean;
}

/**
 * Three bars rather than a percentage. The underlying number is a heuristic;
 * showing "62%" would imply a precision the data does not have.
 */
export default function ConfidenceMeter({ tier, compact = false }: ConfidenceMeterProps) {
  const { filled, color, text } = SEGMENTS[tier];

  return (
    <span className="inline-flex items-center gap-1.5" title={`Confidence: ${TIER_LABEL[tier]}`}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-full ${i < filled ? color : 'bg-outline-variant'}`}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      {!compact && <span className={`text-label-bold ${text}`}>{TIER_LABEL[tier]}</span>}
      <span className="sr-only">Confidence: {TIER_LABEL[tier]}</span>
    </span>
  );
}
