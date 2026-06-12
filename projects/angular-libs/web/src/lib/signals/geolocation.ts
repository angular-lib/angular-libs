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
  error: GeolocationPositionError | null;
  timestamp: number | null;
}

export interface GeolocationSignalOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

/**
 * Tracks geographical position coordinates and accuracy details using standard navigator geolocation.
 *
 * @param options GeolocationPositionOptions for tracking accuracy and timeouts.
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
 *     }
 *   `
 * })
 * export class GeoComponent {
 *   geo = geolocationSignal({ enableHighAccuracy: true });
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

  const state = signal<GeolocationSignalState>({
    loading: true,
    coords: null,
    error: null,
    timestamp: null,
  });

  if (!win || !win.navigator?.geolocation) {
    state.set({
      loading: false,
      coords: null,
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

  const successCallback = (position: GeolocationPosition) => {
    state.set({
      loading: false,
      coords: position.coords,
      error: null,
      timestamp: position.timestamp
    });
  };

  const errorCallback = (error: GeolocationPositionError) => {
    state.set({
      loading: false,
      coords: null,
      error,
      timestamp: Date.now()
    });
  };

  const watchId = win.navigator.geolocation.watchPosition(
    successCallback,
    errorCallback,
    options
  );

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      win.navigator.geolocation.clearWatch(watchId);
    });
  }

  return state.asReadonly();
}
