import { Injector, signal, type WritableSignal } from '@angular/core';
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
  | (string & {});

export interface DialogCloseEvent<TResult = any> {
  result?: TResult;
  source: CloseSource;
}

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

  async close(result?: TResult, source: CloseSource = 'manual') {
    if (!this.dialogEl?.open || this.isClosing) {
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
