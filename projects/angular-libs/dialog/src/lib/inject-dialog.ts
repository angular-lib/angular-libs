import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { DialogRef, type CloseSource, type DialogCloseGuard } from './dialog-ref';
import { DialogService } from './dialog.service';
import type { ConfirmOptions } from './confirm-dialog';

/** Callable returned by {@link DialogHandle.action}. Never rejects; failures land in `error`. */
export interface DialogAction<TArgs extends unknown[]> {
  (...args: TArgs): Promise<void>;
  readonly pending: Signal<boolean>;
  /** The last thrown error; cleared when the action runs again. */
  readonly error: Signal<unknown>;
}

export interface DialogHandle<TResult> {
  readonly ref: DialogRef<TResult>;
  /** `true` while an action runs. Close requests are ignored meanwhile. */
  readonly busy: Signal<boolean>;
  /** Close with a value (omit it to dismiss). */
  close(value?: TResult): Promise<boolean>;
  /**
   * Keeps the dialog open when `guard` returns `false`. Runs only for dismissals
   * (no value) — never after a save — unless `always` is set. Removed when the
   * calling component is destroyed.
   *
   * @example
   * ```ts
   * dialog.guard(() => !this.form.dirty || dialog.confirm({ title: 'Discard changes?' }));
   * ```
   */
  guard(guard: DialogCloseGuard<TResult>, options?: { always?: boolean }): () => void;
  /**
   * Wraps async work: `pending`, dialog `busy` + `aria-busy`, failures in `error`.
   * On success the dialog closes with the returned value (source `action`), unless
   * `close: false`.
   *
   * @example
   * ```ts
   * save = this.dialog.action(() => this.api.save(this.form.value));
   * ```
   */
  action<TArgs extends unknown[]>(
    work: (...args: TArgs) => TResult | Promise<TResult>,
    options?: { close?: true },
  ): DialogAction<TArgs>;
  action<TArgs extends unknown[]>(
    work: (...args: TArgs) => unknown,
    options: { close: false },
  ): DialogAction<TArgs>;
  /** A stacked confirm, e.g. inside a guard. */
  confirm(options: ConfirmOptions): Promise<boolean>;
}

/**
 * The dialog API for the component inside a dialog. Keep it in a public property so
 * `dialog.open()` infers the result type.
 *
 * @example
 * ```ts
 * export class EditUser {
 *   readonly user = input.required<User>();
 *   readonly dialog = injectDialog<User>();
 *   readonly save = this.dialog.action(() => this.api.save(this.form.value));
 * }
 * ```
 */
export function injectDialog<TResult = unknown>(): DialogHandle<TResult> {
  const ref = inject(DialogRef) as DialogRef<TResult>;
  const destroyRef = inject(DestroyRef);
  const service = inject(DialogService);

  return {
    ref,
    busy: ref.busy,
    close: (value) => ref.close(value),
    guard(guard, { always = false } = {}) {
      const remove = ref.addCloseGuard((attempt) =>
        always || isDismissal(attempt.value, attempt.source) ? guard(attempt) : true,
      );
      destroyRef.onDestroy(remove);
      return remove;
    },
    action<TArgs extends unknown[]>(
      work: (...args: TArgs) => unknown,
      { close = true }: { close?: boolean } = {},
    ): DialogAction<TArgs> {
      const pending = signal(false);
      const error = signal<unknown>(null);
      const run = async (...args: TArgs) => {
        if (pending()) return;
        pending.set(true);
        error.set(null);
        try {
          const value = await ref.ɵtrack(() => work(...args));
          pending.set(false);
          if (close) await ref.close(value as TResult, 'action');
        } catch (e) {
          pending.set(false);
          error.set(e);
        }
      };
      return Object.assign(run, { pending: pending.asReadonly(), error: error.asReadonly() });
    },
    confirm: (options) => service.confirm(options),
  };
}

/** A close without a value that is not a completed action — where unsaved work is lost. */
function isDismissal(value: unknown, source: CloseSource): boolean {
  return value === undefined && source !== 'action';
}
