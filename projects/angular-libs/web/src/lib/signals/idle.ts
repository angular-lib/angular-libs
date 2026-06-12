import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface IdleSignalOptions {
  /** Inactivity timeout in milliseconds. Defaults to 5 minutes (300,000 ms).*/
  timeout?: number;
  /**
   * List of DOM events that reset the activity timer.
   * Defaults to `['mousemove', 'mousedown', 'resize', 'keydown', 'touchstart', 'wheel']`.
   */
  events?: string[];
  /** Target element or document to listen on. Defaults to document. */
  element?: HTMLElement | Document;
}

/**
 * Tracks user inactivity and transitions to true when inactive for longer than a specified timeout.
 * Throttles timer resets during active sessions.
 *
 * @param options Configurations for the inactivity timer, reset triggering events, or event targets.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     @if (isInactive()) {
 *       <div class="modal">Are you still there?</div>
 *     }
 *   `
 * })
 * export class SessionManagerComponent {
 *   // Triggers true after 10 seconds of no interaction (mousedown, keydown etc)
 *   isInactive = idleSignal({ timeout: 10000 });
 * }
 * ```
 */
export function idleSignal(options?: IdleSignalOptions): Signal<boolean> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const timeout = options?.timeout ?? 300000;
  const defaultEvents = ['mousemove', 'mousedown', 'resize', 'keydown', 'touchstart', 'wheel'];
  const events = options?.events ?? defaultEvents;
  const target = options?.element ?? doc;

  const isIdle = signal<boolean>(false);
  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);

  if (!win || !target) {
    return isIdle.asReadonly();
  }

  let timerId: any = null;
  let lastResetTime = 0;

  const handleActivity = () => {
    const now = Date.now();

    // Throttle resets during continuous interactions (mouse-drags/moves)
    if (isIdle() === false && now - lastResetTime < 500) {
      return;
    }
    lastResetTime = now;

    if (isIdle()) {
      isIdle.set(false);
    }

    if (timerId) {
      win.clearTimeout(timerId);
    }
    timerId = win.setTimeout(() => {
      isIdle.set(true);
    }, timeout);
  };

  handleActivity();

  events.forEach((event) => {
    target.addEventListener(event, handleActivity, { passive: true });
  });

  const cleanup = () => {
    if (timerId) {
      win.clearTimeout(timerId);
    }
    events.forEach((event) => {
      target.removeEventListener(event, handleActivity);
    });
  };

  if (destroyRef) {
    destroyRef.onDestroy(() => {
      cleanup();
    });
  }

  return isIdle.asReadonly();
}
