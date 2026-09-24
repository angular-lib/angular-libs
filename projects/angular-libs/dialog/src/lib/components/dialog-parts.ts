import {
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  HostAttributeToken,
  computed,
  inject,
  input,
  signal,
  type Signal,
} from '@angular/core';
import { AlDialog } from '../al-dialog';
import { DialogRef } from '../dialog-ref';
import { DialogService } from '../dialog.service';
import { resolveDialogStrings } from '../dialog.types';

let nextPartId = 0;

interface ChromeHost {
  readonly element: HTMLDialogElement | null;
  readonly busy: Signal<boolean>;
  close(result?: unknown): void;
}

const NOT_BUSY = signal(false).asReadonly();

/**
 * The nearest dialog: a headless `<dialog alDialog>` in the same template wins over
 * the `DialogRef` of a service-opened dialog further up.
 */
function injectChromeHost(): ChromeHost {
  const alDialog = inject(AlDialog, { optional: true });
  if (alDialog) {
    return { element: alDialog.element, busy: NOT_BUSY, close: () => alDialog.close() };
  }
  const ref = inject(DialogRef, { optional: true });
  if (ref) {
    return { element: ref.dialogEl, busy: ref.busy, close: (r) => void ref.close(r, 'manual') };
  }
  return { element: null, busy: NOT_BUSY, close: () => {} };
}

/** Points `attr` on the dialog at `id` unless the consumer already set it (or `aria-label`). */
function linkToDialog(
  dialogEl: HTMLDialogElement | null,
  attr: 'aria-labelledby' | 'aria-describedby',
  id: string,
): void {
  if (!dialogEl || dialogEl.hasAttribute(attr)) return;
  if (attr === 'aria-labelledby' && dialogEl.hasAttribute('aria-label')) return;
  dialogEl.setAttribute(attr, id);
  inject(DestroyRef).onDestroy(() => {
    if (dialogEl.getAttribute(attr) === id) dialogEl.removeAttribute(attr);
  });
}

/**
 * Reads or assigns the host id immediately (not via a host binding): the service reads
 * ids while the content is created, before the first binding pass.
 */
function hostId(prefix: string): string {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  if (!el.id) el.id = `${prefix}-${++nextPartId}`;
  return el.id;
}

/**
 * Marks the dialog's title and wires `aria-labelledby` — no `labelledBy` / id plumbing.
 * Works in `DialogService` dialogs and on headless `<dialog alDialog>`.
 *
 * @example
 * ```html
 * <h2 alDialogTitle>Edit user</h2>
 * ```
 */
@Directive({ selector: '[alDialogTitle]' })
export class AlDialogTitle {
  readonly id = hostId('al-dialog-title');

  constructor() {
    linkToDialog(injectChromeHost().element, 'aria-labelledby', this.id);
  }
}

/** Marks a short description and wires `aria-describedby`. */
@Directive({ selector: '[alDialogDescription]' })
export class AlDialogDescription {
  readonly id = hostId('al-dialog-desc');

  constructor() {
    linkToDialog(injectChromeHost().element, 'aria-describedby', this.id);
  }
}

/**
 * Closes the nearest dialog on click, with an optional result.
 * `<button alDialogClose>` dismisses; `<button [alDialogClose]="value">` closes with `value`.
 * Ignored while the dialog is busy. Buttons default to `type="button"` so they never
 * submit a surrounding form.
 */
@Directive({
  selector: '[alDialogClose]',
  host: {
    '[attr.type]': 'buttonType',
    '[attr.aria-disabled]': 'host.busy() || null',
    '(click)': 'onClick()',
  },
})
export class AlDialogClose {
  /** Close result. Empty (`alDialogClose` without a value) closes without one. */
  readonly alDialogClose = input<unknown>();

  protected readonly host = injectChromeHost();
  protected readonly buttonType =
    inject(new HostAttributeToken('type'), { optional: true }) ??
    (inject(ElementRef).nativeElement instanceof HTMLButtonElement ? 'button' : null);

  protected onClick(): void {
    if (this.host.busy()) return;
    const value = this.alDialogClose();
    this.host.close(value === '' ? undefined : value);
  }
}

/**
 * Dialog header: title (projected), optional subtitle (`[alDialogSubtitle]`), extra
 * actions (`[alDialogHeaderActions]`) and a close button.
 *
 * @example
 * ```html
 * <al-dialog-header>
 *   Edit user
 *   <p alDialogSubtitle>Changes apply immediately</p>
 * </al-dialog-header>
 * ```
 */
@Component({
  selector: 'al-dialog-header',
  imports: [AlDialogTitle, AlDialogClose],
  host: { class: 'al-dialog-header' },
  template: `
    <div class="al-header-titles">
      <h2 class="al-dialog-title" alDialogTitle><ng-content /></h2>
      <ng-content select="[alDialogSubtitle]" />
    </div>
    <div class="al-window-actions">
      <ng-content select="[alDialogHeaderActions]" />
      @if (closable()) {
        <button
          class="al-action-icon"
          alDialogClose
          [attr.aria-label]="resolvedCloseLabel()"
          [title]="resolvedCloseLabel()"
        >
          <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.707L8 8.707z"
            />
          </svg>
        </button>
      }
    </div>
  `,
})
export class AlDialogHeader {
  /** Show the close (×) button. Default `true`. */
  readonly closable = input(true);
  /** Close button label. Defaults to `provideDialog({ strings: { close } })`, then `'Close'`. */
  readonly closeLabel = input<string>();

  private readonly service = inject(DialogService);
  protected readonly resolvedCloseLabel = computed(
    () => this.closeLabel() ?? resolveDialogStrings(this.service.config().strings)?.close ?? 'Close',
  );
}

/** Scrollable dialog body. */
@Component({
  selector: 'al-dialog-body',
  host: { class: 'al-dialog-body' },
  template: '<ng-content />',
})
export class AlDialogBody {}

/** Footer for actions, end-aligned. */
@Component({
  selector: 'al-dialog-footer',
  host: { class: 'al-dialog-footer' },
  template: '<ng-content />',
})
export class AlDialogFooter {}

/**
 * All chrome parts. Styles ship in `core.css`; on the headless path they are unstyled
 * and only add semantics (title / description wiring, close buttons).
 *
 * @example
 * ```ts
 * @Component({ imports: [DialogParts], template: `
 *   <al-dialog-header>Edit user</al-dialog-header>
 *   <al-dialog-body>…</al-dialog-body>
 *   <al-dialog-footer>
 *     <button class="al-btn al-btn-secondary" alDialogClose>Cancel</button>
 *     <button class="al-btn al-btn-primary" [alDialogClose]="form.value">Save</button>
 *   </al-dialog-footer>` })
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
