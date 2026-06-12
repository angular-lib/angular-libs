import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface DeviceOrientationSignalState {
  /** If the Device Orientation API is supported in the browser. */
  supported: boolean;
  /** Whether the orientation is coordinates relative to earth. */
  absolute: boolean;
  /** Motion around the z-axis (0 to 360 degrees). */
  alpha: number | null;
  /** Motion around the x-axis (-180 to 180 degrees). */
  beta: number | null;
  /** Motion around the y-axis (-90 to 90 degrees). */
  gamma: number | null;
}

export interface DeviceOrientationSignal {
  /** The reactive orientation state. */
  state: Signal<DeviceOrientationSignalState>;
  /** Requests iOS Safari permissions (required for modern Apple mobile devices). */
  requestPermission(): Promise<boolean>;
}

/**
 * Tracks physical device orientation and tilt values (alpha, beta, gamma coordinates) reactively.
 *
 * @returns A DeviceOrientationSignal containing the reactive state and a requestPermission trigger helper.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (orientation.state().supported) {
 *       <button (click)="orientation.requestPermission()">Enable on iOS</button>
 *       <p>Beta (tilt forward/backward): {{ orientation.state().beta }}°</p>
 *     }
 *   `
 * })
 * export class OrientationComponent {
 *   orientation = deviceOrientationSignal();
 * }
 * ```
 */
export function deviceOrientationSignal(): DeviceOrientationSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const supported = !!(win && 'DeviceOrientationEvent' in win);

  const state = signal<DeviceOrientationSignalState>({
    supported,
    absolute: false,
    alpha: null,
    beta: null,
    gamma: null,
  });

  const handleOrientation = (event: DeviceOrientationEvent) => {
    state.set({
      supported: true,
      absolute: event.absolute,
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
    });
  };

  if (win && supported) {
    win.addEventListener('deviceorientation', handleOrientation);

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        win.removeEventListener('deviceorientation', handleOrientation);
      });
    }
  }

  const requestPermission = async (): Promise<boolean> => {
    if (
      win &&
      'DeviceOrientationEvent' in win &&
      typeof (win.DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const result = await (win.DeviceOrientationEvent as any).requestPermission();
        if (result === 'granted') {
          // Re-trigger listener because it might be blocked prior to permission
          win.removeEventListener('deviceorientation', handleOrientation);
          win.addEventListener('deviceorientation', handleOrientation);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }
    return true; // Already allowed or fallback
  };

  return {
    state: state.asReadonly(),
    requestPermission,
  };
}
