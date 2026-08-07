/**
 * Lean deps hosts need from the session / binder (models, flags, publish).
 * Prefer small per-host interfaces — do not grow a mega “binder context”.
 */

import type { Injector, OutputEmitterRef } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { DataGridEventMap } from '../api/grid-events';
import type { GridKernel } from '../kernel/grid-kernel';
import type { DataGridLocale } from '../locale/default-locale';
import type { ResolvedEditInteraction } from '../editing/edit-interaction';
import type { DataGridPlugin, DataGridPluginContext } from '../plugins/types';
import type { ColumnLayout } from '../utils/column-layout';
import type { DisplayRow } from '../utils/row-display';
import type { FindMatch } from '../utils/find';
import type {
  ColumnDef,
  ColumnOrGroupDef,
  ColumnPin,
  DataGridContextMenuContext,
  DataGridContextMenuItem,
  DataGridContextMenuItems,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  EditMode,
  ResolvedColumn,
  RowClickEvent,
  RowEditContext,
  RowReorderEvent,
  SelectionMode,
  SideBarConfig,
  SortState,
} from '../components/data-grid/data-grid.types';

/** Writable signal / model shape hosts mutate. */
export type HostWritable<T> = {
  (): T;
  set(value: T): void;
  update?(fn: (value: T) => T): void;
};

export interface BinderPublishSurface<T> {
  publish<K extends keyof DataGridEventMap<T>>(
    name: K,
    outputRef: { emit(value: DataGridEventMap<T>[K]): void },
    payload: DataGridEventMap<T>[K],
  ): void;
  notifyPlugins(
    hook: 'onSelectionChange' | 'onSortChange' | 'onFilterChange' | 'onStateChange',
    payload: unknown,
  ): void;
  emitState(): void;
  emitQueryIfServer(): void;
  pluginContext(): DataGridPluginContext<T>;
  effectivePlugins(): readonly DataGridPlugin<T>[];
}

/**
 * Lean deps for ColumnLayoutHost — host owns sorts/filters/layout/widths + computeds.
 */
export interface ColumnLayoutDeps<T> {
  effectiveColumns(): readonly ColumnOrGroupDef<T>[];
  quickFilter: HostWritable<string>;
  hiddenColumnIds: HostWritable<string[]>;
  multiSort(): boolean;
  columnReorder(): boolean;
  showSelection(): boolean;
  rowDragEnabled(): boolean;
  fullRowEdit(): boolean;
  processedRows(): readonly T[];
  data(): readonly T[];
  hostElement(): HTMLElement;
  publishSort(sorts: SortState[]): void;
  publishFilter(filters: DataGridFilterState): void;
  publishColumnOrder(order: string[]): void;
  getStateExtras(): Pick<DataGridState, 'pageIndex' | 'activeSidePanel'>;
  applyStateExtras(state: Pick<DataGridState, 'pageIndex' | 'activeSidePanel'>): void;
  notifyPlugins(
    hook: 'onSelectionChange' | 'onSortChange' | 'onFilterChange' | 'onStateChange',
    payload: unknown,
  ): void;
  emitState(): void;
  emitQueryIfServer(): void;
}

/** @deprecated Use ColumnLayoutDeps — host owns column state as of F1. */
export type ColumnLayoutSurface<T> = ColumnLayoutDeps<T>;

/** Lean deps for SelectionHost — host owns selection UI computeds. */
export interface SelectionDeps<T> {
  selectedIds: HostWritable<Array<string | number>>;
  selectionChange: OutputEmitterRef<Array<string | number>>;
  rowClick: OutputEmitterRef<RowClickEvent<T>>;
  effectiveSelectionMode(): SelectionMode;
  effectiveRowClickSelects(): boolean;
  isRowSelectableFn(): ((row: T, rowId: string | number) => boolean) | null | undefined;
  data(): readonly T[];
  effectiveRowId(): (row: T, index: number) => string | number;
  processedRows(): readonly T[];
  displayRows(): readonly DisplayRow<T>[];
  visibleColumns(): readonly ResolvedColumn<T>[];
  copyEnabled(): boolean;
  pagedDisplayRows(): readonly DisplayRow<T>[];
  getQuery(): DataGridQuery;
  publishSelectionChange(next: Array<string | number>): void;
  publishRowClick(payload: RowClickEvent<T>): void;
  notifyPlugins(
    hook: 'onSelectionChange' | 'onSortChange' | 'onFilterChange' | 'onStateChange',
    payload: unknown,
  ): void;
  effectivePlugins(): readonly DataGridPlugin<T>[];
  pluginContext(): DataGridPluginContext<T>;
}

/** @deprecated Use SelectionDeps. */
export type SelectionSurface<T> = SelectionDeps<T>;

