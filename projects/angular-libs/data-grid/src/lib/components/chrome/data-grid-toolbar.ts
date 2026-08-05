import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import type { DataGridApi } from '../../api/grid-api';
import type { GridController } from '../../create-grid';
import type {
  DataGridToolbarActionParams,
  DataGridToolbarSlotItem,
} from '../../plugins/types';
import { DataGridFindBar } from './data-grid-find-bar';

export interface DataGridToolbarLabels {
  quickFilterPlaceholder: string;
  findPlaceholder: string;
  findAriaLabel: string;
  findPrevAriaLabel: string;
  findNextAriaLabel: string;
}

/**
 * Toolbar chrome — quick filter, optional find bar, and registered slot actions.
 * Built-in tools (CSV / autosize) are opt-in plugins, not hardcoded here.
 */
@Component({
  selector: 'al-data-grid-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGridFindBar],
  template: `
    <div class="al-data-grid__toolbar">
      @if (showQuickFilter()) {
        <input
          class="al-data-grid__quick-input"
          type="search"
          [value]="quickFilter()"
          (input)="quickFilterChange.emit($any($event.target).value)"
          [placeholder]="labels().quickFilterPlaceholder"
          data-testid="al-dg-toolbar-quick-filter"
          aria-label="Quick filter"
        />
      }
      @if (findEnabled()) {
        <al-data-grid-find-bar
          [query]="findQuery()"
          [matchCount]="findMatchCount()"
          [activeIndex]="findActiveIndex()"
          [placeholder]="labels().findPlaceholder"
          [ariaLabel]="labels().findAriaLabel"
          [prevAriaLabel]="labels().findPrevAriaLabel"
          [nextAriaLabel]="labels().findNextAriaLabel"
          (queryChange)="findQueryChange.emit($event)"
          (next)="findNext.emit()"
          (prev)="findPrev.emit()"
        />
      }
      @for (item of slotItems(); track item.id) {
        <button
          type="button"
          class="al-data-grid__tool-btn al-data-grid__tool-btn--action"
          [class.al-data-grid__tool-btn--busy]="busyIds().has(item.id)"
          [style.--al-dg-action-color]="item.color ?? null"
          [disabled]="isDisabled(item) || busyIds().has(item.id)"
          [attr.aria-label]="item.ariaLabel"
          [attr.title]="item.title ?? item.ariaLabel"
          [attr.data-testid]="'al-dg-toolbar-action-' + item.id"
          (click)="onActionClick(item, $event)"
        >
          <span class="al-data-grid__tool-icon" aria-hidden="true">{{ item.icon }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 0 0 auto;
    }
    .al-data-grid__toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid var(--al-dg-border, #e5e7eb);
      background: var(--al-dg-header-bg, #f9fafb);
    }
    .al-data-grid__quick-input {
      flex: 1;
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit;
      background: var(--al-dg-bg, #fff);
      color: inherit;
    }
    .al-data-grid__tool-btn {
      border: 1px solid var(--al-dg-border, #e5e7eb);
      background: var(--al-dg-bg, #fff);
      border-radius: 6px;
      padding: 6px 10px;
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .al-data-grid__tool-btn--action {
      min-width: 34px;
      padding: 6px 8px;
      color: var(--al-dg-action-color, inherit);
      border-color: color-mix(in srgb, var(--al-dg-action-color, var(--al-dg-border, #e5e7eb)) 45%, var(--al-dg-border, #e5e7eb));
    }
    .al-data-grid__tool-icon {
      display: inline-block;
      line-height: 1;
      font-size: 14px;
    }
    .al-data-grid__tool-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .al-data-grid__tool-btn--busy {
      opacity: 0.65;
    }
  `,
})
export class DataGridToolbar {
  readonly api = input.required<DataGridApi<any>>();
  /** Bound `[controller]` from the host grid (always set). */
  readonly controller = input.required<GridController<any>>();
  readonly context = input<unknown>(null);
  readonly showQuickFilter = input(true);
  readonly quickFilter = input('');
  readonly findEnabled = input(false);
  readonly findQuery = input('');
  readonly findMatchCount = input(0);
  readonly findActiveIndex = input(0);
  readonly slotItems = input<readonly DataGridToolbarSlotItem[]>([]);
  readonly labels = input.required<DataGridToolbarLabels>();

  readonly quickFilterChange = output<string>();
  readonly findQueryChange = output<string>();
  readonly findNext = output<void>();
  readonly findPrev = output<void>();

  readonly busyIds = signal<ReadonlySet<string>>(new Set());

  actionParams(event?: MouseEvent): DataGridToolbarActionParams {
    return {
      api: this.api(),
      controller: this.controller(),
      context: this.context(),
      event,
    };
  }

  isDisabled(item: DataGridToolbarSlotItem): boolean {
    const disabled = item.disabled;
    if (typeof disabled === 'function') {
      return !!disabled(this.actionParams());
    }
    return !!disabled;
  }

  async onActionClick(item: DataGridToolbarSlotItem, event: MouseEvent): Promise<void> {
    const params = this.actionParams(event);
    if (this.busyIds().has(item.id)) {
      return;
    }
    if (typeof item.disabled === 'function' ? item.disabled(params) : !!item.disabled) {
      return;
    }

    this.busyIds.update((prev) => new Set(prev).add(item.id));
    try {
      await item.actionClick(params);
    } finally {
      this.busyIds.update((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }
}
