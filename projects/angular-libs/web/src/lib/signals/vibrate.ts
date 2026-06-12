import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface VibrateSignal {
  /** Check if the native physical device Vibration API is supported. */
  supported: boolean;
  /** Triggers a physical device haptic vibration pattern (e.g., 200ms or pulse list [100, 50, 100]). */
  vibrate(pattern: number | number[]): boolean;
  /** Aborts any active running pattern vibration sequence. */
  cancel(): boolean;
}

/**
 * Accesses and triggers device physical vibration/haptic feed dynamics.
 *
 * @returns An object conforming to VibrateSignal with supported check status indicator and controls.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <button (click)="haptic.vibrate([200, 100, 200])">Double Error Pulse</button>
 *   `
 * })
 * export class ActionComponent {
 *   haptic = vibrateSignal();
 * }
 * ```
 */
export function vibrateSignal(): VibrateSignal {
  let doc: Document | null = null;

  try {
    doc = inject(DOCUMENT);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const navigator = win?.navigator;
  const supported = !!(navigator && 'vibrate' in navigator);

  const vibrate = (pattern: number | number[]): boolean => {
    if (!supported) return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  };

  const cancel = (): boolean => {
    if (!supported) return false;
    try {
      return navigator.vibrate(0);
    } catch {
      return false;
    }
  };

  return {
    supported,
    vibrate,
    cancel,
  };
}
