import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface MediaDevicesSignalState {
  /** Check if the Media Devices API is supported. */
  supported: boolean;
  /** List of all detected video and audio hardware inputs/outputs. */
  devices: MediaDeviceInfo[];
  /** State indicator representing if device list fetching is in progress. */
  loading: boolean;
  /** Active system errors occurred during device query operations. */
  error: Error | null;
}

/**
 * Tracks physical hardware media devices (cameras, microphones, speakers) and responds to device change events.
 *
 * @returns A Readonly Signal wrapping detected media devices inventory.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (media().supported) {
 *       <h3>Recording Options:</h3>
 *       <ul>
 *         @for (device of media().devices; track device.deviceId) {
 *           <li>{{ device.label }} ({{ device.kind }})</li>
 *         }
 *       </ul>
 *     }
 *   `
 * })
 * export class MediaComponent {
 *   media = mediaDevicesSignal();
 * }
 * ```
 */
export function mediaDevicesSignal(): Signal<MediaDevicesSignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const mediaDevices = win?.navigator?.mediaDevices;
  const supported = !!(mediaDevices && mediaDevices.enumerateDevices);

  const state = signal<MediaDevicesSignalState>({
    supported,
    devices: [],
    loading: supported,
    error: null,
  });

  const fetchDevices = async () => {
    if (!supported) return;

    try {
      const list = await mediaDevices.enumerateDevices();
      state.set({
        supported: true,
        devices: list,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      state.set({
        supported: true,
        devices: [],
        loading: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  };

  if (win && supported) {
    fetchDevices();

    const handleDeviceChange = () => {
      fetchDevices();
    };

    mediaDevices.addEventListener('devicechange', handleDeviceChange);

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      });
    }
  }

  return state.asReadonly();
}
