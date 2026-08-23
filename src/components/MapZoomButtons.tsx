import { useMap } from 'react-leaflet';
import Icon from './Icon';

/** Leaflet's default zoom control sits under our chrome; these match the rest of the UI. */
export default function MapZoomButtons({ className = 'absolute right-3 bottom-3' }: { className?: string }) {
  const map = useMap();
  return (
    <div className={`${className} z-[1000] flex flex-col gap-1.5`}>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map.zoomIn()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="add" size={18} />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="remove" size={18} />
      </button>
    </div>
  );
}
