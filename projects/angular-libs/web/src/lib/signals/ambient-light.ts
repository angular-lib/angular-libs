import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface AmbientLightSignalState {
  /** If the AmbientLightSensor API is supported by the browser. */
  supported: boolean;
  /** Whether the sensor is actively monitoring. */
  active: boolean;
  /** The current ambient light level in lux. */
  illuminance: number | null;
  /** Any active error thrown during sensor operations. */
  error: Error | null;
}

export interface AmbientLightSensorOptions {
  /** Desired number of samples per second (Hz). */
  frequency?: number;
}

export interface AmbientLightSignal {
  /** Readonly signal tracking ambient light lux measurements and state. */
  state: Signal<AmbientLightSignalState>;
  /** Starts listening to ambient light changes. */
  start(): void;
  /** Stops listening and disables the ambient light sensor. */
  stop(): void;
}

/**
 * Accesses the device's physical ambient light sensor to track ambient light levels reactively.
 *
 * @param options Configuration options for the underlying AmbientLightSensor.
 * @returns An AmbientLightSignal tracking illuminance (lux) levels reactively with start/stop control.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (light.state().supported) {
 *       <button (click)="light.state().active ? light.stop() : light.start()">
 *         {{ light.state().active ? 'Stop' : 'Start' }} Monitoring
 *       </button>
 *       <p>Illuminance: {{ light.state().illuminance }} lux</p>
 *     }
 *   `
 * })
 * export class LightComponent {
 *   light = ambientLightSignal();
 * }
 * ```
 */
export function ambientLightSignal(options?: AmbientLightSensorOptions): AmbientLightSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const ambientLightClass = win ? (win as any).AmbientLightSensor : null;
  const supported = !!ambientLightClass;

  const state = signal<AmbientLightSignalState>({
    supported,
    active: false,
    illuminance: null,
    error: null,
  });

  let sensorInstance: any = null;

  const handleReading = () => {
    state.set({
      supported,
      active: true,
      illuminance: sensorInstance.illuminance ?? null,
      error: null,
    });
  };

  const handleActivate = () => {
    state.update((prev) => ({ ...prev, active: true, error: null }));
  };

  const handleError = (event: any) => {
    const error = event.error || new Error('Ambient light sensor error.');
    state.update((prev) => ({
      ...prev,
      active: false,
      error,
    }));
  };

  const start = () => {
    if (!supported) {
      const err = new Error('Ambient Light Sensor is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      return;
    }

    try {
      if (!sensorInstance) {
        sensorInstance = new ambientLightClass(options);
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
        illuminance: null,
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
