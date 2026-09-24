import { Component, inject } from '@angular/core';
import { AlDialogClose, AlDialogTitle, injectDialogStrings } from '@angular-libs/dialog';
import { WindowRef } from './window-ref';

/**
 * Window title bar: drag handle, double-click to maximize, and minimize / maximize /
 * fullscreen / close buttons.
 */
@Component({
  selector: 'al-window-header',
  imports: [AlDialogTitle, AlDialogClose],
  host: { class: 'al-dialog-header al-window-header', '(dblclick)': 'onDoubleClick($event)' },
  template: `
    <div class="al-dialog-titles">
      <h2 class="al-dialog-title" alDialogTitle><ng-content /></h2>
    </div>
    <ng-content select="[alDialogHeaderActions]" />
    <button class="al-icon-btn" [attr.aria-label]="strings().minimize" [title]="strings().minimize" (click)="win.minimize()">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11h10" /></svg>
    </button>
    <button class="al-icon-btn" [attr.aria-label]="maximizeLabel()" [title]="maximizeLabel()" (click)="win.toggleMaximize()">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        @if (win.mode() === 'maximized') {
          <path d="M5 3h8v8M3 5h8v8H3z" />
        } @else {
          <path d="M3 3h10v10H3z" />
        }
      </svg>
    </button>
    <button class="al-icon-btn" [attr.aria-label]="fullscreenLabel()" [title]="fullscreenLabel()" (click)="win.toggleFullscreen()">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
    </button>
    <button class="al-icon-btn" alDialogClose [attr.aria-label]="strings().close" [title]="strings().close">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
    </button>
  `,
})
export class AlWindowHeader {
  protected readonly win = inject(WindowRef);
  protected readonly strings = injectDialogStrings();
  protected maximizeLabel = () => (this.win.mode() === 'maximized' ? this.strings().restore : this.strings().maximize);
  protected fullscreenLabel = () => (this.win.isFullscreen() ? this.strings().exitFullscreen : this.strings().fullscreen);

  protected onDoubleClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('button')) this.win.toggleMaximize();
  }
}
