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
import { GridEventBus } from './grid-events';

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

/** Cell-range adapter bound by `cellRangePlugin` (OVERVIEW §5). */
export interface BoundCellRangeAdapter {
  getRange(): import('../components/data-grid/data-grid.types').CellRange | null;
  setRange(range: import('../components/data-grid/data-grid.types').CellRange | null): void;
  clearRange(): void;
  getClipboardText(): string | null;
  extendRange(dRow: number, dCol: number): boolean;
  /** When false, the range ring paints without a fill handle (default true). */
  fillHandleEnabled?: boolean;
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
  DataGridSideBarApiHost;

/**
 * Imperative grid façade (AG-inspired, intentionally smaller).
 *
 * Feature ops prefer held plugin adapters (`groups.setColumns`, `ranges.clearRange`).
 * API methods such as {@link setRowGroupColumns} / {@link clearCellRange} are thin
 * façades over those adapters (or host passthrough when unbound).
 */
export class DataGridApi<T = unknown> {
  exportDataAsCsv = (filename?: string): string => this.exportCsv(filename);

  /**
   * Typed event bus mirroring Angular `output()`s.
   * Tool panels / plugins: `api.events.on('cellClick', …)` or `onAny(…)`.
   * Host apps should still bind template outputs.
   */
  readonly events = new GridEventBus<T>();

  /** Bound by `rowGroupPlugin` during setup. */
  private rowGroupAdapter: BoundRowGroupAdapter | null = null;
  /** Bound by `treeDataPlugin` during setup. */
  private treeDataAdapter: BoundTreeDataAdapter | null = null;
  /** Bound by `cellRangePlugin` during setup. */
  private cellRangeAdapter: BoundCellRangeAdapter | null = null;
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
    // §5d — range wins copy when present.
    const fromRange = this.cellRangeAdapter?.getClipboardText();
    if (fromRange != null) {
      return fromRange;
    }
    return this.host.getSelectionClipboardText?.() ?? null;
  }

  getCellRange(): import('../components/data-grid/data-grid.types').CellRange | null {
    return this.cellRangeAdapter?.getRange() ?? null;
  }

  /** @internal — session overlay paint; false when `cellRangePlugin({ fillHandle: false })`. */
  isFillHandleEnabled(): boolean {
    return this.cellRangeAdapter?.fillHandleEnabled !== false;
  }

  clearCellRange(): void {
    this.cellRangeAdapter?.clearRange();
  }

  /** @internal — bound by `cellRangePlugin`. */
  extendCellRange(dRow: number, dCol: number): boolean {
    return this.cellRangeAdapter?.extendRange(dRow, dCol) ?? false;
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

  /** @internal — bound by `rowGroupPlugin` / host passthrough. */
  bindRowGroupAdapter(adapter: BoundRowGroupAdapter | null): void {
    this.rowGroupAdapter = adapter;
    this.host.bindRowGroupAdapter?.(adapter);
  }

  /** @internal — bound by `treeDataPlugin` / host passthrough. */
  bindTreeDataAdapter(adapter: BoundTreeDataAdapter | null): void {
    this.treeDataAdapter = adapter;
    this.host.bindTreeDataAdapter?.(adapter);
  }

  /** @internal — bound by `cellRangePlugin`. */
  bindCellRangeAdapter(adapter: BoundCellRangeAdapter | null): void {
    this.cellRangeAdapter = adapter;
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

  /**
   * Full plugin recomposition via the kernel. Prefer held-adapter toggles
   * (e.g. `sideBar.setEnabled`) for chrome; use this only when the list itself changes.
   * Also used when `setPlugins` / `api.recomposePlugins` runs after mount.
   */
  recomposePlugins(plugins: readonly DataGridPlugin<T>[]): void {
    this.pluginLifecycle?.recomposePlugins(plugins);
  }
}
