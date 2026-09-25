import type {
  ColumnDef,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  PasteEvent,
  SetGridStateOptions,
  SortState,
} from '../components/data-grid/data-grid.types';
import { computed, type Signal } from '@angular/core';
import { gridQueryEqual, gridStateEqual } from '../utils/state';
import type { CsvExportOptions } from '../utils/csv';
import type { ColumnFilterModel } from '../utils/filter-model';
import type { FindMatch } from '../utils/find';
import type { DisplayRow } from '../utils/row-display';
import type { FocusCell } from '../controllers/focus';
import type { AdapterKey } from '../plugins/adapter-registry';
import { GridEventBus } from './grid-events';

/** Selection + query read/write. */
export interface DataGridSelectionHost<T = unknown> {
  getSelectedIds(): Array<string | number>;
  setSelectedIds(ids: Array<string | number>): void;
  /**
   * Visible **data** rows after filter/sort (excludes group headers and
   * master-detail plugin shells). Status "N rows" still prefers
   * {@link getProcessedRows} (same count when there are no groups).
   */
  getDisplayedRowCount(): number;
  /**
   * Full display-list length (data + group + plugin rows), including open
   * detail shells. Use for paint/virtualization — not "how many records".
   */
  getDisplayRowCount(): number;
  getProcessedRows(): readonly T[];
  /** Bound source rows (`[data]`), including filtered-out. */
  getSourceRows(): readonly T[];
  getQuery(): DataGridQuery;
}

/** Column layout / filter / sort / state persistence. */
export interface DataGridColumnsHost {
  exportCsv(filenameOrOptions?: string | CsvExportOptions<any>): string;
  autoSizeColumns(columnIds?: string[]): void;
  clearFilters(): void;
  getState(): DataGridState;
  setState(state: Partial<DataGridState>, options?: SetGridStateOptions): void;
  getFilterModel(): DataGridFilterState;
  setFilterModel(filters: DataGridFilterState): void;
  getColumnFilter(columnId: string): ColumnFilterModel | null;
  setColumnFilter(columnId: string, model: ColumnFilterModel | null): void;
  getSortModel(): SortState[];
  setSortModel(sorts: SortState[]): void;
  getQuickFilter(): string;
  setQuickFilter(value: string): void;
  setColumnPinned?(columnId: string, pinned: import('../components/data-grid/data-grid.types').ColumnPin | null): void;
  getColumnPinned?(columnId: string): import('../components/data-grid/data-grid.types').ColumnPin | null;
  /** Show/hide a column (`hiddenColumnIds`). */
  setColumnVisible?(columnId: string, visible: boolean): void;
  getColumnsById?(): Map<string, ColumnDef<any>>;
  getVisibleColumnIds?(): string[];
}

/** Cell / full-row editing. */
export interface DataGridEditingHost {
  startRowEditById?(rowId: string | number): void;
  startEditingCell?(rowId: string | number, columnId: string): void;
  stopEditing?(cancel?: boolean): void;
}

/** Focus / viewport / display rows. */
export interface DataGridViewportHost<T = unknown> {
  focusCell?(rowIndex: number, columnId: string): void;
  /** Focus a body cell by data `rowId` on the current page/window. */
  focusRow?(rowId: string | number, columnId: string): boolean;
  getFocusedCell?(): FocusCell | null;
  getPagedDisplayRows?(): readonly DisplayRow<T>[];
  resolveRowId?(row: T, index: number): string | number;
  notifyNearEnd?(): void;
  openColumnMenu?(columnId: string): void;
  /** Stable cell DOM lookup (body cells with `data-row-id` / `data-column-id`). */
  getCellElement?(rowId: string | number, columnId: string): HTMLElement | null;
  /** Scroll viewport root (`.al-data-grid__scroll`). */
  getScrollRoot?(): HTMLElement | null;
}

/** Find chrome. */
export interface DataGridFindHost {
  findNext(): void;
  findPrev(): void;
  getFindMatches(): readonly FindMatch[];
  focusFindInput?(): void;
}

/** Group / tree expansion (routed to the grid's single expansion store). */
export interface DataGridRowGroupHost {
  expandAll?(): void;
  collapseAll?(): void;
  toggleGroup?(groupId: string): void;
}

/** Plugin adapter discovery (see `adapterKey`). */
export interface DataGridAdaptersHost {
  getAdapter?<A>(key: AdapterKey<A>): A | null;
}

/** Clipboard / paste events. */
export interface DataGridClipboardHost<T = unknown> {
  getSelectionClipboardText?(): string | null;
  emitPaste?(event: PasteEvent<T>): void;
}

/** Locale for plugins / chrome. */
export interface DataGridLocaleApiHost {
  getLocale(): import('../locale/default-locale').DataGridLocale;
}

/** Tool-panel chrome (sidebar open/collapse). */
export interface DataGridSideBarApiHost {
  /** Open a registered panel by id, or pass `null` to collapse. */
  openToolPanel?(panelId: string | null): void;
  getOpenedToolPanel?(): string | null;
}

