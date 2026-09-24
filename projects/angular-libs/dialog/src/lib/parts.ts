import { Component, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { AlDialog } from './al-dialog';
import { DialogRef } from './dialog-ref';
import { injectDialogStrings } from './types';

let nextId = 0;

/**
 * The nearest dialog: a headless `<dialog alDialog>` in the same template wins over the
 * `DialogRef` of a service-opened dialog further up.
 */
function injectHost() {
  const alDialog = inject(AlDialog, { optional: true });
  const ref = alDialog ? null : inject(DialogRef, { optional: true });
  return {
    element: alDialog?.element ?? ref?.element ?? null,
    busy: () => ref?.busy() ?? false,
    close: (value: unknown) => (alDialog ? alDialog.close() : void ref?.close(value)),
  };
}

/** Gives the host an id and points `attr` of the dialog at it, unless already labelled. */
function linkToDialog(attr: 'aria-labelledby' | 'aria-describedby', prefix: string): void {
  const el: HTMLElement = inject(ElementRef).nativeElement;
  const dialog = injectHost().element;
  // Assigned directly (not a host binding): the id must exist while the content is created.
  el.id ||= `${prefix}-${++nextId}`;
  if (!dialog || dialog.hasAttribute(attr)) return;
  if (attr === 'aria-labelledby' && dialog.hasAttribute('aria-label')) return;
  dialog.setAttribute(attr, el.id);
  inject(DestroyRef).onDestroy(() => {
    if (dialog.getAttribute(attr) === el.id) dialog.removeAttribute(attr);
  });
}

/** Labels the dialog (`aria-labelledby`). */
@Directive({ selector: '[alDialogTitle]' })
export class AlDialogTitle {
  constructor() {
    linkToDialog('aria-labelledby', 'al-dialog-title');
  }
}

/** Describes the dialog (`aria-describedby`). Use for short text, not whole forms. */
@Directive({ selector: '[alDialogDescription]' })
export class AlDialogDescription {
  constructor() {
    linkToDialog('aria-describedby', 'al-dialog-desc');
  }
}

/**
 * Closes the nearest dialog on click: `alDialogClose` dismisses, `[alDialogClose]="value"`
 * closes with `value`. Buttons default to `type="button"`; ignored while the dialog is busy.
 */
@Directive({
  selector: '[alDialogClose]',
  host: {
    '[attr.type]': 'type',
    '[attr.aria-disabled]': 'host.busy() || null',
    '(click)': 'host.busy() || host.close(alDialogClose() === "" ? undefined : alDialogClose())',
  },
})
export class AlDialogClose {
  readonly alDialogClose = input<unknown>();
  protected readonly host = injectHost();
  private readonly el: HTMLElement = inject(ElementRef).nativeElement;
  protected readonly type = this.el.getAttribute('type') ?? (this.el.tagName === 'BUTTON' ? 'button' : null);
}

/**
 * Header with the dialog title, an optional `[alDialogSubtitle]`, extra
 * `[alDialogHeaderActions]` and a close button.
 */
@Component({
  selector: 'al-dialog-header',
  imports: [AlDialogTitle, AlDialogClose],
  host: { class: 'al-dialog-header' },
  template: `
    <div class="al-dialog-titles">
      <h2 class="al-dialog-title" alDialogTitle><ng-content /></h2>
      <ng-content select="[alDialogSubtitle]" />
    </div>
    <ng-content select="[alDialogHeaderActions]" />
    @if (closable()) {
      <button class="al-icon-btn" alDialogClose [attr.aria-label]="strings().close" [title]="strings().close">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    }
  `,
})
export class AlDialogHeader {
  /** Show the × button. Default `true`. */
  readonly closable = input(true);
  protected readonly strings = injectDialogStrings();
}

/** Scrolling body. */
@Component({ selector: 'al-dialog-body', host: { class: 'al-dialog-body' }, template: '<ng-content />' })
export class AlDialogBody {}

/** End-aligned actions. */
@Component({ selector: 'al-dialog-footer', host: { class: 'al-dialog-footer' }, template: '<ng-content />' })
export class AlDialogFooter {}

/**
 * All chrome parts. Styled by `core.css`; without it they only add semantics.
 *
 * @example
 * ```html
 * <al-dialog-header>Edit user</al-dialog-header>
 * <al-dialog-body>…</al-dialog-body>
 * <al-dialog-footer>
 *   <button class="al-btn al-btn-secondary" alDialogClose>Cancel</button>
 *   <button class="al-btn al-btn-primary" [alDialogClose]="value">Save</button>
 * </al-dialog-footer>
 * ```
 */
export const DialogParts = [
  AlDialogHeader,
  AlDialogBody,
  AlDialogFooter,
  AlDialogTitle,
  AlDialogDescription,
  AlDialogClose,
] as const;
