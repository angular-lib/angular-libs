import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface BatterySignalState {
  /** If the Battery Status API is supported in the browser. */
  supported: boolean;
  /** Whether the battery status is currently loading. */
  loading: boolean;
  /** Whether the battery is currently charging. */
  charging: boolean;
  /** Time remaining in seconds to fully charge the battery. */
  chargingTime: number;
  /** Time remaining in seconds until the battery is completely discharged. */
  dischargingTime: number;
  /** Level value spanning from 0 to 1. */
  level: number;
}

/**
 * Tracks browser battery levels and charging metrics reactively.
 *
 * @returns A Readonly Signal containing the battery status options.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (battery().supported) {
 *       <p>Battery level: {{ battery().level * 100 }}%</p>
 *       <p>Charging status: {{ battery().charging ? 'Charging' : 'Unplugged' }}</p>
 *     }
 *   `
 * })
 * export class BatteryComponent {
 *   battery = batterySignal();
 * }
 * ```
 */
export function batterySignal(): Signal<BatterySignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const navigator = win?.navigator as any;
  const supported = !!(navigator && 'getBattery' in navigator);

  const state = signal<BatterySignalState>({
    supported,
    loading: supported,
    charging: false,
    chargingTime: 0,
    dischargingTime: 1.0,
    level: 1.0,
  });

  let battery: any = null;

  const updateState = () => {
    if (battery) {
      state.set({
        supported: true,
        loading: false,
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        level: battery.level,
      });
    }
  };

  const bindEvents = () => {
    if (battery) {
      battery.addEventListener('chargingchange', updateState);
      battery.addEventListener('chargingtimechange', updateState);
      battery.addEventListener('dischargingtimechange', updateState);
      battery.addEventListener('levelchange', updateState);
    }
  };

  const unbindEvents = () => {
    if (battery) {
      battery.removeEventListener('chargingchange', updateState);
      battery.removeEventListener('chargingtimechange', updateState);
      battery.removeEventListener('dischargingtimechange', updateState);
      battery.removeEventListener('levelchange', updateState);
    }
  };

  if (win && supported) {
    navigator.getBattery().then(
      (bat: any) => {
        battery = bat;
        updateState();
        bindEvents();
      },
      () => {
        state.set({ ...state(), supported: false, loading: false });
      }
    );

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        unbindEvents();
      });
    }
  }

  return state.asReadonly();
}