/**
 * Combined host surface the API façade calls into.
 * Prefer depending on a focused host interface when extracting features.
 * Build with {@link composeDataGridApiHost} from `@angular-libs/data-grid/plugin`
 * (or `/internals`).
 */
export type DataGridApiHost<T = unknown> = DataGridSelectionHost<T> &
  DataGridColumnsHost &
  DataGridEditingHost &
  DataGridViewportHost<T> &
  DataGridFindHost &
  DataGridRowGroupHost &
  DataGridClipboardHost<T> &
  DataGridLocaleApiHost &
  DataGridSideBarApiHost &
  DataGridAdaptersHost;

/**
 * Imperative grid façade (AG-inspired, intentionally smaller).
 *
 * Feature ops live on held plugin adapters (`groups.setColumns`, `ranges.clearRange`);
 * discover them with {@link getAdapter} and a typed key from the plugin package.
 */
export class DataGridApi<T = unknown> {
  exportDataAsCsv = (filenameOrOptions?: string | CsvExportOptions<T>): string =>
    this.exportCsv(filenameOrOptions);

  /**
   * Typed event bus mirroring Angular `output()`s.
   * Tool panels / plugins: `api.events.on('cellClick', …)` or `onAny(…)`.
   * Host apps should still bind template outputs.
   */
  readonly events = new GridEventBus<T>();

  /**
   * Live grid state (structurally memoized — a new value only on real change).
   * `(stateChange)` / plugin `onStateChange` are derived from this signal.
   */
  readonly state: Signal<DataGridState> = computed(() => this.host.getState(), {
    equal: gridStateEqual,
  });

  /** Live sort / filter / quick-filter / page query; `(queryChange)` derives from it (server mode). */
  readonly query: Signal<DataGridQuery> = computed(() => this.host.getQuery(), {
    equal: gridQueryEqual,
  });

  constructor(private readonly host: DataGridApiHost<T>) {}

  /**
   * Held adapter a plugin of this grid registered under `key`, or `null`.
   * Reactive (signal-backed) — e.g. `api.getAdapter(ROW_GROUP_ADAPTER)?.setColumns([…])`.
   */
  getAdapter<A>(key: AdapterKey<A>): A | null {
    return this.host.getAdapter?.(key) ?? null;
  }

  /**
   * Download processed rows as CSV and return the text. Pass a filename or
   * {@link CsvExportOptions} (`columnKeys`, `onlySelected`, `columnSeparator`,
   * `processCell`, …). Defaults: locale list separator, CRLF, UTF-8 BOM,
   * formula-injection escaping.
   */
  exportCsv(filenameOrOptions?: string | CsvExportOptions<T>): string {
    return this.host.exportCsv(filenameOrOptions);
  }

  autoSizeColumns(columnIds?: string[]): void {
    this.host.autoSizeColumns(columnIds);
  }

  autoSizeAllColumns(): void {
    this.host.autoSizeColumns();
  }

  clearFilters(): void {
    this.host.clearFilters();
  }

  getState(): DataGridState {
    return this.host.getState();
  }

  /**
   * Apply a (partial, possibly untrusted) snapshot: absent / invalid fields and
   * `ignore`d keys are left as they are; unknown column ids are dropped. Fires
   * `sortChange` / `filterChange` / `selectionChange` for what actually changed.
   */
  setState(state: Partial<DataGridState>, options?: SetGridStateOptions): void {
    this.host.setState(state, options);
  }

  getFilterModel(): DataGridFilterState {
    return this.host.getFilterModel();
  }

  /** Replace all column filters (invalid / empty models are dropped). */
  setFilterModel(filters: DataGridFilterState): void {
    this.host.setFilterModel(filters);
  }

  /** One column's typed filter model, or `null`. */
  getColumnFilter(columnId: string): ColumnFilterModel | null {
    return this.host.getColumnFilter(columnId);
  }

  /**
   * Set one column's filter, e.g.
   * `{ kind: 'number', conditions: [{ op: 'greaterThan', value: 100 }] }`;
   * `null` clears it.
   */
  setColumnFilter(columnId: string, model: ColumnFilterModel | null): void {
    this.host.setColumnFilter(columnId, model);
  }

  getSortModel(): SortState[] {
    return this.host.getSortModel();
  }

  setSortModel(sorts: SortState[]): void {
    this.host.setSortModel(sorts);
  }

  getQuickFilter(): string {
    return this.host.getQuickFilter();
  }

  setQuickFilter(value: string): void {
    this.host.setQuickFilter(value);
  }

  /** Pin column to `'left'` / `'right'`, or pass `null` to unpin. */
  setColumnPinned(
    columnId: string,
    pinned: import('../components/data-grid/data-grid.types').ColumnPin | null,
  ): void {
    this.host.setColumnPinned?.(columnId, pinned);
  }

  getColumnPinned(
    columnId: string,
  ): import('../components/data-grid/data-grid.types').ColumnPin | null {
    return this.host.getColumnPinned?.(columnId) ?? null;
  }

  setColumnVisible(columnId: string, visible: boolean): void {
    this.host.setColumnVisible?.(columnId, visible);
  }

  getSelectedIds(): Array<string | number> {
    return this.host.getSelectedIds();
  }

