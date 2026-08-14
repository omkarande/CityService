import { Link } from 'react-router-dom';
import { FEATURED_CITIES } from '../data/featuredCities';

/**
 * The "City Cards" section from DESIGN.md: a square-ish photo grid of major
 * cities. Tapping one opens `/city/:id`, which shows that city's popular
 * areas — see src/screens/City.tsx.
 */
export default function CityGrid() {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-outline-variant/60 p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {FEATURED_CITIES.map((city) => (
            <Link
              key={city.id}
              to={`/city/${city.id}`}
              className="group relative aspect-[3/2] overflow-hidden rounded-md shadow-soft transition-transform active:scale-95"
            >
              <img
                src={city.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              {!city.seeded && (
                <span className="absolute right-1 top-1 rounded-full bg-black/55 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                  Soon
                </span>
              )}

              <span className="absolute inset-x-0 bottom-0 p-1.5">
                <span className="block truncate text-label-bold leading-tight text-white">{city.name}</span>
                <span className="block truncate text-[9px] leading-tight text-white/75">{city.landmark}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-right text-[10px] text-on-surface-variant/70">Photos via Wikimedia Commons</p>
    </div>
  );
}
