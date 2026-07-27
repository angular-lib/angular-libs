import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface VibrateSignal {
  /** Check if the native physical device Vibration API is supported. */
  supported: boolean;
  /** Triggers a physical device haptic vibration pattern (e.g., 200ms or pulse list [100, 50, 100]). */
  vibrate(pattern: number | number[]): boolean;
  /** Triggers a short haptic feedback pulse (50ms) for successful actions. */
  success(): boolean;
  /** Triggers a double-pulse haptic pattern ([100, 50, 100]ms) for errors/failures. */
  error(): boolean;
  /** Triggers a warning haptic pattern ([75, 100, 75]ms). */
  warning(): boolean;
  /** Triggers a crisp single scan feedback pulse (30ms). */
  scan(): boolean;
  /** Aborts any active running pattern vibration sequence. */
  cancel(): boolean;
}

/**
 * Accesses and triggers device physical vibration/haptic feed dynamics.
 *
 * @returns An object conforming to VibrateSignal with supported check status indicator, custom vibration, and presets (success, error, warning, scan).
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <button (click)="haptic.success()">Save Success</button>
 *     <button (click)="haptic.error()">Error Pulse</button>
 *     <button (click)="haptic.scan()">QR Scan Feedback</button>
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

  const success = (): boolean => vibrate(50);
  const error = (): boolean => vibrate([100, 50, 100]);
  const warning = (): boolean => vibrate([75, 100, 75]);
  const scan = (): boolean => vibrate(30);

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
    success,
    error,
    warning,
    scan,
    cancel,
  };
}
