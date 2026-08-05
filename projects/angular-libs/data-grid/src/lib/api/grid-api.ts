import type {
  ColumnDef,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  PasteEvent,
  SortState,
} from '../components/data-grid/data-grid.types';
import type { FindMatch } from '../utils/find';
import type { DisplayRow } from '../utils/row-display';
import type { FocusCell } from '../controllers/focus';
import type { DataGridPlugin } from '../plugins/types';

/** Kernel-owned plugin lifecycle — attached by DataGrid; not a host concern. */
export interface PluginLifecycle<T = unknown> {
  recomposePlugins(plugins: readonly DataGridPlugin<T>[]): void;
}

/** Minimal adapter surface the API binds from `rowGroupPlugin`. */
export interface BoundRowGroupAdapter {
  columns: () => readonly string[];
  active: () => boolean;
  setColumns(columns: readonly string[]): void;
  clear(): void;
  toggleCollapsed(groupId: string): void;
  expandAll(): void;
  collapseAll(allGroupIds: readonly string[]): void;
  collapsedIds: () => ReadonlySet<string>;
}

/** Collapse adapter bound by `treeDataPlugin`. */
export interface BoundTreeDataAdapter {
  active: () => boolean;
  toggleCollapsed(groupId: string): void;
  expandAll(): void;
  collapseAll(allGroupIds: readonly string[]): void;
  collapsedIds: () => ReadonlySet<string>;
  collectAllGroupIds(rows: readonly unknown[]): string[];
}

/** Selection + query read/write. */
export interface DataGridSelectionHost<T = unknown> {
  getSelectedIds(): Array<string | number>;
  setSelectedIds(ids: Array<string | number>): void;
  getDisplayedRowCount(): number;
  getProcessedRows(): readonly T[];
  /** Bound source rows (`[data]`), including filtered-out. */
  getSourceRows(): readonly T[];
  getQuery(): DataGridQuery;
}

/** Column layout / filter / sort / state persistence. */
export interface DataGridColumnsHost {
  exportCsv(filename?: string): string;
  autoSizeColumns(columnIds?: string[]): void;
  clearFilters(): void;
  getState(): DataGridState;
  setState(state: Partial<DataGridState>): void;
  getFilterModel(): DataGridFilterState;
  setFilterModel(filters: DataGridFilterState): void;
  getSortModel(): SortState[];
  setSortModel(sorts: SortState[]): void;
  getQuickFilter(): string;
  setQuickFilter(value: string): void;
  setColumnPinned?(columnId: string, pinned: import('../components/data-grid/data-grid.types').ColumnPin | null): void;
  getColumnPinned?(columnId: string): import('../components/data-grid/data-grid.types').ColumnPin | null;
  getColumnsById?(): Map<string, ColumnDef<any>>;
  getVisibleColumnIds?(): string[];
}

/** Cell / full-row editing. */
export interface DataGridEditingHost {
  startRowEditById?(rowId: string | number): void;
  stopEditing?(cancel?: boolean): void;
}

/** Focus / viewport / display rows. */
export interface DataGridViewportHost<T = unknown> {
  focusCell?(rowIndex: number, columnId: string): void;
  getFocusedCell?(): FocusCell | null;
  getPagedDisplayRows?(): readonly DisplayRow<T>[];
  resolveRowId?(row: T, index: number): string | number;
  notifyNearEnd?(): void;
  openColumnMenu?(columnId: string): void;
}

/** Find chrome. */
export interface DataGridFindHost {
  findNext(): void;
  findPrev(): void;
  getFindMatches(): readonly FindMatch[];
  focusFindInput?(): void;
}

/** Row-group adapter binding + collapse helpers. */
export interface DataGridRowGroupHost {
  expandAll?(): void;
  collapseAll?(): void;
  toggleGroup?(groupId: string): void;
  setRowGroupColumns?(columns: readonly string[]): void;
  getRowGroupColumns?(): string[];
  clearRowGroup?(): void;
  bindRowGroupAdapter?(adapter: BoundRowGroupAdapter | null): void;
  bindTreeDataAdapter?(adapter: BoundTreeDataAdapter | null): void;
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

/**
 * Combined host surface the API façade calls into.
 * Prefer depending on a focused host interface when extracting features.
 * Build with {@link composeDataGridApiHost} from `./compose-host`.
 */
export type DataGridApiHost<T = unknown> = DataGridSelectionHost<T> &
  DataGridColumnsHost &
  DataGridEditingHost &
  DataGridViewportHost<T> &
  DataGridFindHost &
  DataGridRowGroupHost &
  DataGridClipboardHost<T> &
  DataGridLocaleApiHost;

/**
 * Imperative grid façade (AG-inspired, intentionally smaller).
 */
export class DataGridApi<T = unknown> {
  exportDataAsCsv = (filename?: string): string => this.exportCsv(filename);

