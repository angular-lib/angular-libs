import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { DataGridStatusBarSlotItem } from '../../plugins/types';

export interface DataGridStatusBarLabels {
  statusRows: string;
  paginationLabel: string;
  paginationPrev: string;
  paginationNext: string;
}

/**
 * Footer chrome — status slot texts + optional pagination controls.
 */
@Component({
  selector: 'al-data-grid-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="al-data-grid__footer"
      role="navigation"
      [attr.aria-label]="pagination() ? labels().paginationLabel : 'Status'"
      data-testid="al-dg-footer"
    >
      <div class="al-data-grid__status" data-testid="al-dg-status-bar">
        @if (showRowCount()) {
          <span class="al-data-grid__meta">
            {{ rowCount() }} {{ labels().statusRows }}
          </span>
        }
        @for (item of slotItems(); track item.id) {
          @if (item.text(); as text) {
            @if (text) {
              <span class="al-data-grid__meta">{{ text }}</span>
            }
          }
        }
      </div>
      @if (pagination()) {
        <div class="al-data-grid__pager">
          <button
            type="button"
            class="al-data-grid__page-btn"
            [disabled]="pageIndex() === 0"
            (click)="pageChange.emit(pageIndex() - 1)"
          >
            {{ labels().paginationPrev }}
          </button>
          <span class="al-data-grid__page-label">
            {{ labels().paginationLabel }} {{ pageIndex() + 1 }} / {{ totalPages() }}
          </span>
          <button
            type="button"
            class="al-data-grid__page-btn"
            [disabled]="pageIndex() >= totalPages() - 1"
            (click)="pageChange.emit(pageIndex() + 1)"
          >
            {{ labels().paginationNext }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 0 0 auto;
    }
    .al-data-grid__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border-top: 1px solid var(--al-dg-border, #e5e7eb);
      background: var(--al-dg-header-bg, #f9fafb);
      flex: 0 0 auto;
    }
    .al-data-grid__status {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      min-width: 0;
    }
    .al-data-grid__meta {
      color: var(--al-dg-muted, #6b7280);
    }
    .al-data-grid__pager {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .al-data-grid__page-btn {
      border: 1px solid var(--al-dg-border, #e5e7eb);
      background: var(--al-dg-bg, #fff);
      color: inherit;
      border-radius: 4px;
      padding: 4px 8px;
      font: inherit;
      cursor: pointer;
    }
    .al-data-grid__page-btn:disabled {
      opacity: 0.45;
      cursor: default;
    }
  `,
})
export class DataGridStatusBar {
  readonly pagination = input(false);
  /** When true, shows `rowCount` + locale statusRows (avoid if a rows status slot exists). */
  readonly showRowCount = input(false);
  readonly rowCount = input(0);
  readonly pageIndex = input(0);
  readonly totalPages = input(1);
  readonly slotItems = input<readonly DataGridStatusBarSlotItem[]>([]);
  readonly labels = input.required<DataGridStatusBarLabels>();

  readonly pageChange = output<number>();
}
