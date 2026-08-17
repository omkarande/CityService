import { starRatingLabel, starsFor } from '../lib/format';
import Icon from './Icon';

const STAR_ON = 'text-[#fb7800]';
const STAR_OFF = 'text-[#c3c6d6]';

interface CoverageStarsProps {
  available: number;
  total: number;
}

/** Inline 0–5 star read on how much of the catalogue works here, sits next to a heading. */
export default function CoverageStars({ available, total }: CoverageStarsProps) {
  const stars = starsFor(available, total);
  const full = Math.floor(stars);
  const hasHalf = stars - full >= 0.5;

  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => {
          const isFull = i < full;
          const isHalf = !isFull && i === full && hasHalf;
          return (
            <Icon
              key={i}
              name={isHalf ? 'star_half' : 'star'}
              fill={isFull}
              className={isFull || isHalf ? STAR_ON : STAR_OFF}
              size={16}
            />
          );
        })}
      </span>
      <span className="text-label-sm font-semibold text-on-surface-variant">{starRatingLabel(stars)}</span>
      <span className="sr-only">{`${stars} out of 5 stars, ${available} of ${total} apps available`}</span>
    </span>
  );
}
