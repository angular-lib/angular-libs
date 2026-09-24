import { Component, computed, input } from '@angular/core';
import { injectDialog } from './inject-dialog';
import { DialogParts } from './parts';
import { injectDialogStrings, type DialogOptions } from './types';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** `danger` styles the confirm button as destructive. */
  tone?: 'default' | 'danger';
  /**
   * Runs when the user confirms. While pending the button shows a spinner and the dialog
   * cannot be dismissed. If it throws, the error is shown and the user can retry or cancel.
   */
  onConfirm?: () => unknown;
  /** Error text when `onConfirm` throws. Default: `strings.error`. */
  errorText?: string | ((error: unknown) => string);
  /** Default `sm`. */
  size?: DialogOptions['size'];
  mobile?: DialogOptions['mobile'];
}

/** Built with the public parts — the same building blocks as any dialog. */
@Component({
  selector: 'al-confirm-dialog',
  imports: [DialogParts],
  template: `
    <al-dialog-header>{{ options().title }}</al-dialog-header>
    <al-dialog-body>
      @if (options().message) {
        <p alDialogDescription class="al-dialog-message">{{ options().message }}</p>
      }
      @if (confirm.error()) {
        <p class="al-dialog-error" role="alert">{{ errorText() }}</p>
      }
    </al-dialog-body>
    <al-dialog-footer>
      @if (!alert()) {
        <button class="al-btn al-btn-secondary" autofocus [alDialogClose]="false">
          {{ options().cancelText ?? strings().cancel }}
        </button>
      }
      <button
        class="al-btn"
        [class]="options().tone === 'danger' ? 'al-btn-danger' : 'al-btn-primary'"
        [autofocus]="alert()"
        [disabled]="confirm.pending()"
        [attr.aria-busy]="confirm.pending() || null"
        (click)="confirm()"
      >
        {{ options().confirmText ?? strings().ok }}
      </button>
    </al-dialog-footer>
  `,
})
export class ConfirmDialog {
  readonly options = input.required<ConfirmOptions>();
  readonly alert = input<boolean>();
  readonly dialog = injectDialog<boolean>();
  protected readonly strings = injectDialogStrings();

  protected readonly confirm = this.dialog.action(async () => {
    await this.options().onConfirm?.();
    return true;
  });

  protected readonly errorText = computed(() => {
    const text = this.options().errorText;
    return typeof text === 'function' ? text(this.confirm.error()) : (text ?? this.strings().error);
  });
}
