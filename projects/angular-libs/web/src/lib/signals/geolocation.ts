import {
  signal,
  Signal,
  inject,
  DestroyRef
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface GeolocationSignalState {
  loading: boolean;
  coords: GeolocationCoordinates | null;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  error: GeolocationPositionError | null;
  timestamp: number | null;
}

export interface GeolocationSignalOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  /** 'watch' tracks continuous movement (default), 'once' fetches a single position snapshot. */
  mode?: 'watch' | 'once';
  /** Minimum distance change in meters required before updating state in 'watch' mode. */
  distanceFilter?: number;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Tracks geographical position coordinates and accuracy details using standard navigator geolocation.
 *
 * @param options GeolocationPositionOptions for tracking accuracy, timeouts, mode, and distance threshold filtering.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (geo().loading) {
 *       <p>Locating...</p>
 *     } @else if (geo().error) {
 *       <p>Error: {{ geo().error?.message }}</p>
 *     } @else {
 *       <p>Lat: {{ geo().coords?.latitude }}, Lng: {{ geo().coords?.longitude }}</p>
 *       <p>Speed: {{ geo().speed }} m/s, Accuracy: {{ geo().accuracy }}m</p>
 *     }
 *   `
 * })
 * export class GeoComponent {
 *   geo = geolocationSignal({ enableHighAccuracy: true, distanceFilter: 10 });
 * }
 * ```
 */
export function geolocationSignal(
  options?: GeolocationSignalOptions
): Signal<GeolocationSignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const mode = options?.mode ?? 'watch';
  const distanceFilter = options?.distanceFilter;

  const state = signal<GeolocationSignalState>({
    loading: true,
    coords: null,
    speed: null,
    heading: null,
    accuracy: null,
    error: null,
    timestamp: null,
  });

  if (!win || !win.navigator?.geolocation) {
    state.set({
      loading: false,
      coords: null,
      speed: null,
      heading: null,
      accuracy: null,
      error: {
        code: 0,
        message: 'Geolocation is not supported by this browser.',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError,
      timestamp: Date.now()
    });
    return state.asReadonly();
  }

  let lastCoords: GeolocationCoordinates | null = null;

  const successCallback = (position: GeolocationPosition) => {
    const coords = position.coords;
    if (
      distanceFilter &&
      distanceFilter > 0 &&
      lastCoords
    ) {
      const dist = calculateDistanceMeters(
        lastCoords.latitude,
        lastCoords.longitude,
        coords.latitude,
        coords.longitude
      );
      if (dist < distanceFilter) {
        return; // Ignore updates smaller than distance threshold
      }
    }

    lastCoords = coords;
    state.set({
      loading: false,
      coords,
      speed: coords.speed ?? null,
      heading: coords.heading ?? null,
      accuracy: coords.accuracy ?? null,
      error: null,
      timestamp: position.timestamp
    });
  };

  const errorCallback = (error: GeolocationPositionError) => {
    state.set({
      loading: false,
      coords: null,
      speed: null,
      heading: null,
      accuracy: null,
      error,
      timestamp: Date.now()
    });
  };

  const geoOptions: PositionOptions = {
    enableHighAccuracy: options?.enableHighAccuracy,
    timeout: options?.timeout,
    maximumAge: options?.maximumAge,
  };

  if (mode === 'once') {
    win.navigator.geolocation.getCurrentPosition(
      successCallback,
      errorCallback,
      geoOptions
    );
  } else {
    const watchId = win.navigator.geolocation.watchPosition(
      successCallback,
      errorCallback,
      geoOptions
    );

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        win.navigator.geolocation.clearWatch(watchId);
      });
    }
  }

  return state.asReadonly();
}
