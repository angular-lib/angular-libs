import { Component, inject, input, output, signal, computed, DestroyRef, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { DialogRef } from '../dialog-ref';
import type { ComponentInputs } from '../dialog.types';

@Component({
  selector: 'al-default-dialog',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  template: `
    <div class="al-dialog-container">
      @if (showHeader()) {
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
              <button
                type="button"
                class="al-action-icon"
                (click)="onMinimize($event)"
                [attr.aria-label]="minimizeTooltip()"
                [title]="minimizeTooltip()"
              >
                <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M14 8v1H2V8h12z" />
                </svg>
              </button>
            }
            @if (showMaximizeIcon()) {
              <button
                type="button"
                class="al-action-icon"
                (click)="onToggleMaximize($event)"
                [attr.aria-label]="isMaximized ? restoreTooltip() : maximizeTooltip()"
                [title]="isMaximized ? restoreTooltip() : maximizeTooltip()"
              >
                @if (isMaximized) {
                  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M3 5v9h9V5H3zm8 8H4V6h7v7zM5 5h1V4h7v7h-1v1h2V3H5v2z" />
                  </svg>
                } @else {
                  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M3 3v10h10V3H3zm9 9H4V4h8v8z" />
                  </svg>
                }
              </button>
            }
            @if (showFullscreenIcon()) {
              <button
                type="button"
                class="al-action-icon"
                (click)="onToggleFullscreen($event)"
                [attr.aria-label]="isFullscreenState() ? exitFullscreenTooltip() : fullscreenTooltip()"
                [title]="isFullscreenState() ? exitFullscreenTooltip() : fullscreenTooltip()"
              >
                @if (isFullscreenState()) {
                  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path
                      d="M5.5 1.5V4h-3v1h4V1.5h-1zm5 2.5V1.5h-1V5h4V4h-3zm-5 8H2.5v1h3v-4h-1v3zm5 0h3v-1h-4v4h1v-3z"
                    />
                  </svg>
                } @else {
                  <svg width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path
                      d="M1.5 1.5v3h1v-2h2v-1h-3zm13 0h-3v1h2v2h1v-3zm-13 13v-3h1v2h2v1h-3zm13 0h-3v-1h2v-2h1v3z"
                    />
                  </svg>
                }
              </button>
            }
            @if (showCloseIcon()) {
              <button
                type="button"
                class="al-action-icon"
                (click)="onCloseIcon()"
                [attr.aria-label]="closeTooltip()"
                [title]="closeTooltip()"
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
        </header>
      }

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

      <footer class="al-dialog-footer">
        @if (closeButtonText()) {
          <button type="button" class="al-btn al-btn-close" (click)="onCloseIcon()">
            {{ closeButtonText() }}
          </button>
        }
        @if (secondaryButtonText()) {
          <button type="button" class="al-btn al-btn-secondary" (click)="onSecondary()">
            {{ secondaryButtonText() }}
          </button>
        }
        @if (primaryButtonText()) {
          <button type="button" class="al-btn al-btn-primary" (click)="onPrimary()">
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
 * Built-in dialog chrome for alerts, confirms, and simple hosted content.
 *
 * Primary / secondary / close actions **close the dialog** with configurable results
 * (defaults: `true` / `false` / `undefined`). Output emitters still fire for advanced listeners.
 *
 * Body content is **plain text** (`contentText`) or a nested `contentComponent` — not HTML.
 */
export class DefaultDialogComponent<TComponent = any, TResult = unknown> {
  title = input<string>();
  subtitle = input<string>();
  showCloseIcon = input<boolean>(true);
  showMinimizeIcon = input<boolean>(false);
  showMaximizeIcon = input<boolean>(false);
  showFullscreenIcon = input<boolean>(false);

  minimizeTooltip = input<string>('Minimize');
  maximizeTooltip = input<string>('Maximize');
  restoreTooltip = input<string>('Restore');
  fullscreenTooltip = input<string>('Fullscreen');
  exitFullscreenTooltip = input<string>('Exit Fullscreen');
  closeTooltip = input<string>('Close');

  /** Plain text body (not HTML). Prefer `contentComponent` for rich content. */
  contentText = input<string>();
  contentComponent = input<Type<TComponent>>();
  contentInputs = input<ComponentInputs<TComponent>>();

  primaryButtonText = input<string>();
  secondaryButtonText = input<string>();
  closeButtonText = input<string>();

  /** Result passed to `DialogRef.close` when primary is clicked. Defaults to `true`. */
  primaryResult = input<TResult | boolean>(true as TResult);
  /** Result passed to `DialogRef.close` when secondary is clicked. Defaults to `false`. */
  secondaryResult = input<TResult | boolean>(false as TResult);
  /** Result passed when the close icon / close footer button is clicked. Defaults to `undefined`. */
  closeResult = input<TResult | undefined>(undefined);

  primaryAction = output<void>();
  secondaryAction = output<void>();

  dialogRef = inject(DialogRef, { optional: true }) as DialogRef<
    TResult,
    DefaultDialogComponent<TComponent, TResult>
  >;

  protected isNonModal = this.dialogRef?.options.modal === false;
  protected readonly isFullscreenState = signal(this.isFullscreen());

  /** Header renders only when there is a title, subtitle, or any window action. */
  protected readonly showHeader = computed(
    () =>
      !!this.title() ||
      !!this.subtitle() ||
      this.showCloseIcon() ||
      this.showMaximizeIcon() ||
      this.showFullscreenIcon() ||
      (this.showMinimizeIcon() && this.isNonModal),
  );

  constructor() {
    if (typeof document !== 'undefined') {
      const onFullscreenChange = () => this.isFullscreenState.set(this.isFullscreen());
      document.addEventListener('fullscreenchange', onFullscreenChange);
      inject(DestroyRef, { optional: true })?.onDestroy(() =>
        document.removeEventListener('fullscreenchange', onFullscreenChange),
      );
    }
  }

  get isMaximized() {
    return this.dialogRef?.isMaximized() ?? false;
  }

  isFullscreen() {
    return this.dialogRef?.isFullscreen() ?? false;
  }

  close(result?: TResult) {
    this.dialogRef?.close(result);
  }

  onPrimary() {
    this.primaryAction.emit();
    this.dialogRef?.close(this.primaryResult() as TResult, 'primary');
  }

  onSecondary() {
    this.secondaryAction.emit();
    this.dialogRef?.close(this.secondaryResult() as TResult, 'secondary');
  }

  onCloseIcon() {
    this.dialogRef?.close(this.closeResult() as TResult, 'manual');
  }

  onMinimize(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dialogRef?.minimize();
  }

  onToggleFullscreen(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void this.dialogRef?.toggleFullscreen();
  }

  onToggleMaximize(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dialogRef?.toggleMaximize();
  }
}
