import { Injector, computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type { DialogOptions, DialogSurfaceState } from './dialog.types';
import {
  setPosition,
  getPosition,
  getSize,
  getWindowState,
  restore,
  isFullscreen,
  minimize as minimizeAction,
  maximize as maximizeAction,
  toggleMinimize as toggleMinimizeAction,
  toggleMaximize as toggleMaximizeAction,
  snapToEdge,
  type SnapEdge,
  enterFullscreen,
  exitFullscreen,
  toggleFullscreen as toggleFullscreenAction,
  isMinimized,
  isMaximized,
} from './actions';

/**
 * Describes why a dialog was closed.
 *
 * Built-in values:
 * - `'manual'`: closed by calling {@link DialogRef.close}
 * - `'backdrop'`: closed by clicking outside the dialog content
 * - `'escape'`: closed by pressing Escape
 * - `'parent-closed'`: closed because a parent dialog closed
 * - `'auto-close'`: closed by auto-close / toast timer
 * - `'navigation'`: closed because the router navigated
 * - `'primary'` / `'secondary'`: DefaultDialog footer actions
 * - `'action'`: closed by a completed {@link injectDialog} action
 *
 * Consumers may provide custom strings for app-specific close actions.
 */
export type CloseSource =
  | 'backdrop'
  | 'escape'
  | 'manual'
  | 'parent-closed'
  | 'auto-close'
  | 'navigation'
  | 'primary'
  | 'secondary'
  | 'action'
  | (string & {});

export interface DialogCloseEvent<TResult = any> {
  result?: TResult;
  source: CloseSource;
}

/**
 * Discriminated close result: `ok` is `true` exactly when the dialog closed with a value
 * (`result !== undefined`). Dismissals (Escape, backdrop, close icon, navigation) are `ok: false`.
 *
 * @example
 * ```ts
 * const outcome = await dialog.run(EditUserDialog, { user });
 * if (outcome.ok) save(outcome.value);
 * ```
 */
export type DialogOutcome<TResult> =
  | { ok: true; value: TResult; source: CloseSource }
  | { ok: false; reason: CloseSource };

/** Maps a {@link DialogCloseEvent} to a {@link DialogOutcome}. */
export function toDialogOutcome<TResult>(event: DialogCloseEvent<TResult>): DialogOutcome<TResult> {
  return event.result === undefined
    ? { ok: false, reason: event.source }
    : { ok: true, value: event.result, source: event.source };
}

/** What a close guard sees. */
export interface DialogCloseAttempt<TResult = any> {
  source: CloseSource;
  result: TResult | undefined;
}

/** Return `false` (or resolve to `false`) to keep the dialog open. */
export type DialogCloseGuard<TResult = any> = (
  attempt: DialogCloseAttempt<TResult>,
) => Promise<boolean | void> | boolean | void;

/**
 * Handle returned by {@link DialogService.open} / {@link DialogService.window} for one dialog.
 */
export class DialogRef<TResult = any, TComponent = any> {
  public result?: TResult;
  public closeSource?: CloseSource;

  private resolveClosed!: (value: DialogCloseEvent<TResult>) => void;

  /**
   * Resolves after the native dialog has fully closed and cleanup has completed.
   */
  public readonly closed = new Promise<DialogCloseEvent<TResult>>(
    (res) => (this.resolveClosed = res),
  );

  public component!: TComponent;
  public injector!: Injector;
  public parent?: DialogRef<any, any>;
  public readonly children: DialogRef<any, any>[] = [];

  public beforeClose?: (source: CloseSource) => Promise<boolean | void> | boolean | void;

  /** Reactive surface state for window chrome and consumers. */
  public readonly state: WritableSignal<DialogSurfaceState> = signal('open');

  private readonly pendingCount = signal(0);

  /**
   * `true` while an action tracked by {@link injectDialog} (or a confirm `onConfirm`) runs.
   * A busy dialog ignores every close request except a parent cascade.
   */
  public readonly busy: Signal<boolean> = computed(() => this.pendingCount() > 0);

  private readonly guards = new Set<DialogCloseGuard<TResult>>();
  private outcomePromise?: Promise<DialogOutcome<TResult>>;

  /** @internal Captured opener for restore-focus. */
  _opener: HTMLElement | null = null;

  /** @internal Whether restoreFocus should run on close. */
  _restoreFocus = true;

  /** @internal Animation leave class (if any). */
  _leaveAnimationClass: string | null = null;

  private isClosing = false;
  private resizeObserver?: ResizeObserver;

  constructor(
    public readonly dialogEl: HTMLDialogElement,
    public readonly options: DialogOptions<TComponent> = {},
  ) {
    this.dialogEl?.addEventListener('click', this.onDialogClick);

    const layoutState = getWindowState(this);
    layoutState._onStateChange = (s) => {
      if (s === 'minimized') this.state.set('minimized');
      else if (s === 'maximized') this.state.set('maximized');
      else if (s === 'restored') this.state.set('open');
    };

    if (this.options.resize && typeof ResizeObserver !== 'undefined' && this.dialogEl) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const state = getWindowState(this);
        if (state.isMinimized || state.isMaximized || isFullscreen(this)) return;
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

  minimize(): boolean {
    return minimizeAction(this);
  }

  maximize(): boolean {
    return maximizeAction(this);
  }

  restore(): boolean {
    return restore(this);
  }

  toggleMinimize(): boolean {
    return toggleMinimizeAction(this);
  }

  toggleMaximize(): boolean {
    return toggleMaximizeAction(this);
  }

  fullscreen(): Promise<boolean> {
    return enterFullscreen(this);
  }

  exitFullscreen(): Promise<boolean> {
    return exitFullscreen(this);
  }

  toggleFullscreen(): Promise<boolean> {
    return toggleFullscreenAction(this);
  }

  snap(edge: SnapEdge): void {
    snapToEdge(this, edge);
  }

  moveTo(x: number, y: number): void {
    const size = getSize(this);
    setPosition(this, x, y, size.width || undefined, size.height || undefined);
  }

  resizeTo(width: number | string, height: number | string): void {
    const pos = getPosition(this);
    const w = typeof width === 'number' ? `${width}px` : width;
    const h = typeof height === 'number' ? `${height}px` : height;
    setPosition(this, pos.x, pos.y, w, h);
  }

  isMinimized(): boolean {
    return isMinimized(this);
  }

  isMaximized(): boolean {
    return isMaximized(this);
  }

  isFullscreen(): boolean {
    return isFullscreen(this);
  }

  /** Resolves with a {@link DialogOutcome} once the dialog has closed. */
  get outcome(): Promise<DialogOutcome<TResult>> {
    return (this.outcomePromise ??= this.closed.then(toDialogOutcome));
  }

  /**
   * Registers a close guard. Guards run after `beforeClose` and plugin hooks, in
   * registration order; the first `false` keeps the dialog open.
   *
   * @returns a function that removes the guard.
   */
  addCloseGuard(guard: DialogCloseGuard<TResult>): () => void {
    this.guards.add(guard);
    return () => this.guards.delete(guard);
  }

  /**
   * @internal
   * Marks the dialog busy (`aria-busy`, dismiss blocked) while `work` runs.
   */
  async _trackBusy<T>(work: () => T | Promise<T>): Promise<T> {
    this.pendingCount.update((n) => n + 1);
    this.dialogEl?.setAttribute('aria-busy', 'true');
    try {
      return await work();
    } finally {
      this.pendingCount.update((n) => n - 1);
      if (this.pendingCount() === 0) this.dialogEl?.removeAttribute('aria-busy');
    }
  }

  async close(result?: TResult, source: CloseSource = 'manual') {
    if (!this.dialogEl?.open || this.isClosing) {
      return;
    }
    if (this.busy() && source !== 'parent-closed') {
      return;
    }

    this.isClosing = true;

    try {
      if (this.beforeClose && (await this.beforeClose(source)) === false) {
        this.isClosing = false;
        return;
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
            return;
          }
        }
      }

      for (const guard of [...this.guards]) {
        if ((await guard({ source, result })) === false) {
          this.isClosing = false;
          return;
        }
      }
    } catch (e) {
      this.isClosing = false;
      throw e;
    }

    this.result = result;
    this.closeSource = source;

    if (this.children.length > 0) {
      await Promise.allSettled(
        [...this.children].map((child) =>
          child.close(undefined, 'parent-closed').catch((err) => {
            console.error('[DialogRef] Error cascading close to child dialog:', err);
          }),
        ),
      );
    }

    await this.runLeaveAnimation();

    this.state.set('closed');
    this.dialogEl.close();
  }

  private async runLeaveAnimation(): Promise<void> {
    const leaveClass = this._leaveAnimationClass;
    if (!leaveClass || !this.dialogEl) return;

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    this.dialogEl.classList.add(leaveClass);
    await new Promise<void>((resolve) => {
      const done = () => {
        this.dialogEl.removeEventListener('transitionend', done);
        this.dialogEl.removeEventListener('animationend', done);
        resolve();
      };
      this.dialogEl.addEventListener('transitionend', done);
      this.dialogEl.addEventListener('animationend', done);
      // Fallback if no CSS transition/animation is defined
      setTimeout(done, 200);
    });
  }

  /**
   * @internal
   * Called by the service when the native dialog finishes closing.
   */
  _finishClose() {
    this.dialogEl?.removeEventListener('click', this.onDialogClick);
    this.resizeObserver?.disconnect();
    this.state.set('closed');

    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index > -1) {
        this.parent.children.splice(index, 1);
      }
    }

    this.resolveClosed({
      result: this.result,
      source: this.closeSource ?? 'manual',
    });
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
