import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface GyroscopeSignalState {
  /** If the Gyroscope API is supported by the browser. */
  supported: boolean;
  /** Whether the sensor is actively monitoring. */
  active: boolean;
  /** Angular velocity around the x-axis in rad/s. */
  x: number | null;
  /** Angular velocity around the y-axis in rad/s. */
  y: number | null;
  /** Angular velocity around the z-axis in rad/s. */
  z: number | null;
  /** Any active error thrown during sensor operations. */
  error: Error | null;
}

export interface GyroscopeSensorOptions {
  /** Desired number of samples per second (Hz). */
  frequency?: number;
  /** Coordinate frame of reference. 'device' or 'screen'. Defaults to 'device'. */
  referenceFrame?: 'device' | 'screen';
}

export interface GyroscopeSignal {
  /** Readonly signal tracking gyroscope measurements and state. */
  state: Signal<GyroscopeSignalState>;
  /** Starts listening to gyroscope changes. */
  start(): void;
  /** Stops listening and disables the gyroscope sensor. */
  stop(): void;
}

/**
 * Accesses the device's physical gyroscope sensor to track rotational changes (angular velocity) reactively.
 *
 * @param options Configuration options for the underlying Gyroscope sensor.
 * @returns A GyroscopeSignal tracking rotational changes reactively with start/stop control.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (gyro.state().supported) {
 *       <button (click)="gyro.state().active ? gyro.stop() : gyro.start()">
 *         {{ gyro.state().active ? 'Stop' : 'Start' }} Tracking
 *       </button>
 *       <p>X-axis (Pitch): {{ gyro.state().x }} rad/s</p>
 *       <p>Y-axis (Roll): {{ gyro.state().y }} rad/s</p>
 *       <p>Z-axis (Yaw): {{ gyro.state().z }} rad/s</p>
 *     }
 *   `
 * })
 * export class GyroscopeComponent {
 *   gyro = gyroscopeSignal();
 * }
 * ```
 */
export function gyroscopeSignal(options?: GyroscopeSensorOptions): GyroscopeSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const gyroscopeClass = win ? (win as any).Gyroscope : null;
  const supported = !!gyroscopeClass;

  const state = signal<GyroscopeSignalState>({
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
    const error = event.error || new Error('Gyroscope sensor error.');
    state.update((prev) => ({
      ...prev,
      active: false,
      error,
    }));
  };

  const start = () => {
    if (!supported) {
      const err = new Error('Gyroscope is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      return;
    }

    try {
      if (!sensorInstance) {
        sensorInstance = new gyroscopeClass(options);
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
