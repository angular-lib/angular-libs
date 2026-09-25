import { InjectionToken, type Signal } from '@angular/core';
import type { DataGridApi } from '../../api/grid-api';
import type { GridController } from '../../create-grid';
import type { DataGridFilterState, ResolvedColumn } from '../data-grid/data-grid.types';
import type { ColumnFilterModel } from '../../utils/filter-model';
import type { SetFilterOptions } from '../../utils/filter-rows';

/**
 * Host surface injected into sidebar panel components (plugins package).
 * Provided by the core sidebar shell via a per-panel injector.
 */
export interface DataGridSidebarHost {
  /** Imperative grid façade — subscribe via `api.events` (AG-style tool panels). */
  readonly api: DataGridApi<unknown>;
  /** Required `[controller]` from `createGrid` — row writes / schema. */
  readonly controller: GridController<unknown>;
  /**
   * Host `[context]` bag (same as toolbar `actionClick` context) —
   * app services / notifications / held plugins, never the grid controller.
   */
  readonly context: unknown;
  readonly columns: Signal<readonly ResolvedColumn<unknown>[]>;
  readonly filterableColumns: Signal<readonly ResolvedColumn<unknown>[]>;
  readonly hiddenColumnIds: Signal<readonly string[]>;
  readonly filters: Signal<DataGridFilterState>;
  readonly quickFilter: Signal<string>;
  /** `chrome.filterDebounceMs` — debounce for typed filter inputs in panels. */
  readonly filterDebounceMs: Signal<number>;
  /** Localized chrome strings for panel titles/actions. */
  readonly locale: Signal<import('../../locale/default-locale').DataGridLocale>;

  setColumnVisible(columnId: string, visible: boolean): void;
  reorderColumns(fromIndex: number, toIndex: number): void;
  showAllColumns(): void;
  autoSizeColumns(): void;
  /** Set / clear (`null`) one column's typed filter model. */
  setFilter(columnId: string, model: ColumnFilterModel | null): void;
  setQuickFilter(value: string): void;
  clearFilters(): void;
  /** Distinct values for a set-filter column (lazy + memoized; empty when not a set filter). */
  getSetFilterOptions(columnId: string): SetFilterOptions;
}

export const DATA_GRID_SIDEBAR_HOST = new InjectionToken<DataGridSidebarHost>(
  'al.data-grid.SidebarHost',
);
