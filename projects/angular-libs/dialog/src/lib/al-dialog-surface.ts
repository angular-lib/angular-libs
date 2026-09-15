import { Component, inject } from '@angular/core';
import { AlDialog } from './al-dialog';

/**
 * Batteries host: a native `<dialog>` with {@link AlDialog} as a host directive.
 * `DialogService` creates this, then projects the consumer (or DefaultDialog) inside
 * and applies `core.css` classes. Not for design-system consumers — they put
 * `alDialog` on their own markup.
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
        'ariaLabel',
        'role',
        'closeOnEscape',
        'closeOnBackdrop',
        'restoreFocus',
        'scrollLock',
        'autoFocus',
      ],
      outputs: ['closed'],
    },
  ],
})
export class AlDialogSurface {
  readonly alDialog = inject(AlDialog);
}
