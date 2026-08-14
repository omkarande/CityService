import { useState } from 'react';
import type { Platform } from '../api/types';
import { readableTextColor } from '../lib/format';

interface LogoTileProps {
  platform: Platform;
  size?: 'md' | 'lg';
  muted?: boolean;
}

/**
 * Brand mark when we have a usable asset, initials on the brand colour when we
 * don't — including when the image 404s at runtime, so a dead logo URL degrades
 * to something readable instead of an empty box.
 */
export default function LogoTile({ platform, size = 'md', muted = false }: LogoTileProps) {
  const [failed, setFailed] = useState(false);

  const dimension = size === 'lg' ? 'h-14 w-14 text-body-lg' : 'h-12 w-12 text-body-md';
  const dim = muted ? 'opacity-45 grayscale' : '';

  if (platform.logoUrl && !failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant/40 bg-white ${dimension} ${dim}`}
      >
        {/* Decorative: the platform name is always rendered next to the tile. */}
        <img
          src={platform.logoUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold ${dimension} ${dim}`}
      style={{ backgroundColor: platform.brandColor, color: readableTextColor(platform.brandColor) }}
      aria-hidden="true"
    >
      {platform.initials}
    </span>
  );
}
