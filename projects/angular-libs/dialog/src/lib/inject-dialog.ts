import { DestroyRef, inject, signal, type Signal } from '@angular/core';
import { DialogRef, type DialogCloseAttempt, type DialogCloseGuard } from './dialog-ref';
import { DialogService } from './dialog.service';
import type { ConfirmOptions } from './dialog.types';

/** Typed `inject(DialogRef)` for components opened by {@link DialogService}. */
export function injectDialogRef<TResult = unknown, TComponent = unknown>(): DialogRef<
  TResult,
  TComponent
> {
  return inject(DialogRef) as DialogRef<TResult, TComponent>;
}

export interface DialogGuardOptions {
  /**
   * Also run when the dialog closes **with** a value (submit). By default a guard only
   * runs for dismissals — Escape, backdrop, close icon, navigation — so a successful
   * save never asks "discard changes?".
   */
  always?: boolean;
}

export interface DialogActionOptions {
  /** Close the dialog with the returned value on success. Default `true`. */
  close?: boolean;
}

/** Callable returned by {@link DialogHandle.action}. Never rejects; failures land in `error`. */
export interface DialogAction<TArgs extends unknown[]> {
  (...args: TArgs): Promise<void>;
  /** `true` while this action runs. */
  readonly pending: Signal<boolean>;
  /** The last thrown error, cleared when the action runs again. */
  readonly error: Signal<unknown>;
  clearError(): void;
}

export interface DialogHandle<TResult> {
  readonly ref: DialogRef<TResult>;
  /** `true` while any action of this dialog runs. Dismiss is blocked meanwhile. */
  readonly busy: Signal<boolean>;
  /** Close with a value (`outcome.ok === true`). */
  close(value: TResult): Promise<void>;
  /** Close without a value (`outcome.ok === false`, reason `'manual'`). */
  dismiss(): Promise<void>;
  /**
   * Keep the dialog open when `guard` returns `false`. Removed automatically when the
   * calling component is destroyed.
   *
   * @example
   * ```ts
   * d.guard(() => !this.form.dirty || d.confirm({ title: 'Discard changes?' }));
   * ```
   */
  guard(guard: DialogCloseGuard<TResult>, options?: DialogGuardOptions): () => void;
  /**
   * Wrap async work: sets `pending` / `busy`, blocks dismiss, stores failures in `error`,
   * and closes with the returned value on success.
   *
   * @example
   * ```ts
   * save = this.d.action(() => this.api.save(this.form.value));
   * // <button (click)="save()" [disabled]="save.pending()">Save</button>
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
  /** Stacked confirm, e.g. inside a guard. Resolves `true` on confirm. */
  confirm(options?: ConfirmOptions): Promise<boolean>;
}

/**
 * Everything a dialog component needs: typed close, dismiss guards, and async actions
 * with pending / error state.
 *
 * Expose it as a public property so `dialog.open` / `defineDialog` infer the result type.
 *
 * @example
 * ```ts
 * export class EditUser {
 *   readonly dialog = injectDialog<User>();
 *   save = this.dialog.action(() => this.api.save(this.form.value));
 * }
 * ```
 */
export function injectDialog<TResult = unknown>(): DialogHandle<TResult> {
  const ref = injectDialogRef<TResult>();
  const destroyRef = inject(DestroyRef);
  const service = inject(DialogService);

  const handle: DialogHandle<TResult> = {
    ref,
    busy: ref.busy,
    close: (value) => ref.close(value, 'manual'),
    dismiss: () => ref.close(undefined, 'manual'),
    guard(guard, options = {}) {
      const remove = ref.addCloseGuard((attempt: DialogCloseAttempt<TResult>) =>
        options.always || isDismissal(attempt) ? guard(attempt) : true,
      );
      destroyRef.onDestroy(remove);
      return remove;
    },
    action<TArgs extends unknown[]>(
      work: (...args: TArgs) => unknown,
      options: DialogActionOptions = {},
    ): DialogAction<TArgs> {
      const pending = signal(false);
      const error = signal<unknown>(null);
      const run = async (...args: TArgs) => {
        if (pending()) return;
        pending.set(true);
        error.set(null);
        let value: unknown;
        try {
          value = await ref._trackBusy(() => work(...args));
        } catch (e) {
          error.set(e);
          return;
        } finally {
          pending.set(false);
        }
        if (options.close !== false) {
          await ref.close(value as TResult, 'action');
        }
      };
      return Object.assign(run, {
        pending: pending.asReadonly(),
        error: error.asReadonly(),
        clearError: () => error.set(null),
      });
    },
    confirm: (options) => service.confirm(options),
  };
  return handle;
}

function isDismissal(attempt: DialogCloseAttempt): boolean {
  return attempt.result === undefined && attempt.source !== 'parent-closed';
}
