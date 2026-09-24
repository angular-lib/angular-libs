import { computed, signal, type Signal } from '@angular/core';

/** Why a dialog closed. Custom strings are allowed. */
export type CloseSource =
  | 'manual'
  | 'escape'
  | 'backdrop'
  | 'outside'
  | 'navigation'
  | 'action'
  | (string & {});

/**
 * How a dialog ended: `ok` is `true` exactly when it closed with a value.
 * Dismissals (Escape, backdrop, ×, navigation) are `ok: false`.
 */
export type DialogOutcome<T> =
  | { ok: true; value: T; source: CloseSource }
  | { ok: false; source: CloseSource };

/** Return `false` (or resolve to it) to keep the dialog open. */
export type DialogCloseGuard<T = unknown> = (attempt: {
  value: T | undefined;
  source: CloseSource;
}) => boolean | void | Promise<boolean | void>;

/** @internal What a surface (`<dialog>`, popover) provides to its ref. */
export interface ɵDialogHost {
  readonly element: HTMLElement;
  /** Starts hiding; the host calls {@link DialogRef.ɵfinish} once it is gone. */
  hide(): void;
  reportError(error: unknown): void;
}

/**
 * Handle to one open dialog. Injectable inside the dialog's component.
 */
export class DialogRef<TResult = unknown, TComponent = unknown> {
  /** Resolves once the dialog is closed and cleaned up. Never rejects. */
  readonly closed: Promise<DialogOutcome<TResult>>;
  /** `true` while an action runs; a busy dialog ignores close requests. */
  readonly busy: Signal<boolean>;

  private readonly pendingWork = signal(0);
  private readonly guards = new Set<DialogCloseGuard<TResult>>();
  private resolve!: (outcome: DialogOutcome<TResult>) => void;
  private outcome: DialogOutcome<TResult> | null = null;
  private closing = false;
  private component?: TComponent;

  constructor(private readonly host: ɵDialogHost) {
    this.closed = new Promise((resolve) => (this.resolve = resolve));
    this.busy = computed(() => this.pendingWork() > 0);
  }

  /** The dialog surface (`<dialog>` or popover element). */
  get element(): HTMLElement {
    return this.host.element;
  }

  get componentInstance(): TComponent {
    return this.component as TComponent;
  }

  /**
   * Closes with an optional value after the guards agree. Returns `false` when the
   * dialog stays open (busy, a guard said no, or already closing).
   */
  async close(value?: TResult, source: CloseSource = 'manual'): Promise<boolean> {
    if (this.closing || this.outcome || this.busy()) return false;
    this.closing = true;
    const allowed = await this.runGuards(value, source);
    this.closing = false;
    if (!allowed) return false;
    this.outcome =
      value === undefined ? { ok: false, source } : { ok: true, value, source };
    this.host.hide();
    return true;
  }

  private async runGuards(value: TResult | undefined, source: CloseSource): Promise<boolean> {
    try {
      for (const guard of [...this.guards]) {
        if ((await guard({ value, source })) === false) return false;
      }
      return true;
    } catch (error) {
      this.host.reportError(error);
      return false;
    }
  }

  /** Registers a guard, run in order on every close request. Returns a remover. */
  addCloseGuard(guard: DialogCloseGuard<TResult>): () => void {
    this.guards.add(guard);
    return () => this.guards.delete(guard);
  }

  /** @internal Marks the dialog busy (`aria-busy`) while `work` runs. */
  async ɵtrack<T>(work: () => T | Promise<T>): Promise<T> {
    this.pendingWork.update((n) => n + 1);
    this.element.setAttribute('aria-busy', 'true');
    try {
      return await work();
    } finally {
      this.pendingWork.update((n) => n - 1);
      if (!this.busy()) this.element.removeAttribute('aria-busy');
    }
  }

  /** @internal */
  ɵsetComponent(component: TComponent): void {
    this.component = component;
  }

  /**
   * @internal Called by the host once the surface is gone. `source` describes closes
   * that did not go through {@link close} (e.g. popover light dismiss).
   */
  ɵfinish(source: CloseSource = 'manual'): void {
    this.outcome ??= { ok: false, source };
    this.resolve(this.outcome);
  }
}

/** Resolves when every finite CSS animation / transition on `el` has finished. */
export function ɵanimationsDone(el: Element): Promise<unknown> {
  const running = el.getAnimations?.() ?? [];
  return Promise.allSettled(
    running
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished),
  );
}
