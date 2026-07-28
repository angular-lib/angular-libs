import { InjectionToken, type Signal } from '@angular/core';
import type { ResolvedColumn } from '../data-grid/data-grid.types';

/**
 * Host surface injected into sidebar panel components (plugins package).
 * Provided by the core sidebar shell via a per-panel injector.
 */
export interface DataGridSidebarHost {
  readonly columns: Signal<readonly ResolvedColumn<unknown>[]>;
  readonly filterableColumns: Signal<readonly ResolvedColumn<unknown>[]>;
  readonly hiddenColumnIds: Signal<readonly string[]>;
  readonly filters: Signal<Record<string, string>>;
  readonly quickFilter: Signal<string>;
  readonly groupColumnIds: Signal<readonly string[]>;
  /** Ordered column ids shown as filter cards in the filters tool panel. */
  readonly openFilterColumnIds: Signal<readonly string[]>;
  /** Expanded filter card ids in the filters tool panel. */
  readonly expandedFilterColumnIds: Signal<ReadonlySet<string>>;
  /** Localized chrome strings for panel titles/actions. */
  readonly locale: Signal<import('../../locale/default-locale').DataGridLocale>;

  setColumnVisible(columnId: string, visible: boolean): void;
  reorderColumns(fromIndex: number, toIndex: number): void;
  showAllColumns(): void;
  autoSizeColumns(): void;
  setFilter(columnId: string, value: string): void;
  setQuickFilter(value: string): void;
  clearFilters(): void;
  setGroupColumns(columnIds: readonly string[]): void;
  /** Unique values for a set-filter column (empty when not a set filter). */
  getSetFilterOptions(columnId: string): readonly string[];
  /** Add a filter card (and expand it). No-op if already open or not filterable. */
  addFilterColumn(columnId: string): void;
  /** Remove a filter card and clear that column's filter value. */
  removeFilterColumn(columnId: string): void;
  toggleFilterColumnExpanded(columnId: string): void;
}

export const DATA_GRID_SIDEBAR_HOST = new InjectionToken<DataGridSidebarHost>(
  'al.data-grid.SidebarHost',
);
