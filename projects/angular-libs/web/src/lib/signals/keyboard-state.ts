import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface KeyboardState {
  /** Array of active key strings currently being held down. */
  keys: string[];
  /** State of the Control modifier key. */
  ctrl: boolean;
  /** State of the Shift modifier key. */
  shift: boolean;
  /** State of the Alt modifier key. */
  alt: boolean;
  /** State of the Meta (Command/Windows) modifier key. */
  meta: boolean;
}

/**
 * Monitors active keystrokes and modifier keyboard combinations reactively.
 * Includes defensive automatic clearing when the active window loses focus.
 *
 * @returns A Readonly Signal containing active key presses and modifier states.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <p>Active keys: {{ keyboard().keys.join(' + ') }}</p>
 *     <p>Ctrl active: {{ keyboard().ctrl }}</p>
 *   `
 * })
 * export class KeyboardComponent {
 *   keyboard = keyboardStateSignal();
 * }
 * ```
 */
export function keyboardStateSignal(): Signal<KeyboardState> {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const activeKeys = new Set<string>();

  const state = signal<KeyboardState>({
    keys: [],
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
  });

  if (win) {
    const handleKeyDown = (event: KeyboardEvent) => {
      activeKeys.add(event.key);
      state.set({
        keys: Array.from(activeKeys),
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      activeKeys.delete(event.key);
      state.set({
        keys: Array.from(activeKeys),
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey,
      });
    };

    const handleBlur = () => {
      activeKeys.clear();
      state.set({
        keys: [],
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
      });
    };

    win.addEventListener('keydown', handleKeyDown);
    win.addEventListener('keyup', handleKeyUp);
    win.addEventListener('blur', handleBlur);

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        win.removeEventListener('keydown', handleKeyDown);
        win.removeEventListener('keyup', handleKeyUp);
        win.removeEventListener('blur', handleBlur);
      });
    }
  }

  return state.asReadonly();
}
