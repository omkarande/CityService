import { Link } from 'react-router-dom';
import type { MapPin } from '../api/types';
import { KIND_LABEL, coverageColor, coverageLabel, initialsOf } from '../lib/format';
import Icon from './Icon';

interface AreaCardProps {
  to: string;
  label: string;
  cityName: string;
  /** Present only where we actually hold coverage data for this exact locality. */
  pin?: MapPin;
}

/**
 * Avatar tone is identity, not status — the coverage dot below already
 * carries red/amber/green. Rotates through the theme's "fixed" tonal pairs
 * (built for exactly this: a tinted surface with a pre-paired readable
 * text colour) so every area gets a stable, on-brand colour of its own.
 */
const TONES = [
  { bg: '#dae2ff', text: '#001848' }, // primary-fixed / on-primary-fixed
  { bg: '#ffdbc8', text: '#321200' }, // secondary-fixed / on-secondary-fixed
  { bg: '#afecff', text: '#001f27' }, // tertiary-fixed / on-tertiary-fixed
  { bg: '#b2c5ff', text: '#001848' }, // primary-fixed-dim / on-primary-fixed
  { bg: '#ffb68b', text: '#321200' }, // secondary-fixed-dim / on-secondary-fixed
  { bg: '#48d7f9', text: '#001f27' }, // tertiary-fixed-dim / on-tertiary-fixed
];

function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

/** One area row on the City screen — richer than a bare name, still a single tap. */
export default function AreaCard({ to, label, cityName, pin }: AreaCardProps) {
  const ratio = pin && pin.total > 0 ? pin.available / pin.total : 0;
  const ringColor = pin ? coverageColor(ratio) : undefined;
  const tone = pin ? toneFor(pin.locality.id) : undefined;
  const kindTag = pin ? KIND_LABEL[pin.locality.kind] : undefined;

  return (
    <Link
      to={to}
      className="flex items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-3 transition-colors hover:border-primary-container/40 hover:bg-surface-container-low active:scale-[0.99]"
    >
      <span
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-body-md font-bold',
          pin ? '' : 'border-2 border-dashed border-outline-variant bg-surface-container text-on-surface-variant',
        ].join(' ')}
        style={tone ? { backgroundColor: tone.bg, color: tone.text } : undefined}
        aria-hidden="true"
      >
        {initialsOf(label)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-semibold text-on-surface">{label}</span>

        <span className="block truncate text-body-md text-on-surface-variant">
          {cityName}
          {pin?.locality.pincode && ` · ${pin.locality.pincode}`}
          {kindTag && ` · ${kindTag}`}
          {!pin && ' · Not tracked yet'}
        </span>

        {pin && (
          <span className="mt-0.5 flex items-center gap-1.5 text-label-sm text-on-surface-variant">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ringColor }} aria-hidden="true" />
            {pin.available}/{pin.total} · {coverageLabel(pin.available, pin.total)}
          </span>
        )}
      </span>

      <Icon name="chevron_right" className="shrink-0 text-outline" size={20} />
    </Link>
  );
}
