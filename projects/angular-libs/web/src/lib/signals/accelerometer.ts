import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface AccelerometerSignalState {
  /** If the Accelerometer API is supported by the browser. */
  supported: boolean;
  /** Whether the sensor is actively monitoring. */
  active: boolean;
  /** Acceleration along the x-axis in m/s². */
  x: number | null;
  /** Acceleration along the y-axis in m/s². */
  y: number | null;
  /** Acceleration along the z-axis in m/s². */
  z: number | null;
  /** Any active error thrown during sensor operations. */
  error: Error | null;
}

export interface AccelerometerSensorOptions {
  /** Desired number of samples per second (Hz). */
  frequency?: number;
  /** Coordinate frame of reference. 'device' or 'screen'. Defaults to 'device'. */
  referenceFrame?: 'device' | 'screen';
}

export interface AccelerometerSignal {
  /** Readonly signal tracking accelerometer measurements and state. */
  state: Signal<AccelerometerSignalState>;
  /** Starts listening to accelerometer changes. */
  start(): void;
  /** Stops listening and disables the accelerometer sensor. */
  stop(): void;
}

/**
 * Accesses the device's physical accelerometer sensor to track motion changes reactively.
 *
 * @param options Configuration options for the underlying Accelerometer sensor.
 * @returns An AccelerometerSignal tracking acceleration values (3-axis) reactively with start/stop control.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (acc.state().supported) {
 *       <button (click)="acc.state().active ? acc.stop() : acc.start()">
 *         {{ acc.state().active ? 'Stop' : 'Start' }} Tracking
 *       </button>
 *       <p>X: {{ acc.state().x }} m/s²</p>
 *       <p>Y: {{ acc.state().y }} m/s²</p>
 *       <p>Z: {{ acc.state().z }} m/s²</p>
 *     }
 *   `
 * })
 * export class AccelerometerComponent {
 *   acc = accelerometerSignal();
 * }
 * ```
 */
export function accelerometerSignal(options?: AccelerometerSensorOptions): AccelerometerSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const accelerometerClass = win ? (win as any).Accelerometer : null;
  const supported = !!accelerometerClass;

  const state = signal<AccelerometerSignalState>({
    supported,
    active: false,
    x: null,
    y: null,
    z: null,
    error: null,
  });

  let sensorInstance: any = null;

  const handleReading = () => {
    state.set({
      supported,
      active: true,
      x: sensorInstance.x ?? null,
      y: sensorInstance.y ?? null,
      z: sensorInstance.z ?? null,
      error: null,
    });
  };

  const handleActivate = () => {
    state.update((prev) => ({ ...prev, active: true, error: null }));
  };

  const handleError = (event: any) => {
    const error = event.error || new Error('Accelerometer sensor error.');
    state.update((prev) => ({
      ...prev,
      active: false,
      error,
    }));
  };

  const start = () => {
    if (!supported) {
      const err = new Error('Accelerometer is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      return;
    }

    try {
      if (!sensorInstance) {
        sensorInstance = new accelerometerClass(options);
        sensorInstance.addEventListener('reading', handleReading);
        sensorInstance.addEventListener('activate', handleActivate);
        sensorInstance.addEventListener('error', handleError);
      }
      sensorInstance.start();
    } catch (err: any) {
      const parsedErr = err instanceof Error ? err : new Error(String(err));
      state.update((prev) => ({
        ...prev,
        active: false,
        error: parsedErr,
      }));
    }
  };

  const stop = () => {
    if (sensorInstance) {
      sensorInstance.stop();
      state.set({
        supported,
        active: false,
        x: null,
        y: null,
        z: null,
        error: null,
      });
    }
  };

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      if (sensorInstance) {
        sensorInstance.stop();
        sensorInstance.removeEventListener('reading', handleReading);
        sensorInstance.removeEventListener('activate', handleActivate);
        sensorInstance.removeEventListener('error', handleError);
      }
    });
  }

  return {
    state: state.asReadonly(),
    start,
    stop,
  };
}
