import { Component, inject, input, output, signal, DestroyRef, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { DialogRef } from '../dialog-ref';
import { isMaximized, minimize, toggleMaximize, isFullscreen, toggleFullscreen } from '../actions';
import type { ComponentInputs, DialogComponent } from '../dialog.types';

@Component({
  selector: 'al-default-dialog',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <div class="al-dialog-container">
      <!-- HEADER -->
      <header class="al-dialog-header">
        <div class="al-header-titles">
          @if (title()) {
            <h2 class="al-dialog-title">{{ title() }}</h2>
          }
          @if (subtitle()) {
            <p class="al-dialog-subtitle">{{ subtitle() }}</p>
          }
        </div>

        <div class="al-window-actions">
          @if (showMinimizeIcon() && isNonModal) {
            <button class="al-action-icon" (click)="minimize($event)" [title]="minimizeTooltip()">
              <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 8v1H2V8h12z" />
              </svg>
            </button>
          }
          @if (showMaximizeIcon()) {
            <button class="al-action-icon" (click)="toggleMaximize($event)" [title]="isMaximized ? restoreTooltip() : maximizeTooltip()">
              @if (isMaximized) {
                <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 5v9h9V5H3zm8 8H4V6h7v7zM5 5h1V4h7v7h-1v1h2V3H5v2z" />
                </svg>
              } @else {
                <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z" />
                </svg>
              }
            </button>
          }
          @if (showFullscreenIcon()) {
            <button class="al-action-icon" (click)="toggleFullscreen($event)" [title]="isFullscreenState() ? exitFullscreenTooltip() : fullscreenTooltip()">
              @if (isFullscreenState()) {
                <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M5.5 1.5V4h-3v1h4V1.5h-1zm5 2.5V1.5h-1V5h4V4h-3zm-5 8H2.5v1h3v-4h-1v3zm5 0h3v-1h-4v4h1v-3z"
                  />
                </svg>
              } @else {
                <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M1.5 1.5v3h1v-2h2v-1h-3zm13 0h-3v1h2v2h1v-3zm-13 13v-3h1v2h2v1h-3zm13 0h-3v-1h2v-2h1v3z"
                  />
                </svg>
              }
            </button>
          }
          @if (showCloseIcon()) {
            <button class="al-action-icon" (click)="close()" [title]="closeTooltip()">
              <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.707L8 8.707z"
                />
              </svg>
            </button>
          }
        </div>
      </header>

      <!-- CONTENT -->
      <section class="al-dialog-content">
        @if (contentText()) {
          <p>{{ contentText() }}</p>
        } @else if (contentComponent()) {
          <ng-container
            *ngComponentOutlet="contentComponent()!; inputs: contentInputs()!"
          ></ng-container>
        } @else {
          <ng-content></ng-content>
        }
      </section>

      <!-- FOOTER -->
      <footer class="al-dialog-footer">
        @if (closeButtonText()) {
          <button class="al-btn al-btn-close" (click)="close()">{{ closeButtonText() }}</button>
        }
        @if (secondaryButtonText()) {
          <button class="al-btn al-btn-secondary" (click)="secondaryAction.emit()">
            {{ secondaryButtonText() }}
          </button>
        }
        @if (primaryButtonText()) {
          <button class="al-btn al-btn-primary" (click)="primaryAction.emit()">
            {{ primaryButtonText() }}
          </button>
        }
        <ng-content select="[dialog-actions]"></ng-content>
      </footer>
    </div>
  `,
  styleUrl: './default-dialog.component.css',
})
/**
 * A highly versatile and pre-styled built-in dialog container component.
 *
 * Provides an out-of-the-box solution for standard dialog use cases:
 * - Alerts, confirmation panels, and custom prompt messages.
 * - Dynamic hosting of another Angular component inside the content area.
 * - Auto-wiring of header actions (minimize, maximize, close buttons).
 * - Styled primary, secondary, and standard footer buttons with built-in output emitters.
 *
 * Fits perfectly for quick notifications, forms, or layered overlays.
 *
 * @example
 * ```ts
 * // 1. Open a built-in alert or confirmation panel:
 * const dialogRef = dialogService.open(DefaultDialogComponent, {
 *   inputs: {
 *     title: 'Confirm Action',
 *     contentText: 'Are you sure you want to delete this resource?',
 *     primaryButtonText: 'Delete',
 *     secondaryButtonText: 'Cancel'
 *   }
 * });
 *
 * // 2. Embed a custom component inside the content body with dynamic inputs:
 * const dialogRef = dialogService.open(DefaultDialogComponent, {
 *   inputs: {
 *     title: 'Edit Settings',
 *     contentComponent: SettingsFormComponent,
 *     contentInputs: { userId: '123' },
 *     closeButtonText: 'Cancel'
 *   }
 * });
 * ```
 */
export class DefaultDialogComponent<TComponent = any> implements DialogComponent<any> {
  /** Optional title displayed prominently in the header. */
  title = input<string>();

  /** Optional subtitle or descriptive sub-header text. */
  subtitle = input<string>();

  /** Whether to show the standard close icon button in the header. Defaults to true. */
  showCloseIcon = input<boolean>(true);

  /** Whether to show the minimize icon button in the header. Only visible for modeless (non-modal) dialogs. Defaults to false. */
  showMinimizeIcon = input<boolean>(false);

  /** Whether to show the maximize icon button in the header. Defaults to false. */
  showMaximizeIcon = input<boolean>(false);

  /** Whether to show the fullscreen icon button in the header. Defaults to false. */
  showFullscreenIcon = input<boolean>(false);

  /** Tooltip text for the minimize button in the header. Defaults to 'Minimize'. */
  minimizeTooltip = input<string>('Minimize');

  /** Tooltip text for the maximize button in the header when not maximized. Defaults to 'Maximize'. */
  maximizeTooltip = input<string>('Maximize');

  /** Tooltip text for the maximize button in the header when maximized. Defaults to 'Restore'. */
  restoreTooltip = input<string>('Restore');

  /** Tooltip text for the fullscreen button in the header when not in fullscreen. Defaults to 'Fullscreen'. */
  fullscreenTooltip = input<string>('Fullscreen');

  /** Tooltip text for the fullscreen button in the header when in fullscreen. Defaults to 'Exit Fullscreen'. */
  exitFullscreenTooltip = input<string>('Exit Fullscreen');

  /** Tooltip text for the close button in the header. Defaults to 'Close'. */
  closeTooltip = input<string>('Close');

  /** Plain text or HTML string to render inside the dialog content body. */
  contentText = input<string>();

  /** An optional Angular component class to dynamically instantiate inside the content body. */
  contentComponent = input<Type<TComponent>>();

  /** Strongly-typed inputs to pass to the dynamically instantiated `contentComponent`. */
  contentInputs = input<ComponentInputs<TComponent>>();

  /** Label text for the primary action button. If omitted, the button is not rendered. */
  primaryButtonText = input<string>();

  /** Label text for the secondary action button. If omitted, the button is not rendered. */
  secondaryButtonText = input<string>();

  /** Label text for a standard close/cancel button in the footer. If omitted, the button is not rendered. */
  closeButtonText = input<string>();

  /** Event emitted when the primary action button is clicked. */
  primaryAction = output<void>();

  /** Event emitted when the secondary action button is clicked. */
  secondaryAction = output<void>();

  dialogRef = inject(DialogRef, { optional: true }) as any;

  protected isNonModal = this.dialogRef?.options.modal === false;

  /**
   * Reactive fullscreen state. Native fullscreen settles asynchronously via the
   * `fullscreenchange` event (including when the user exits with Escape), which fires outside
   * Angular's change detection. Tracking it in a signal keeps the icon/tooltip in sync.
   */
  protected readonly isFullscreenState = signal(this.isFullscreen());

  constructor() {
    if (typeof document !== 'undefined') {
      const onFullscreenChange = () => this.isFullscreenState.set(this.isFullscreen());
      document.addEventListener('fullscreenchange', onFullscreenChange);
      inject(DestroyRef).onDestroy(() =>
        document.removeEventListener('fullscreenchange', onFullscreenChange),
      );
    }
  }

  get isMaximized() {
    return this.dialogRef ? isMaximized(this.dialogRef) : false;
  }

  isFullscreen() {
    return this.dialogRef ? isFullscreen(this.dialogRef) : false;
  }

  close() {
    this.dialogRef?.close();
  }

  minimize(event: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.dialogRef) {
      minimize(this.dialogRef);
    }
  }

  toggleFullscreen(event: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.dialogRef) {
      toggleFullscreen(this.dialogRef);
    }
  }

  toggleMaximize(event: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.dialogRef) {
      toggleMaximize(this.dialogRef);
    }
  }
}
