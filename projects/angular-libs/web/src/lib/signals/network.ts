import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface NetworkSignalState {
  /** If the detailed Network Information API is supported by the current browser. */
  supported: boolean;
  /** Whether the user is connected to a network. */
  online: boolean;
  /** Expressed downlink velocity in megabits per second (Mbps). */
  downlink: number | null;
  /** The effective network connection type ('slow-2g', '2g', '3g', or '4g'). */
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | null;
  /** Approximate round-trip latency in milliseconds. */
  rtt: number | null;
  /** Indicates whether the user has toggled a low-data bandwidth preference on the browser/system level. */
  saveData: boolean | null;
  /** Derived boolean indicating slow/restricted connection (e.g. 2g, 3g, saveData active, or downlink < 1 Mbps). */
  isLowBandwidth: boolean;
}

/**
 * Tracks detailed diagnostic properties and change timings of cellular/broadband connection profiles reactively.
 *
 * @returns A Readonly Signal enclosing network connection diagnostics metadata.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <p>Connection: {{ network().online ? 'Online' : 'Offline' }}</p>
 *     @if (network().supported) {
 *       <p>Speed: {{ network().downlink }} Mbps ({{ network().effectiveType }})</p>
 *       <p>RTT: {{ network().rtt }}ms</p>
 *     }
 *   `
 * })
 * export class NetworkComponent {
 *   network = networkSignal();
 * }
 * ```
 */
export function networkSignal(): Signal<NetworkSignalState> {
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
  // Fallbacks for different vendor prefixes of Connection
  const connection = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;

  const buildState = (isOnline: boolean, conn: any): NetworkSignalState => {
    if (!conn) {
      return {
        supported: false,
        online: isOnline,
        downlink: null,
        effectiveType: null,
        rtt: null,
        saveData: null,
        isLowBandwidth: false,
      };
    }

    const downlink = conn.downlink ?? null;
    const effectiveType = conn.effectiveType ?? null;
    const rtt = conn.rtt ?? null;
    const saveData = conn.saveData ?? null;

    const isLowBandwidth =
      saveData === true ||
      effectiveType === 'slow-2g' ||
      effectiveType === '2g' ||
      effectiveType === '3g' ||
      (downlink !== null && downlink < 1.0);

    return {
      supported: true,
      online: isOnline,
      downlink,
      effectiveType,
      rtt,
      saveData,
      isLowBandwidth,
    };
  };

  const getInitialState = (): NetworkSignalState => {
    const isOnline = navigator?.onLine ?? true;
    return buildState(isOnline, connection);
  };

  const state = signal<NetworkSignalState>(getInitialState());

  if (win) {
    const updateConnection = () => {
      const isOnline = navigator?.onLine ?? true;
      state.set(buildState(isOnline, connection));
    };

    win.addEventListener('online', updateConnection);
    win.addEventListener('offline', updateConnection);

    if (connection) {
      connection.addEventListener('change', updateConnection);
    }

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        win.removeEventListener('online', updateConnection);
        win.removeEventListener('offline', updateConnection);
        if (connection) {
          connection.removeEventListener('change', updateConnection);
        }
      });
    }
  }

  return state.asReadonly();
}
