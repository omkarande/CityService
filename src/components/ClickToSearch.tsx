import { useMapEvents } from 'react-leaflet';

interface ClickToSearchProps {
  onPick: (lat: number, lng: number) => void;
}

/**
 * Makes a Leaflet map itself selectable: a tap anywhere that isn't a pin
 * resolves to the nearest known locality, the same way "Use my location"
 * does. Shared by the Home preview map and the full Nearby map so both
 * behave identically.
 */
export default function ClickToSearch({ onPick }: ClickToSearchProps) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