  /** Bound by `rowGroupPlugin` during setup. */
  private rowGroupAdapter: BoundRowGroupAdapter | null = null;
  /** Bound by `treeDataPlugin` during setup. */
  private treeDataAdapter: BoundTreeDataAdapter | null = null;
  private pluginLifecycle: PluginLifecycle<T> | null = null;

  constructor(private readonly host: DataGridApiHost<T>) {}

  /** Wired by DataGrid to the kernel — keeps recomposition off the host surface. */
  attachPluginLifecycle(lifecycle: PluginLifecycle<T>): void {
    this.pluginLifecycle = lifecycle;
  }

  exportCsv(filename?: string): string {
    return this.host.exportCsv(filename);
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

  setState(state: Partial<DataGridState>): void {
    this.host.setState(state);
  }

  getFilterModel(): DataGridFilterState {
    return this.host.getFilterModel();
  }

  setFilterModel(filters: DataGridFilterState): void {
    this.host.setFilterModel(filters);
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

  getProcessedRows(): readonly T[] {
    return this.host.getProcessedRows();
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

  /** Wave 2 stub — lean menu UI in Wave 4. */
  openColumnMenu(columnId: string): void {
    this.host.openColumnMenu?.(columnId);
  }

  startEditingRow(rowId: string | number): void {
    this.host.startRowEditById?.(rowId);
  }

  stopEditing(cancel = false): void {
    this.host.stopEditing?.(cancel);
  }

  notifyNearEnd(): void {
    this.host.notifyNearEnd?.();
  }

  expandAll(): void {
    if (this.rowGroupAdapter) {
      this.rowGroupAdapter.expandAll();
      return;
    }
    if (this.treeDataAdapter) {
      this.treeDataAdapter.expandAll();
      return;
    }
    this.host.expandAll?.();
  }

  collapseAll(): void {
    if (this.treeDataAdapter && !this.rowGroupAdapter) {
      const rows = this.host.getProcessedRows();
      this.treeDataAdapter.collapseAll(this.treeDataAdapter.collectAllGroupIds(rows));
      return;
    }
    this.host.collapseAll?.();
  }

  toggleGroup(groupId: string): void {
    if (this.rowGroupAdapter) {
      this.rowGroupAdapter.toggleCollapsed(groupId);
      return;
    }
    if (this.treeDataAdapter) {
      this.treeDataAdapter.toggleCollapsed(groupId);
      return;
    }
    this.host.toggleGroup?.(groupId);
  }

  setRowGroupColumns(columns: readonly string[]): void {
    if (this.rowGroupAdapter) {
      this.rowGroupAdapter.setColumns(columns);
      return;
    }
    this.host.setRowGroupColumns?.(columns);
  }

  getRowGroupColumns(): string[] {
    if (this.rowGroupAdapter) {
      return [...this.rowGroupAdapter.columns()];
    }
    return this.host.getRowGroupColumns?.() ?? [];
  }

  clearRowGroup(): void {
    if (this.rowGroupAdapter) {
      this.rowGroupAdapter.clear();
      return;
    }
    this.host.clearRowGroup?.();
  }

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

  resolveRowId(row: T, index: number): string | number {
    return this.host.resolveRowId?.(row, index) ?? index;
  }

  emitPaste(event: PasteEvent<T>): void {
    this.host.emitPaste?.(event);
  }

  bindRowGroupAdapter(adapter: BoundRowGroupAdapter | null): void {
    this.rowGroupAdapter = adapter;
    this.host.bindRowGroupAdapter?.(adapter);
  }

  bindTreeDataAdapter(adapter: BoundTreeDataAdapter | null): void {
    this.treeDataAdapter = adapter;
    this.host.bindTreeDataAdapter?.(adapter);
  }

  getLocale(): import('../locale/default-locale').DataGridLocale {
    return this.host.getLocale();
  }

  /**
   * Full plugin recomposition via the kernel. Prefer held-adapter toggles
   * (e.g. `sideBar.setEnabled`) for chrome; use this only when the list itself changes.
   * Also used when the `[plugins]` input identity changes after mount.
   */
  recomposePlugins(plugins: readonly DataGridPlugin<T>[]): void {
    this.pluginLifecycle?.recomposePlugins(plugins);
  }
}
