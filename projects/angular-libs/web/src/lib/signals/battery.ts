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
  /** Derived boolean indicating if the battery level is below threshold and not actively charging. */
  isLowBattery: boolean;
}

export interface BatterySignalOptions {
  /** Low battery threshold ratio (0 to 1). Defaults to 0.15 (15%). */
  lowBatteryThreshold?: number;
}

/**
 * Tracks browser battery levels and charging metrics reactively.
 *
 * @param options Configurations for low battery alert threshold.
 * @returns A Readonly Signal containing the battery status options.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (battery().supported) {
 *       <p>Battery level: {{ battery().level * 100 }}%</p>
 *       <p>Charging status: {{ battery().charging ? 'Charging' : 'Unplugged' }}</p>
 *       @if (battery().isLowBattery) {
 *         <p class="alert">Warning: Low Battery! Save your work.</p>
 *       }
 *     }
 *   `
 * })
 * export class BatteryComponent {
 *   battery = batterySignal({ lowBatteryThreshold: 0.20 });
 * }
 * ```
 */
export function batterySignal(options?: BatterySignalOptions): Signal<BatterySignalState> {
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

  const lowThreshold = options?.lowBatteryThreshold ?? 0.15;

  const state = signal<BatterySignalState>({
    supported,
    loading: supported,
    charging: false,
    chargingTime: 0,
    dischargingTime: 1.0,
    level: 1.0,
    isLowBattery: false,
  });

  let battery: any = null;

  const updateState = () => {
    if (battery) {
      const charging = battery.charging;
      const level = battery.level;
      const isLowBattery = !charging && level <= lowThreshold;

      state.set({
        supported: true,
        loading: false,
        charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        level,
        isLowBattery,
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
    let destroyed = false;

    navigator.getBattery().then(
      (bat: any) => {
        if (destroyed) return;
        battery = bat;
        updateState();
        bindEvents();
      },
      () => {
        if (destroyed) return;
        state.set({ ...state(), supported: false, loading: false });
      }
    );

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        destroyed = true;
        unbindEvents();
      });
    }
  }

  return state.asReadonly();
}
