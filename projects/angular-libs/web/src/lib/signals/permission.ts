import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type PermissionSignalState = PermissionState | 'unsupported' | 'loading';

/**
 * Tracks the permission status of browser APIs reactively (e.g., 'geolocation', 'notifications').
 *
 * @param name The PermissionName to query and track.
 * @returns A Readonly Signal containing the current PermissionState, 'loading', or 'unsupported'.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <p>Geolocation permission: {{ geoPermission() }}</p>
 *   `
 * })
 * export class PermissionComponent {
 *   geoPermission = permissionSignal('geolocation');
 * }
 * ```
 */
export function permissionSignal(name: PermissionName): Signal<PermissionSignalState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const state = signal<PermissionSignalState>('loading');

  if (!win || !win.navigator?.permissions) {
    state.set('unsupported');
    return state.asReadonly();
  }

  let permissionStatus: PermissionStatus | null = null;

  const handleChange = () => {
    if (permissionStatus) {
      state.set(permissionStatus.state);
    }
  };

  win.navigator.permissions
    .query({ name })
    .then(
      (status) => {
        permissionStatus = status;
        state.set(status.state);
        status.addEventListener('change', handleChange);
      },
      () => {
        state.set('unsupported');
      }
    );

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    });
  }

  return state.asReadonly();
}