  /**
   * Selected row data from the bound source rows (`[data]`).
   * Includes filtered-out selections; order follows the source array.
   */
  getSelectedRows(): T[] {
    const ids = new Set(this.getSelectedIds());
    if (!ids.size) {
      return [];
    }
    return this.host.getSourceRows().filter((row, index) =>
      ids.has(this.resolveRowId(row, index)),
    );
  }

  setSelectedIds(ids: Array<string | number>): void {
    this.host.setSelectedIds(ids);
  }

  /**
   * Select by row objects — IDs are resolved via the grid `rowId` function.
   * Pass `[]` to clear (same as {@link deselectAll}).
   */
  setSelectedRows(rows: readonly T[]): void {
    this.setSelectedIds(rows.map((row, index) => this.resolveRowId(row, index)));
  }

  deselectAll(): void {
    this.host.setSelectedIds([]);
  }

  getDisplayedRowCount(): number {
    return this.host.getDisplayedRowCount();
  }

  /** Data + group + plugin display rows (includes open detail shells). */
  getDisplayRowCount(): number {
    return this.host.getDisplayRowCount();
  }

  getProcessedRows(): readonly T[] {
    return this.host.getProcessedRows();
  }

  /** Bound source rows (`[data]`), including filtered-out. */
  getSourceRows(): readonly T[] {
    return this.host.getSourceRows();
  }

  getQuery(): DataGridQuery {
    return this.host.getQuery();
  }

  findNext(): void {
    this.host.findNext();
  }

  findPrev(): void {
    this.host.findPrev();
  }

  getFindMatches(): readonly FindMatch[] {
    return this.host.getFindMatches();
  }

  focusCell(rowIndex: number, columnId: string): void {
    this.host.focusCell?.(rowIndex, columnId);
  }

  /** Focus a body cell by data row id. Returns false when the row is not shown. */
  focusRow(rowId: string | number, columnId: string): boolean {
    return this.host.focusRow?.(rowId, columnId) ?? false;
  }

  /** Wave 4 lean column menu (pin / sort / autosize / hide). */
  openColumnMenu(columnId: string): void {
    this.host.openColumnMenu?.(columnId);
  }

  startEditingRow(rowId: string | number): void {
    this.host.startRowEditById?.(rowId);
  }

  /**
   * Start cell (or full-row) edit for `rowId` + `columnId`.
   * Full-row mode opens the row session; cell mode opens that column's editor.
   */
  startEditingCell(rowId: string | number, columnId: string): void {
    this.host.startEditingCell?.(rowId, columnId);
  }

  stopEditing(cancel = false): void {
    this.host.stopEditing?.(cancel);
  }

  notifyNearEnd(): void {
    this.host.notifyNearEnd?.();
  }

  /**
   * Expand every group / tree node. Routed to the grid's single expansion store
   * (the active row-group / tree adapter, else the grid fallback) — the same
   * dispatcher mouse and keyboard toggles use.
   */
  expandAll(): void {
    this.host.expandAll?.();
  }

  /** Collapse every group / tree node (including nested ids under collapsed parents). */
  collapseAll(): void {
    this.host.collapseAll?.();
  }

  /** Toggle one group id / tree node id (`GroupDisplayRow.id` / `DataDisplayRow.groupId`). */
  toggleGroup(groupId: string): void {
    this.host.toggleGroup?.(groupId);
  }

  /** Copy text: the active cell range when a range source is registered, else selected rows. */
  getSelectionClipboardText(): string | null {
    return this.host.getSelectionClipboardText?.() ?? null;
  }

  focusFindInput(): void {
    this.host.focusFindInput?.();
  }

  getFocusedCell(): FocusCell | null {
    return this.host.getFocusedCell?.() ?? null;
  }

  getPagedDisplayRows(): readonly DisplayRow<T>[] {
    return this.host.getPagedDisplayRows?.() ?? [];
  }

  getColumnsById(): Map<string, ColumnDef<any>> {
    return this.host.getColumnsById?.() ?? new Map();
  }

  getVisibleColumnIds(): string[] {
    return this.host.getVisibleColumnIds?.() ?? [];
  }

  getCellElement(rowId: string | number, columnId: string): HTMLElement | null {
    return this.host.getCellElement?.(rowId, columnId) ?? null;
  }

  getScrollRoot(): HTMLElement | null {
    return this.host.getScrollRoot?.() ?? null;
  }

  resolveRowId(row: T, index: number): string | number {
    return this.host.resolveRowId?.(row, index) ?? index;
  }

  emitPaste(event: PasteEvent<T>): void {
    this.host.emitPaste?.(event);
  }

  getLocale(): import('../locale/default-locale').DataGridLocale {
    return this.host.getLocale();
  }

  /** Open a registered tool panel by id, or pass `null` to collapse. */
  openToolPanel(panelId: string | null): void {
    this.host.openToolPanel?.(panelId);
  }

  /** Currently open tool panel id, or `null` when collapsed / sidebar off. */
  getOpenedToolPanel(): string | null {
    return this.host.getOpenedToolPanel?.() ?? null;
  }
}
