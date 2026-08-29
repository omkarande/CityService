import Icon from './Icon';

interface MapZoomButtonsProps {
  map: google.maps.Map | null;
  className?: string;
}

export default function MapZoomButtons({
  map,
  className = 'absolute right-3 bottom-3',
}: MapZoomButtonsProps) {
  return (
    <div className={`${className} z-[1000] flex flex-col gap-1.5`}>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => map?.setZoom((map.getZoom() ?? 16) + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="add" size={18} />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => map?.setZoom((map.getZoom() ?? 16) - 1)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md active:scale-90"
      >
        <Icon name="remove" size={18} />
      </button>
    </div>
  );
}
