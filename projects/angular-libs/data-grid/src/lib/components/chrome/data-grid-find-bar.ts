import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Find chrome — AG-style compact field: search icon + input + prev/next chevrons.
 */
@Component({
  selector: 'al-data-grid-find-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="al-dg-find" data-testid="al-dg-find">
      <span class="al-dg-find__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </span>
      <input
        class="al-dg-find__input"
        type="text"
        [value]="query()"
        (input)="queryChange.emit($any($event.target).value)"
        (keydown.enter)="onEnter($event)"
        [placeholder]="placeholder()"
        data-testid="al-dg-find-input"
        [attr.aria-label]="ariaLabel()"
      />
      @if (query().trim()) {
        <span class="al-dg-find__count" data-testid="al-dg-find-count">
          @if (matchCount() > 0) {
            {{ activeIndex() + 1 }}/{{ matchCount() }}
          } @else {
            0
          }
        </span>
      }
      <button
        type="button"
        class="al-dg-find__nav"
        (click)="prev.emit()"
        [disabled]="matchCount() === 0"
        data-testid="al-dg-find-prev"
        [attr.aria-label]="prevAriaLabel()"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M10 3.5 5.5 8 10 12.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="al-dg-find__nav"
        (click)="next.emit()"
        [disabled]="matchCount() === 0"
        data-testid="al-dg-find-next"
        [attr.aria-label]="nextAriaLabel()"
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M6 3.5 10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }
    .al-dg-find {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
      min-width: 200px;
      max-width: 280px;
      height: 32px;
      padding: 0 4px 0 8px;
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 6px;
      background: var(--al-dg-bg, #fff);
      color: var(--al-dg-muted, #6b7280);
      box-sizing: border-box;
    }
    .al-dg-find:focus-within {
      border-color: var(--al-dg-accent, #2563eb);
      color: var(--al-dg-fg, #111827);
    }
    .al-dg-find__icon {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      color: var(--al-dg-muted, #9ca3af);
    }
    .al-dg-find__input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      outline: none;
      padding: 0 4px;
      font: inherit;
      font-size: 13px;
      background: transparent;
      color: var(--al-dg-fg, #111827);
    }
    .al-dg-find__input::placeholder {
      color: var(--al-dg-muted, #9ca3af);
    }
    .al-dg-find__count {
      flex: 0 0 auto;
      padding: 0 2px;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: var(--al-dg-muted, #6b7280);
      white-space: nowrap;
    }
    .al-dg-find__nav {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--al-dg-muted, #9ca3af);
      cursor: pointer;
    }
    .al-dg-find__nav:hover:not(:disabled) {
      background: var(--al-dg-row-hover, #f3f4f6);
      color: var(--al-dg-fg, #111827);
    }
    .al-dg-find__nav:disabled {
      opacity: 0.35;
      cursor: default;
    }
  `,
})
export class DataGridFindBar {
  readonly query = input('');
  readonly matchCount = input(0);
  readonly activeIndex = input(0);
  readonly placeholder = input('Find...');
  readonly ariaLabel = input('Find in grid');
  readonly prevAriaLabel = input('Previous match');
  readonly nextAriaLabel = input('Next match');

  readonly queryChange = output<string>();
  readonly next = output<void>();
  readonly prev = output<void>();

  onEnter(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    keyEvent.preventDefault();
    if (keyEvent.shiftKey) {
      this.prev.emit();
    } else {
      this.next.emit();
    }
  }
}
