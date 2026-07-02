import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface BluetoothSignalState {
  /** If the Web Bluetooth API is supported by the browser. */
  supported: boolean;
  /** Representing the active Bluetooth device if paired and selected. */
  device: any | null;
  /** Active connection status representing if gatt connection is established. */
  connected: boolean;
  /** Flag representing pairing/connection request state. */
  loading: boolean;
  /** Active error thrown during bluetooth operations. */
  error: Error | null;
}

export interface BluetoothSignal {
  /** Readonly signal tracking support, connection states, and errors. */
  state: Signal<BluetoothSignalState>;
  /** Requests scanning and pairing of a nearby Bluetooth peripheral option. */
  requestDevice(options?: any): Promise<any>;
  /** Cleanly disconnects the current paired device's GATT server. */
  disconnect(): void;
}

/**
 * Accesses and interacts with nearby Web Bluetooth peripherals securely.
 *
 * @returns An object matching BluetoothSignal with reactive states and command controls.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (bt.state().supported) {
 *       <button (click)="bt.requestDevice({ acceptAllDevices: true })">Pair Device</button>
 *       <p>Connected: {{ bt.state().connected }}</p>
 *     }
 *   `
 * })
 * export class BluetoothComponent {
 *   bt = bluetoothSignal();
 * }
 * ```
 */
export function bluetoothSignal(): BluetoothSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;
  const abortController = new AbortController();

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const navigator = win?.navigator as any;
  const bluetooth = navigator?.bluetooth;
  const supported = !!bluetooth;

  const state = signal<BluetoothSignalState>({
    supported,
    device: null,
    connected: false,
    loading: false,
    error: null,
  });

  let activeDevice: any = null;

  // Bound to the specific device it was registered on (via closure), so a disconnect event
  // from a device that is no longer the active one is safely ignored instead of being
  // misattributed to whatever device happens to be active at the time it fires.
  const handleDisconnected = (device: any) => () => {
    if (device !== activeDevice) return;
    state.set({
      supported,
      device: activeDevice,
      connected: false,
      loading: false,
      error: null,
    });
  };

  let removeActiveDeviceListener: (() => void) | null = null;

  const requestDevice = async (options?: any): Promise<any> => {
    if (!supported) {
      const err = new Error('Web Bluetooth is not supported in this browser.');
      state.update((prev) => ({ ...prev, error: err }));
      throw err;
    }

    state.update((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const device = await bluetooth.requestDevice({
        ...options,
        signal: abortController.signal,
      });

      // Detach from whatever device was previously active so it doesn't leak or keep
      // receiving disconnect events after being replaced.
      removeActiveDeviceListener?.();
      activeDevice = device;

      const onDisconnected = handleDisconnected(device);
      device.addEventListener('gattserverdisconnected', onDisconnected);
      removeActiveDeviceListener = () => device.removeEventListener('gattserverdisconnected', onDisconnected);

      const isGattConnected = device.gatt ? device.gatt.connected : false;

      state.set({
        supported,
        device,
        connected: isGattConnected,
        loading: false,
        error: null,
      });

      return device;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      activeDevice = null;
      state.set({
        supported,
        device: null,
        connected: false,
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      throw err;
    }
  };

  const disconnect = () => {
    if (activeDevice) {
      removeActiveDeviceListener?.();
      removeActiveDeviceListener = null;
      if (activeDevice.gatt && activeDevice.gatt.connected) {
        activeDevice.gatt.disconnect();
      }
    }
    activeDevice = null;
    state.set({
      supported,
      device: null,
      connected: false,
      loading: false,
      error: null,
    });
  };

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      abortController.abort();
      disconnect();
    });
  }

  return {
    state: state.asReadonly(),
    requestDevice,
    disconnect,
  };
}
