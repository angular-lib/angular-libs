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
import {
  applyAutoFocus,
  isClickInsideDialog,
  lockBodyScroll,
  queryFocusable,
  unlockBodyScroll,
} from './dialog-behavior';
import type { AutoFocusTarget, DialogRole } from './dialog.types';

export type AlDialogCloseReason = 'escape' | 'backdrop' | 'close';

export interface AlDialogClosed {
  reason: AlDialogCloseReason;
}

/**
 * Headless modal (and optional modeless) behavior on the consumer’s own `<dialog>`.
 *
 * Native `<dialog>` is required so `showModal()` can use the top layer.
 * The lib does not inject CSS, tokens, or chrome — that’s the batteries path
 * (`DialogService` + `core.css`).
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
    '[attr.aria-modal]': 'modal() ? "true" : "false"',
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.aria-labelledby]': 'labelledBy() || null',
    '[attr.aria-describedby]': 'describedBy() || null',
    '[attr.role]': 'role() || undefined',
    '[attr.tabindex]': '-1',
    '(cancel)': 'onCancel($event)',
    '(mousedown)': 'onMouseDown($event)',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
    '(close)': 'onNativeClose()',
  },
})
export class AlDialog {
  private readonly el = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);

  /** When true, opens the dialog (`showModal` / `show`); when false, closes it. */
  readonly open = input(false, { transform: booleanAttribute });
  /**
   * Modal (`showModal`, focus trap, `aria-modal=true`) vs modeless (`show`).
   * Default `true`. Design-system hosts almost always want modal.
   */
  readonly modal = input(true, { transform: booleanAttribute });
  /** Sets `aria-labelledby` on the host. */
  readonly labelledBy = input<string | undefined>(undefined);
  /** Sets `aria-describedby` on the host. */
  readonly describedBy = input<string | undefined>(undefined);
  /** Sets `aria-label` when there is no labelled-by id. */
  readonly ariaLabel = input<string | undefined>(undefined);
  /** Explicit role. Confirm/alert use `alertdialog`. */
  readonly role = input<DialogRole | undefined>(undefined);
  /** Dismiss on Escape. Default `true`. */
  readonly closeOnEscape = input(true, { transform: booleanAttribute });
  /** Dismiss on backdrop (click outside the dialog box). Default `true`. */
  readonly closeOnBackdrop = input(true, { transform: booleanAttribute });
  /** Return focus to the opener on close. Default `true`. */
  readonly restoreFocus = input(true, { transform: booleanAttribute });
  /** Set `document.body` overflow to `hidden` while open. Default `true`. */
  readonly scrollLock = input(true, { transform: booleanAttribute });
  /** Where to put focus after open. Default `first-tabbable`. */
  readonly autoFocus = input<AutoFocusTarget>('first-tabbable');

  /** Emits after the dialog finishes closing. */
  readonly closed = output<AlDialogClosed>();

  /**
   * When set (DialogService), Escape/backdrop go through {@link DialogRef.close}
   * so plugins and leave animations still run.
   * @internal
   */
  dismissHandler: ((reason: AlDialogCloseReason) => void) | null = null;

  private opened = false;
  private closeReason: AlDialogCloseReason = 'close';
  private suppressEmit = false;
  private opener: HTMLElement | null = null;
  private mousedownInside = false;
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
      this.requestDismiss('escape');
    }
  }

  protected onMouseDown(event: MouseEvent): void {
    this.mousedownInside = isClickInsideDialog(this.el, event);
  }

  protected onClick(event: MouseEvent): void {
    if (!this.opened || !this.closeOnBackdrop()) return;
    if (!this.mousedownInside && !isClickInsideDialog(this.el, event)) {
      this.requestDismiss('backdrop');
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.opened || !this.modal() || event.key !== 'Tab') return;

    const focusable = queryFocusable(this.el);
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

  private requestDismiss(reason: AlDialogCloseReason): void {
    if (this.dismissHandler) {
      this.dismissHandler(reason);
      return;
    }
    this.hide(reason);
  }

  private show(): void {
    if (this.opened) return;
    const isModal = this.modal();
    if (isModal && typeof this.el.showModal !== 'function') return;
    if (!isModal && typeof this.el.show !== 'function') return;

    if (this.restoreFocus()) {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    } else {
      this.opener = null;
    }

    this.el.removeAttribute('open');
    if (isModal) {
      this.el.showModal();
    } else {
      this.el.show();
    }
    this.opened = true;
    this.lockScroll();

    queueMicrotask(() => {
      if (!this.opened) return;
      applyAutoFocus(this.el, this.autoFocus());
    });
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

  private restoreOpener(): void {
    if (!this.restoreFocus()) return;
    const opener = this.opener;
    this.opener = null;
    if (opener && document.contains(opener)) {
      opener.focus();
    }
  }

  private lockScroll(): void {
    if (!this.scrollLock() || this.bodyLocked) return;
    lockBodyScroll();
    this.bodyLocked = true;
  }

  private unlockScroll(): void {
    if (!this.bodyLocked) return;
    this.bodyLocked = false;
    unlockBodyScroll();
  }
}
