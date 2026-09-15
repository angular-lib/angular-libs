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

export interface AlDialogClosed {
  reason: AlDialogCloseReason;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let scrollLockCount = 0;
let previousBodyOverflow = '';

/**
 * Headless modal behavior on the consumer’s own `<dialog>`.
 *
 * Native `<dialog>` is required: `showModal()` puts the surface on the top layer
 * (UA backdrop, inert background). The lib does not inject CSS, tokens, or chrome.
 *
 * @example
 * ```html
 * <dialog alDialog [open]="open()" labelledBy="edit-title" (closed)="open.set(false)">
 *   <h2 id="edit-title">Edit user</h2>
 *   <form>…</form>
 * </dialog>
 * ```
 */
@Directive({
  selector: 'dialog[alDialog]',
  exportAs: 'alDialog',
  standalone: true,
  host: {
    '[attr.aria-modal]': '"true"',
    '[attr.aria-labelledby]': 'labelledBy() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.tabindex]': '-1',
    '(cancel)': 'onCancel($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
    '(close)': 'onNativeClose()',
  },
})
export class AlDialog {
  private readonly el = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** When true, calls `showModal()`; when false, closes the dialog. */
  readonly open = input(false, { transform: booleanAttribute });
  /** Sets `aria-labelledby` on the host. */
  readonly labelledBy = input<string | undefined>(undefined);
  /** Sets `aria-describedby` on the host. */
  readonly describedBy = input<string | undefined>(undefined);
  /** Dismiss on Escape. Default `true`. */
  readonly closeOnEscape = input(true, { transform: booleanAttribute });
  /** Dismiss on backdrop click. Default `true`. */
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });
  /** Return focus to the opener on close. Default `true`. */
  readonly restoreFocus = input(true, { transform: booleanAttribute });
  /** Set `document.body` overflow to `hidden` while open. Default `true`. */
  readonly scrollLock = input(true, { transform: booleanAttribute });

  /** Emits after the dialog finishes closing. */
  readonly closed = output<AlDialogClosed>();

  private opened = false;
  private closeReason: AlDialogCloseReason = 'close';
  private suppressEmit = false;
  private opener: HTMLElement | null = null;
  private pointerDownOnBackdrop = false;
  private bodyLocked = false;

  constructor() {
    effect(() => {
      const shouldOpen = this.open();
      untracked(() => {
        if (shouldOpen) {
          this.show();
        } else {
          this.hide('close');
        }
      });
    });

    this.destroyRef.onDestroy(() => this.teardown(true));
  }

  /** Close from the template (`#d="alDialog"; d.close()`). */
  close(): void {
    this.hide('close');
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    if (this.closeOnEscape()) {
      this.hide('escape');
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    this.pointerDownOnBackdrop = event.target === this.el;
  }

  protected onClick(event: MouseEvent): void {
    if (
      this.opened &&
      this.closeOnBackdrop() &&
      this.pointerDownOnBackdrop &&
      event.target === this.el
    ) {
      this.hide('backdrop');
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.opened || event.key !== 'Tab') return;

    const focusable = this.focusable();
    if (focusable.length === 0) {
      event.preventDefault();
      this.el.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onNativeClose(): void {
    this.teardown(false);
  }

  private show(): void {
    if (this.opened) return;
    if (typeof this.el.showModal !== 'function') return;

    if (this.restoreFocus()) {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else {
      this.opener = null;
    }

    // Prefer top-layer modal over a modeless native `open` attribute.
    this.el.removeAttribute('open');
    this.el.showModal();
    this.opened = true;
    this.lockScroll();

    queueMicrotask(() => this.focusInitial());
  }

  private hide(reason: AlDialogCloseReason): void {
    if (!this.opened) return;
    this.closeReason = reason;
    if (this.el.open) {
      this.el.close();
      return;
    }
    this.teardown(false);
  }

  private teardown(fromDestroy: boolean): void {
    if (!this.opened) return;
    this.opened = false;
    this.unlockScroll();
    this.restoreOpener();

    if (fromDestroy) {
      this.suppressEmit = true;
      if (this.el.open) {
        this.el.close();
      }
      return;
    }

    if (this.suppressEmit) {
      this.suppressEmit = false;
      return;
    }

    this.closed.emit({ reason: this.closeReason });
    this.closeReason = 'close';
  }

  private focusInitial(): void {
    if (!this.opened) return;
    const first = this.focusable()[0];
    (first ?? this.el).focus();
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1,
    );
  }

  private restoreOpener(): void {
    if (!this.restoreFocus()) return;
    const opener = this.opener;
    this.opener = null;
    if (opener && document.contains(opener)) {
      opener.focus();
    }
  }

  private lockScroll(): void {
    if (!this.scrollLock() || this.bodyLocked || typeof document === 'undefined') return;
    if (scrollLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;
    this.bodyLocked = true;
  }

  private unlockScroll(): void {
    if (!this.bodyLocked || typeof document === 'undefined') return;
    this.bodyLocked = false;
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      document.body.style.overflow = previousBodyOverflow;
    }
  }
}
