import { Injector } from '@angular/core';
import type { DialogOptions } from './dialog.types';
import { setPosition, getWindowState, restore, isFullscreen } from './actions';

/**
 * Describes why a dialog was closed.
 *
 * Built-in values used by this library:
 * - `'manual'`: closed by calling {@link DialogRef.close}
 * - `'backdrop'`: closed by clicking outside the dialog content
 * - `'escape'`: closed by pressing the `Escape` key or a native cancel action
 *
 * Consumers may provide custom strings to distinguish application-specific close actions
 * such as `'save-button'`, `'delete-confirmed'`, or `'route-change'`.
 */
export type CloseSource = 'backdrop' | 'escape' | 'manual' | (string & {});

/**
 * Handle returned by {@link DialogService.open} for a single dialog instance.
 *
 * A `DialogRef` exposes:
 * - the rendered component instance via {@link component}
 * - the eventual close result via {@link result}
 * - the reason the dialog closed via {@link closeSource}
 * - a completion promise via {@link closed}
 * - an optional close guard via {@link beforeClose}
 *
 * Visual transformations like minimization, maximization, and snapping can be applied
 * using functional standalone actions (e.g. `minimize`, `maximize` and `restore`).
 *
 * @typeParam TResult Value returned when the dialog closes.
 * @typeParam TComponent Component type rendered inside the native `<dialog>` element.
 *
 * @example
 * ```ts
 * const ref = dialogService.open(EditUserDialogComponent);
 * const { result, closeSource } = await ref.closed;
 * ```
 */
export class DialogRef<TResult = any, TComponent = any> {
  /** The value the dialog was closed with. */
  public result?: TResult;

  /** The source of the action that caused the dialog to close. */
  public closeSource?: CloseSource;

  private resolveClosed!: (value: DialogRef<TResult, TComponent>) => void;
  /**
   * Resolves after the native dialog has fully closed and framework cleanup has completed.
   *
   * The resolved value is this same {@link DialogRef} instance, which means callers typically
   * destructure `result` and `closeSource` from the awaited value.
   *
   * @example
   * ```ts
   * const { result, closeSource } = await ref.closed;
   * ```
   */
  public readonly closed = new Promise<DialogRef<TResult, TComponent>>(
    (res) => (this.resolveClosed = res),
  );

  /**
   * The instantiated component currently rendered inside the dialog.
   * This allows the parent caller to access public properties or methods directly.
   */
  public component!: TComponent;

  /**
   * The dependency injection context for this dialog.
   */
  public injector!: Injector;

  /**
   * Optional hook to prevent or delay closing.
   *
   * Return `false` to abort the close. Return `true` or `void` to allow it.
   * The callback receives the attempted close source so consumers can allow or block
   * different close paths selectively.
   *
   * This hook runs for both programmatic closes and native dismiss flows routed through
   * the service, including backdrop clicks and `Escape`.
   *
   * @example
   * ```ts
   * ref.beforeClose = async (source) => {
   *   if (source === 'manual') return true;
   *   return confirm('Discard unsaved changes?');
   * };
   * ```
   */
  public beforeClose?: (source: CloseSource) => Promise<boolean | void> | boolean | void;

  private isClosing = false;
  private resizeObserver?: ResizeObserver;

  constructor(
    public readonly dialogEl: HTMLDialogElement,
    public readonly options: DialogOptions<TComponent> = {},
  ) {
    this.dialogEl?.addEventListener('click', this.onDialogClick);

    if (this.options.resizable && typeof ResizeObserver !== 'undefined' && this.dialogEl) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const state = getWindowState(this);
        if (state.isMinimized || state.isMaximized || isFullscreen(this)) return; // Ignore resize loops or measurements during minimized, maximized or fullscreen state
        for (const entry of entries) {
          const rect = entry.target.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          if (width > 0 && height > 0) {
            const wStr = `${width}px`;
            const hStr = `${height}px`;
            if (state.size.width !== wStr || state.size.height !== hStr) {
              setPosition(this, state.position.x, state.position.y, wStr, hStr);
            }
          }
        }
      });
      this.resizeObserver.observe(this.dialogEl);
    }
  }

  /**
   * Closes the dialog and passes an optional result back to the caller.
   *
   * If {@link beforeClose} returns `false`, the close is aborted.
   *
   * @param result Value exposed later on {@link result} and available from the resolved
   * {@link closed} promise.
   * @param source Reason associated with the close. Defaults to `'manual'`.
   * @returns A promise that resolves after the close guard has run and the native close request
   * has been issued. The dialog's full cleanup lifecycle completes when {@link closed} resolves.
   */
  async close(result?: TResult, source: CloseSource = 'manual') {
    if (!this.dialogEl?.open || this.isClosing) {
      return; // Already closed or closing
    }

    this.isClosing = true;

    try {
      if (this.beforeClose && (await this.beforeClose(source)) === false) {
        this.isClosing = false;
        return; // Abort closing!
      }

      const plugins = this.options.plugins;
      if (plugins) {
        for (const plugin of plugins) {
          if (
            plugin.beforeClose &&
            (await plugin.beforeClose({
              element: this.dialogEl,
              dialogRef: this as any,
              injector: this.injector || (null as any),
              source,
            })) === false
          ) {
            this.isClosing = false;
            return; // Abort closing!
          }
        }
      }
    } catch (e) {
      this.isClosing = false;
      throw e; // Allow error to propagate, abort closing
    }

    this.result = result;
    this.closeSource = source;
    this.dialogEl.close();
  }

  /**
   * @internal
   * Called by the service when the native dialog finishes closing.
   */
  _finishClose() {
    this.dialogEl?.removeEventListener('click', this.onDialogClick);
    this.resizeObserver?.disconnect();
    this.resolveClosed(this);
  }

  private readonly onDialogClick = (event: MouseEvent) => {
    const state = getWindowState(this);
    if (!state.isMinimized) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && this.dialogEl.contains(target)) {
      restore(this);
      event.preventDefault();
      event.stopPropagation();
    }
  };
}
