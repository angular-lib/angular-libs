import { signal, Signal, inject, DestroyRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface ClipboardSignalOptions {
  /** Time in milliseconds to keep the `copied` state as true. Defaults to 2000. */
  copiedDuration?: number;
  /** Whether to listen to copy/cut events and attempt to synchronise clipboard text. Defaults to false to avoid permission prompts. */
  read?: boolean;
}

export interface ClipboardSignal {
  /** The reactive clipboard text value. */
  text: Signal<string>;
  /** Indicates whether text was recently copied. */
  copied: Signal<boolean>;
  /** Indicates whether the Clipboard API is supported in this environment. */
  supported: boolean;
  /** Copies text to the clipboard. */
  copy(value: string): Promise<void>;
}

/**
 * Exposes a reactive state for clipboard management, wrapping standard navigator clipboard functions and listening to update changes securely.
 *
 * @param options Configurations for the timeout tracker or permission options.
 * @returns A ClipboardSignal containing text, copied state, supported status, and written commands.
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <button (click)="clipboard.copy('Hello World!')">
 *       {{ clipboard.copied() ? 'Copied!' : 'Copy' }}
 *     </button>
 *   `
 * })
 * export class ClipboardComponent {
 *   clipboard = clipboardSignal();
 * }
 * ```
 */
export function clipboardSignal(options?: ClipboardSignalOptions): ClipboardSignal {
  let doc: Document | null = null;
  let destroyRef: DestroyRef | null = null;

  try {
    doc = inject(DOCUMENT);
    destroyRef = inject(DestroyRef);
  } catch {
    // Soft fallback if called outside of active injection context
  }

  const duration = options?.copiedDuration ?? 2000;
  const read = options?.read ?? false;

  const win = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const supported = !!(win && win.navigator && win.navigator.clipboard);

  const text = signal<string>('');
  const copied = signal<boolean>(false);

  let timeoutId: any = null;

  const copy = async (value: string) => {
    if (!supported) return;

    try {
      await win!.navigator.clipboard.writeText(value);
      text.set(value);
      copied.set(true);

      if (timeoutId) {
        win!.clearTimeout(timeoutId);
      }
      timeoutId = win!.setTimeout(() => {
        copied.set(false);
      }, duration);
    } catch {
      // Handle or ignore write failure
    }
  };

  const updateText = async () => {
    if (!supported || !read) return;
    try {
      const status = await win!.navigator.permissions.query({
        name: 'clipboard-read' as PermissionName,
      });
      if (status.state === 'denied') return;

      const clipboardText = await win!.navigator.clipboard.readText();
      text.set(clipboardText);
    } catch {
      // Soft ignore permission/reading errors
    }
  };

  if (win && supported && read) {
    const events = ['copy', 'cut'];

    updateText();

    events.forEach((event) => {
      win.addEventListener(event, updateText);
    });

    if (destroyRef) {
      destroyRef.onDestroy(() => {
        events.forEach((event) => {
          win.removeEventListener(event, updateText);
        });
        if (timeoutId) {
          win.clearTimeout(timeoutId);
        }
      });
    }
  } else if (win && destroyRef) {
    destroyRef.onDestroy(() => {
      if (timeoutId) {
        win.clearTimeout(timeoutId);
      }
    });
  }

  return {
    text: text.asReadonly(),
    copied: copied.asReadonly(),
    supported,
    copy,
  };
}