/** Lean deps for EditSyncHost — host owns editingCell / editDraft / rowEditMgr. */
export interface EditSyncDeps<T> {
  rowForm: HostWritable<FieldTree<T> | null>;
  rowEditSession: HostWritable<RowEditContext<T> | null>;
  rowEditDraft: HostWritable<T | null>;
  cellEdit: OutputEmitterRef<DataGridEventMap<T>['cellEdit']>;
  rowEditStart: OutputEmitterRef<DataGridEventMap<T>['rowEditStart']>;
  rowEdit: OutputEmitterRef<DataGridEventMap<T>['rowEdit']>;
  rowEditCancel: OutputEmitterRef<DataGridEventMap<T>['rowEditCancel']>;
  effectiveEditMode(): EditMode;
  effectiveEditInteraction(): ResolvedEditInteraction;
  effectiveRowEditSchema(): import('../components/data-grid/data-grid.types').RowEditSchema<T> | null;
  effectiveCreateRowForm(): import('../components/data-grid/data-grid.types').CreateRowFormFn<T> | null;
  columnsById(): Map<string, ResolvedColumn<T>>;
  resolvedColumns(): readonly ResolvedColumn<T>[];
  pagedDisplayRows(): readonly DisplayRow<T>[];
  processedRows(): readonly T[];
  effectiveRowId(): (row: T, index: number) => string | number;
  cellValue(row: T, column: ColumnDef<T>, rowIndex: number): unknown;
  kernel(): GridKernel<T>;
  hostElement(): HTMLElement;
  injector(): Injector;
  parentInjector(): import('@angular/core').EnvironmentInjector;
  publishCellEdit(payload: DataGridEventMap<T>['cellEdit']): void;
  publishRowEditStart(payload: DataGridEventMap<T>['rowEditStart']): void;
  publishRowEdit(payload: DataGridEventMap<T>['rowEdit']): void;
  publishRowEditCancel(payload: DataGridEventMap<T>['rowEditCancel']): void;
  /** After edit start/stop — sync DOM focus to focused cell / editor. */
  syncDomFocusAfterEdit(): void;
}

/** @deprecated Use EditSyncDeps. */
export type EditSyncSurface<T> = EditSyncDeps<T>;

/** Lean deps for MenuHost — host owns contextMenuState / columnMenuColumnId. */
export interface MenuDeps<T> {
  contextMenuOpened: OutputEmitterRef<DataGridContextMenuContext<T>>;
  contextMenuClosed: OutputEmitterRef<void>;
  contextMenu(): boolean;
  contextMenuItems(): DataGridContextMenuItems<T> | null | undefined;
  contextMenuOverlayPresent(): boolean;
  contextMenuTemplate(): unknown;
  columnsById(): Map<string, ResolvedColumn<T>>;
  sorts(): readonly SortState[];
  filters(): DataGridFilterState;
  quickFilter(): string;
  visibleColumns(): readonly ResolvedColumn<T>[];
  selectedIds(): Array<string | number>;
  resolvedLocale(): DataGridLocale;
  hostElement(): HTMLElement;
  kernel(): GridKernel<T>;
  isRowEditing(rowId: string | number): boolean;
  rowForm(): FieldTree<T> | null;
  setColumnSort(columnId: string, direction: 'asc' | 'desc' | null): void;
  setColumnPinned(columnId: string, pinned: ColumnPin | null): void;
  autoSizeColumns(columnIds?: string[]): void;
  setColumnVisible(columnId: string, visible: boolean): void;
  exportCsv(filename?: string): string;
  clearFilters(): void;
  publishContextMenuOpened(ctx: DataGridContextMenuContext<T>): void;
  publishContextMenuClosed(): void;
}

/** @deprecated Use MenuDeps. */
export type MenuSurface<T> = MenuDeps<T>;

/** Lean deps for ViewportHost — host owns scroll/page/find/window/collapse/drag. */
export interface ViewportDeps<T> {
  findQuery: HostWritable<string>;
  data(): readonly T[];
  filters(): DataGridFilterState;
  quickFilter(): string;
  externalFilter(): ((row: T) => boolean) | null;
  pagination(): boolean;
  pageSize(): number;
  virtual(): boolean;
  rowHeight(): number;
  overscan(): number;
  serverSide(): boolean;
  displayRows(): readonly DisplayRow<T>[];
  processedRows(): readonly T[];
  visibleColumns(): readonly ResolvedColumn<T>[];
  /** True when column sorts are active (row-drag gate). */
  hasActiveSort(): boolean;
  resolveRowId(row: T, index: number): string | number;
  rowModelContext(): {
    columnsById: Map<string, ColumnDef<T>>;
    rowId: (row: T, index: number) => string | number;
    collapsedGroupIds: ReadonlySet<string>;
  };
  hostElement(): HTMLElement;
  kernel(): GridKernel<T>;
  injector(): Injector;
  sideBarConfig(): boolean | SideBarConfig | null;
  sidebarSlotItems(): readonly { id: string }[];
  emitState(): void;
  emitQueryIfServer(): void;
  publishNearEnd(): void;
  publishFindMatches(matches: FindMatch[]): void;
  publishRowReorder(payload: RowReorderEvent<T>): void;
}

/** @deprecated Use ViewportDeps. */
export type ViewportSurface<T> = ViewportDeps<T>;

/** Re-export layout types hosts may need. */
export type { ColumnLayout };

/** Re-export menu item type used by MenuHost lean menus. */
export type { DataGridContextMenuItem };
