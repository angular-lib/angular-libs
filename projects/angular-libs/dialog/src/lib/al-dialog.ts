import {
  DestroyRef,
  Directive,
  ElementRef,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';

export type AlDialogCloseReason = 'escape' | 'backdrop' | 'close';

/**
 * Headless behavior for your own `<dialog>`: open/close from a signal, Escape and
 * backdrop dismiss, scroll lock, and focus return. No styles.
 *
 * Focus containment and initial focus are native (`showModal()`, `autofocus`).
 *
 * @example
 * ```html
 * <dialog alDialog [open]="open()" (closed)="open.set(false)">
 *   <h2 alDialogTitle>Edit user</h2>
 *   …
 * </dialog>
 * ```
 */
@Directive({
  selector: 'dialog[alDialog]',
  exportAs: 'alDialog',
  host: {
    tabindex: '-1',
    '(cancel)': 'onCancel($event)',
    '(mousedown)': 'onMouseDown($event)',
    '(click)': 'onClick($event)',
    '(close)': 'teardown()',
  },
})
export class AlDialog {
  /** Opens (`showModal()` / `show()`) when `true`, closes when `false`. */
  readonly open = input(false, { transform: booleanAttribute });
  /** Modal (top layer, rest of the page inert, scroll lock) or modeless. Default `true`. */
  readonly modal = input(true, { transform: booleanAttribute });
  readonly closeOnEscape = input(true, { transform: booleanAttribute });
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });
  /** Return focus to the element focused before opening. Default `true`. */
  readonly restoreFocus = input(true, { transform: booleanAttribute });

  /** Emits after the dialog has closed. */
  readonly closed = output<{ reason: AlDialogCloseReason }>();

  /** The host `<dialog>`. */
  readonly element: HTMLDialogElement = inject(ElementRef).nativeElement;

  private isOpen = false;
  private reason: AlDialogCloseReason = 'close';
  private opener: HTMLElement | null = null;
  private dismissHandler: ((reason: AlDialogCloseReason) => void) | null = null;
  protected mousedownOnBackdrop = false;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.close()));
    });
    inject(DestroyRef).onDestroy(() => {
      // Tear down first: the `close` event below must not emit on a destroyed output.
      this.teardown(false);
      if (this.element.open) this.element.close();
    });
  }

  /** Closes the dialog (`closed` emits with reason `close`). */
  close(reason: AlDialogCloseReason = 'close'): void {
    if (!this.isOpen) return;
    this.reason = reason;
    this.element.close();
  }

  /**
   * @internal Escape / backdrop call `handler` instead of closing, so `DialogRef` can
   * run guards first.
   */
  ɵonDismiss(handler: (reason: AlDialogCloseReason) => void): void {
    this.dismissHandler = handler;
  }

  /** @internal */
  ɵdismiss(reason: 'escape' | 'backdrop'): void {
    if (this.dismissHandler) this.dismissHandler(reason);
    else this.close(reason);
  }

  private show(): void {
    if (this.isOpen || !this.element.isConnected) return;
    const modal = this.modal();
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.element.removeAttribute('open');
    if (modal) this.element.showModal();
    else this.element.show();
    this.isOpen = true;
    if (modal) modalStack.push(this);
  }

  // A method, not an inline assignment: a handler that evaluates to `false` makes Angular
  // call preventDefault(), which would block focus, text selection and the resize grip.
  protected onMouseDown(event: MouseEvent): void {
    this.mousedownOnBackdrop = this.isBackdropEvent(event);
  }

  protected onCancel(event: Event): void {
    // Other close requests (e.g. Android back). Escape is handled by the modal stack.
    event.preventDefault();
    if (this.closeOnEscape()) this.ɵdismiss('escape');
  }

  protected isBackdropEvent(event: MouseEvent): boolean {
    if (event.target !== this.element) return false;
    const r = this.element.getBoundingClientRect();
    return (
      event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom
    );
  }

  protected onClick(event: MouseEvent): void {
    const fromBackdrop = this.mousedownOnBackdrop && this.isBackdropEvent(event);
    this.mousedownOnBackdrop = false;
    if (fromBackdrop && this.isOpen && this.closeOnBackdrop()) this.ɵdismiss('backdrop');
  }

  protected teardown(emit = true): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    modalStack.remove(this);
    if (this.restoreFocus() && this.opener?.isConnected) this.opener.focus();
    this.opener = null;
    if (emit) this.closed.emit({ reason: this.reason });
    this.reason = 'close';
  }
}

/**
 * Open modals, topmost last.
 *
 * Escape is handled on `document` rather than through `cancel`: Chrome's close watcher
 * closes a `<dialog>` outright after repeated prevented `cancel`s, which would bypass
 * `closeOnEscape: false`, guards and busy state. Listening on `document` also covers
 * focus outside the dialog (e.g. on a button that became disabled).
 */
const modalStack = {
  items: [] as AlDialog[],
  listeners: new Set<() => void>(),

  push(dialog: AlDialog): void {
    if (this.items.length === 0) document.addEventListener('keydown', onEscapeKey);
    this.items.push(dialog);
    this.listeners.forEach((l) => l());
    lockScroll(true);
  },

  remove(dialog: AlDialog): void {
    const index = this.items.indexOf(dialog);
    if (index === -1) return;
    this.items.splice(index, 1);
    if (this.items.length === 0) document.removeEventListener('keydown', onEscapeKey);
    this.listeners.forEach((l) => l());
    lockScroll(this.items.length > 0);
  },
};

function onEscapeKey(event: KeyboardEvent): void {
  // A widget inside the dialog (e.g. a combobox) consumed it, or an IME is composing.
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const top = modalStack.items[modalStack.items.length - 1];
  // An open light-dismiss popover inside the dialog closes first, natively.
  if (hasOpenPopover(top.element)) return;
  event.preventDefault();
  if (top.closeOnEscape()) top.ɵdismiss('escape');
}

function hasOpenPopover(root: Element): boolean {
  return [...root.querySelectorAll<HTMLElement>('[popover]:not([popover="manual"])')].some((el) => {
    try {
      return el.matches(':popover-open');
    } catch {
      return el.checkVisibility?.() ?? true; // engines without :popover-open (e.g. jsdom)
    }
  });
}

/** @internal The topmost open modal `<dialog>`, if any. */
export function ɵtopModal(): HTMLDialogElement | null {
  return modalStack.items[modalStack.items.length - 1]?.element ?? null;
}

/** @internal Calls `listener` whenever the modal stack changes. Returns a remover. */
export function ɵonModalStackChange(listener: () => void): () => void {
  modalStack.listeners.add(listener);
  return () => modalStack.listeners.delete(listener);
}

let restoreScroll: (() => void) | null = null;

/** Locks page scroll, padding `<body>` by the hidden scrollbar so the page does not shift. */
function lockScroll(locked: boolean): void {
  if (locked === !!restoreScroll) return;
  if (!locked) {
    restoreScroll!();
    restoreScroll = null;
    return;
  }
  const { style } = document.body;
  const previous = { overflow: style.overflow, paddingRight: style.paddingRight };
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbar > 0) {
    const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    style.paddingRight = `${padding + scrollbar}px`;
  }
  style.overflow = 'hidden';
  restoreScroll = () => Object.assign(style, previous);
}
