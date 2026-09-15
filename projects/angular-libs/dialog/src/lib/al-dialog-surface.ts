import { Component, inject, type ComponentRef } from '@angular/core';
import { AlDialog, type AlDialogCloseReason } from './al-dialog';
import type { AutoFocusTarget } from './dialog.types';

export interface AlDialogPresentOptions {
  modal: boolean;
  labelledBy?: string;
  describedBy?: string;
  closeOnEscape: boolean;
  closeOnBackdrop: boolean;
  restoreFocus: boolean;
  autoFocus?: AutoFocusTarget;
}

/**
 * Batteries host: native `<dialog>` + {@link AlDialog}.
 * `DialogService` creates this, drops chrome inside, and applies `core.css` classes.
 * Design-system consumers put `alDialog` on their own markup instead.
 *
 * @internal
 */
@Component({
  selector: 'dialog[al-dialog-surface]',
  standalone: true,
  template: '',
  host: {
    class: 'al-dialog',
  },
  hostDirectives: [
    {
      directive: AlDialog,
      inputs: [
        'open',
        'modal',
        'labelledBy',
        'describedBy',
        'closeOnEscape',
        'closeOnBackdrop',
        'restoreFocus',
        'autoFocus',
      ],
      outputs: ['closed'],
    },
  ],
})
export class AlDialogSurface {
  readonly alDialog = inject(AlDialog);

  wireDismiss(handler: (reason: AlDialogCloseReason) => void): void {
    this.alDialog.handleDismiss(handler);
  }
}

/** Push batteries options onto the surface and open it. */
export function presentDialogSurface(
  ref: ComponentRef<AlDialogSurface>,
  options: AlDialogPresentOptions,
): void {
  ref.setInput('open', true);
  ref.setInput('modal', options.modal);
  ref.setInput('labelledBy', options.labelledBy);
  ref.setInput('describedBy', options.describedBy);
  ref.setInput('closeOnEscape', options.closeOnEscape);
  ref.setInput('closeOnBackdrop', options.closeOnBackdrop);
  ref.setInput('restoreFocus', options.restoreFocus);
  ref.setInput('autoFocus', options.autoFocus);
  ref.changeDetectorRef.detectChanges();
}
