import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export class LocationUnavailableError extends Error {
  constructor(message = 'This browser cannot share your location.') {
    super(message);
    this.name = 'LocationUnavailableError';
  }
}

export class LocationPermissionError extends Error {
  constructor(message = 'Location permission denied.') {
    super(message);
    this.name = 'LocationPermissionError';
  }
}

export async function getCurrentCoords(): Promise<{ latitude: number; longitude: number }> {
  if (Capacitor.isNativePlatform()) {
    const current = await Geolocation.checkPermissions();
    let location = current.location;
    let coarse = current.coarseLocation;
    if (location !== 'granted' && coarse !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      location = requested.location;
      coarse = requested.coarseLocation;
    }
    if (location !== 'granted' && coarse !== 'granted') {
      throw new LocationPermissionError();
    }

    try {
      const pos = await Geolocation.getCurrentPosition({ timeout: 10_000, enableHighAccuracy: true });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      throw new LocationUnavailableError('Could not read your location. Try again, or search instead.');
    }
  }

  if (!navigator.geolocation) {
    throw new LocationUnavailableError();
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new LocationPermissionError());
          return;
        }
        reject(new LocationUnavailableError());
      },
      { timeout: 10_000 },
    );
  });
}
