/**
 * createDataGridSession — runtime ownership root for `<al-data-grid>`.
 *
 * Owns: kernel, behavioral hosts, live row-model pipeline, DataGridApi.
 * Binder supplies Angular IO bridges (inputs/models/outputs) + DOM/injector.
 */

import {
  computed,
  type EnvironmentInjector,
  type Injector,
  type OutputEmitterRef,
  type Signal,
} from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { composeDataGridApiHost } from '../api/compose-host';
import { DataGridApi } from '../api/grid-api';
import type { DataGridEventMap } from '../api/grid-events';
import type { GridController } from '../create-grid';
import { GridKernel } from '../kernel/grid-kernel';
import { getCellValue } from '../utils/cell-value';
import { runGridRowModel } from '../utils/grid-row-model';
import type { DisplayRow } from '../utils/row-display';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { ColumnLayoutHost } from '../hosts/column-layout.host';
import { EditSyncHost } from '../hosts/edit-sync.host';
import { MenuHost } from '../hosts/menu.host';
import { SelectionHost } from '../hosts/selection.host';
import { ViewportHost } from '../hosts/viewport.host';
import type { HostWritable } from '../hosts/binder-surface';
import { notifyPlugins, type DataGridPlugin } from '../plugins/types';
import type { DataGridLocale } from '../locale/default-locale';
import {
  createPaintedOverlays,
  type PaintedOverlay,
} from './painted-overlays';
import type {
  CreateRowFormFn,
  DataGridContextMenuContext,
  DataGridContextMenuItems,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  EditMode,
  PasteEvent,
  RowEditSchema,
  RowClickEvent,
  RowEditContext,
  RowReorderEvent,
  SelectionMode,
  SortState,
} from '../components/data-grid/data-grid.types';
import type { FindMatch } from '../utils/find';
import type { ResolvedEditInteraction } from '../editing/edit-interaction';

export interface CreateSessionModels<T> {
  selectedIds: HostWritable<Array<string | number>>;
  quickFilter: HostWritable<string>;
  hiddenColumnIds: HostWritable<string[]>;
  findQuery: HostWritable<string>;
  rowForm: HostWritable<FieldTree<T> | null>;
  rowEditSession: HostWritable<RowEditContext<T> | null>;
  rowEditDraft: HostWritable<T | null>;
}

export interface CreateSessionOutputs<T> {
  sortChange: OutputEmitterRef<SortState[]>;
  filterChange: OutputEmitterRef<DataGridFilterState>;
  cellEdit: OutputEmitterRef<DataGridEventMap<T>['cellEdit']>;
  rowEdit: OutputEmitterRef<DataGridEventMap<T>['rowEdit']>;
  rowEditStart: OutputEmitterRef<DataGridEventMap<T>['rowEditStart']>;
  rowEditCancel: OutputEmitterRef<DataGridEventMap<T>['rowEditCancel']>;
  rowClick: OutputEmitterRef<RowClickEvent<T>>;
  selectionChange: OutputEmitterRef<Array<string | number>>;
  queryChange: OutputEmitterRef<DataGridQuery>;
  stateChange: OutputEmitterRef<DataGridState>;
  columnOrderChange: OutputEmitterRef<string[]>;
  contextMenuOpened: OutputEmitterRef<DataGridContextMenuContext<T>>;
  contextMenuClosed: OutputEmitterRef<void>;
  findMatchesChange: OutputEmitterRef<FindMatch[]>;
  rowReorder: OutputEmitterRef<RowReorderEvent<T>>;
  nearEnd: OutputEmitterRef<void>;
  paste: OutputEmitterRef<PasteEvent<T>>;
}

export interface CreateSessionOptions<T> {
  controller: () => GridController<T>;
  data: () => readonly T[];
  models: CreateSessionModels<T>;
  outputs: CreateSessionOutputs<T>;
  /** Fan-out helper: Angular output + api.events (api may be late-bound). */
  publish: <K extends keyof DataGridEventMap<T>>(
    name: K,
    outputRef: { emit(value: DataGridEventMap<T>[K]): void },
    payload: DataGridEventMap<T>[K],
  ) => void;
  hostElement: () => HTMLElement;
  injector: () => Injector;
  parentInjector: () => EnvironmentInjector;
  externalFilter: () => ((row: T) => boolean) | null;
  contextMenuItems: () => DataGridContextMenuItems<T> | null | undefined;
  contextMenuOverlayPresent: () => boolean;
  contextMenuTemplate: () => unknown;
  rowEditSchema: () => RowEditSchema<T> | null;
  createRowForm: () => CreateRowFormFn<T> | null;
  resolvedLocale: () => DataGridLocale;
  getLocale: () => DataGridLocale;
}

export interface GridSession<T> {
  readonly kernel: GridKernel<T>;
  readonly api: DataGridApi<T>;
  readonly columnLayout: ColumnLayoutHost<T>;
  readonly selection: SelectionHost<T>;
  readonly editSync: EditSyncHost<T>;
  readonly menu: MenuHost<T>;
  readonly viewport: ViewportHost<T>;
  readonly processedRows: Signal<T[]>;
  readonly displayRows: Signal<DisplayRow<T>[]>;
  /** @deprecated Prefer pagedDisplayRows on viewport — paste/reorder helpers. */
  readonly pageRows: Signal<T[]>;
  /** Capability + cell-range overlay paint layouts. */
  readonly paintedOverlays: Signal<PaintedOverlay[]>;
  emitPaste(event: PasteEvent<T>): void;
  getQuery(): DataGridQuery;
  emitState(): void;
  emitQueryIfServer(): void;
  destroy(): void;
}

/**
 * Build the runtime session: hosts with owned state + live row pipeline + kernel/api.
 */
export function createDataGridSession<T>(opts: CreateSessionOptions<T>): GridSession<T> {
  const ctrl = () => opts.controller();
  const models = opts.models;
  const out = opts.outputs;

  let api!: DataGridApi<T>;
  let kernel!: GridKernel<T>;
  let columnLayout!: ColumnLayoutHost<T>;
  let selection!: SelectionHost<T>;
  let editSync!: EditSyncHost<T>;
  let menu!: MenuHost<T>;
  let viewport!: ViewportHost<T>;

  const effectiveColumns = () => ctrl().columns;
  const effectiveRowId = (): ((row: T, index: number) => string | number) => ctrl().rowId;
  const effectiveSelectionMode = (): SelectionMode => ctrl().selection;
  const effectiveEditMode = (): EditMode => ctrl().editMode();
  const effectiveEditInteraction = (): ResolvedEditInteraction => ctrl().editInteraction;
  const effectiveRowClickSelects = (): boolean => ctrl().rowClickSelects;
  const effectivePlugins = (): readonly DataGridPlugin<T>[] => ctrl().plugins();
  const effectiveRowEditSchema = () => opts.rowEditSchema() ?? ctrl().rowEditSchema;
  const effectiveCreateRowForm = () => opts.createRowForm() ?? ctrl().createRowForm;

  const pagination = () => ctrl().viewport.pagination();
  const pageSize = () => ctrl().viewport.pageSize();
  const virtual = () => ctrl().viewport.virtual();
  const rowHeight = () => ctrl().viewport.rowHeight();
  const overscan = () => ctrl().viewport.overscan();
  const multiSort = () => ctrl().multiSort();
  const columnReorder = () => ctrl().chrome.columnReorder();
  const serverSide = () => ctrl().serverSide();
  const contextMenu = () => ctrl().chrome.contextMenu();

  const notify = (
    hook: 'onSelectionChange' | 'onSortChange' | 'onFilterChange' | 'onStateChange',
    payload: unknown,
  ): void => {
    notifyPlugins(effectivePlugins(), kernel.pluginContext(opts.hostElement()), hook, payload);
  };

  const getQuery = (): DataGridQuery => ({
    sorts: columnLayout.sorts(),
    filters: columnLayout.filters(),
    quickFilter: models.quickFilter(),
    pageIndex: viewport.pageIndex(),
    pageSize: pageSize(),
  });

  const emitState = (): void => {
    const state = columnLayout.getState();
    opts.publish('stateChange', out.stateChange, state);
    notify('onStateChange', state);
  };

  const emitQueryIfServer = (): void => {
    if (!serverSide()) {
      return;
    }
    opts.publish('queryChange', out.queryChange, getQuery());
  };

  const rowModelContext = () => ({
    columnsById: columnLayout.columnsById() as Map<string, ColumnDef<T>>,
    rowId: (row: T, index: number) => effectiveRowId()(row, index),
    collapsedGroupIds: viewport.collapsedGroupIds(),
  });

  const rowModel = computed(() =>
    runGridRowModel({
      data: opts.data(),
      filters: columnLayout.filters(),
      quickFilter: models.quickFilter(),
      externalFilter: opts.externalFilter(),
      sorts: columnLayout.sorts(),
      columnsById: columnLayout.columnsById(),
      visibleColumns: columnLayout.visibleColumns(),
      serverSide: serverSide(),
      capabilities: kernel.capabilities,
      rowModelContext: rowModelContext(),
    }),
  );

  const processedRows: Signal<T[]> = computed(() => rowModel().processedRows);

  const displayRows: Signal<DisplayRow<T>[]> = computed(() => {
    // Track adapter / capability signals so grouping reactively rebuilds.
    viewport.boundRowGroupAdapter()?.columns();
    viewport.boundRowGroupAdapter()?.collapsedIds();
    viewport.boundTreeDataAdapter()?.collapsedIds();
    kernel.capabilities.hasDisplayBuilder();
    return rowModel().displayRows;
  });

  const pageRows: Signal<T[]> = computed(() => {
    const rows = processedRows();
    if (!pagination() || kernel.capabilities.hasDisplayBuilder()) {
      return rows;
    }
    const size = pageSize();
    const start = viewport.pageIndex() * size;
    return rows.slice(start, start + size);
  });

  columnLayout = new ColumnLayoutHost<T>({
    effectiveColumns,
    quickFilter: models.quickFilter,
    hiddenColumnIds: models.hiddenColumnIds,
    multiSort,
    columnReorder,
    showSelection: () => selection.showSelection(),
    rowDragEnabled: () => viewport.rowDragEnabled(),
    fullRowEdit: () => effectiveEditMode() === 'fullRow',
    processedRows: () => processedRows(),
    data: () => opts.data(),
    hostElement: opts.hostElement,
    publishSort: (sorts) => opts.publish('sortChange', out.sortChange, sorts),
    publishFilter: (filters) => opts.publish('filterChange', out.filterChange, filters),
    publishColumnOrder: (order) =>
      opts.publish('columnOrderChange', out.columnOrderChange, order),
    getStateExtras: () => ({
      pageIndex: viewport.pageIndex(),
      activeSidePanel: viewport.activeSidePanel(),
    }),
    applyStateExtras: (extras) => {
      viewport.pageIndex.set(extras.pageIndex);
      viewport.activeSidePanel.set(extras.activeSidePanel);
    },
    notifyPlugins: notify,
    emitState,
    emitQueryIfServer,
  });

  viewport = new ViewportHost<T>({
    findQuery: models.findQuery,
    data: () => opts.data(),
    filters: () => columnLayout.filters(),
    quickFilter: () => models.quickFilter(),
    externalFilter: () => opts.externalFilter(),
    pagination,
    pageSize,
    virtual,
    rowHeight,
    overscan,
    serverSide,
    displayRows: () => displayRows(),
    processedRows: () => processedRows(),
    visibleColumns: () => columnLayout.visibleColumns(),
    hasActiveSort: () => columnLayout.sorts().length > 0,
    resolveRowId: (row, index) => effectiveRowId()(row, index),
    rowModelContext,
    hostElement: opts.hostElement,
    kernel: () => kernel,
    injector: opts.injector,
    sideBarConfig: () => kernel.sideBarConfig(),
    sidebarSlotItems: () => kernel.sidebarSlotItems(),
    emitState,
    emitQueryIfServer,
    publishNearEnd: () => opts.publish('nearEnd', out.nearEnd, undefined),
    publishFindMatches: (matches) =>
      opts.publish('findMatchesChange', out.findMatchesChange, matches),
    publishRowReorder: (payload) => opts.publish('rowReorder', out.rowReorder, payload),
  });

  selection = new SelectionHost<T>({
    selectedIds: models.selectedIds,
    selectionChange: out.selectionChange,
    rowClick: out.rowClick,
    effectiveSelectionMode,
    effectiveRowClickSelects,
    isRowSelectableFn: () => ctrl().isRowSelectable,
    data: () => opts.data(),
    effectiveRowId,
    processedRows: () => processedRows(),
    displayRows: () => displayRows(),
    visibleColumns: () => columnLayout.visibleColumns(),
    copyEnabled: () => kernel.copyEnabled(),
    pagedDisplayRows: () => viewport.pagedDisplayRows(),
    getQuery,
    publishSelectionChange: (next) =>
      opts.publish('selectionChange', out.selectionChange, next),
    publishRowClick: (payload) => opts.publish('rowClick', out.rowClick, payload),
    notifyPlugins: notify,
    effectivePlugins,
    pluginContext: () => kernel.pluginContext(opts.hostElement()),
  });

  editSync = new EditSyncHost<T>({
    rowForm: models.rowForm,
    rowEditSession: models.rowEditSession,
    rowEditDraft: models.rowEditDraft,
    cellEdit: out.cellEdit,
    rowEditStart: out.rowEditStart,
    rowEdit: out.rowEdit,
    rowEditCancel: out.rowEditCancel,
    effectiveEditMode,
    effectiveEditInteraction,
    effectiveRowEditSchema,
    effectiveCreateRowForm,
    columnsById: () => columnLayout.columnsById(),
    resolvedColumns: () => columnLayout.resolvedColumns(),
    pagedDisplayRows: () => viewport.pagedDisplayRows(),
    processedRows: () => processedRows(),
    effectiveRowId,
    cellValue: (row, column, rowIndex) => getCellValue(row, column, rowIndex),
    kernel: () => kernel,
    hostElement: opts.hostElement,
    injector: opts.injector,
    parentInjector: opts.parentInjector,
    publishCellEdit: (payload) => opts.publish('cellEdit', out.cellEdit, payload),
    publishRowEditStart: (payload) => opts.publish('rowEditStart', out.rowEditStart, payload),
    publishRowEdit: (payload) => opts.publish('rowEdit', out.rowEdit, payload),
    publishRowEditCancel: (payload) =>
      opts.publish('rowEditCancel', out.rowEditCancel, payload),
    syncDomFocusAfterEdit: () => editSync.syncDomFocus(kernel.focus.getFocus()),
  });

  menu = new MenuHost<T>({
    contextMenuOpened: out.contextMenuOpened,
    contextMenuClosed: out.contextMenuClosed,
    contextMenu,
    contextMenuItems: () => opts.contextMenuItems(),
    contextMenuOverlayPresent: () => opts.contextMenuOverlayPresent(),
    contextMenuTemplate: () => opts.contextMenuTemplate(),
    columnsById: () => columnLayout.columnsById(),
    sorts: () => columnLayout.sorts(),
    filters: () => columnLayout.filters(),
    quickFilter: () => models.quickFilter(),
    visibleColumns: () => columnLayout.visibleColumns(),
    selectedIds: () => models.selectedIds(),
    resolvedLocale: () => opts.resolvedLocale(),
    hostElement: opts.hostElement,
    kernel: () => kernel,
    isRowEditing: (rowId) => editSync.isRowEditing(rowId),
    rowForm: () => models.rowForm(),
    setColumnSort: (columnId, direction) => columnLayout.setColumnSort(columnId, direction),
    setColumnPinned: (columnId, pinned) => columnLayout.setColumnPinned(columnId, pinned),
    autoSizeColumns: (columnIds) => columnLayout.autoSizeColumns(columnIds),
    setColumnVisible: (columnId, visible) => columnLayout.setColumnVisible(columnId, visible),
    exportCsv: (filename) => columnLayout.exportCsv(filename),
    clearFilters: () => columnLayout.clearFilters(),
    publishContextMenuOpened: (ctx) =>
      opts.publish('contextMenuOpened', out.contextMenuOpened, ctx),
    publishContextMenuClosed: () =>
      opts.publish('contextMenuClosed', out.contextMenuClosed, undefined),
  });

  api = new DataGridApi<T>(
    composeDataGridApiHost({
      selection,
      columns: columnLayout,
      editing: editSync,
      viewport: {
        focusCell: (rowIndex, columnId) => viewport.focusCell(rowIndex, columnId),
        getFocusedCell: () => viewport.getFocusedCell(),
        getPagedDisplayRows: () => viewport.getPagedDisplayRows(),
        resolveRowId: (row, index) => viewport.resolveRowId(row, index),
        notifyNearEnd: () => viewport.notifyNearEnd(),
        openColumnMenu: (columnId) => menu.openColumnMenu(columnId),
        getCellElement: (rowId, columnId) => viewport.getCellElement(rowId, columnId),
        getScrollRoot: () => viewport.getScrollRoot(),
      },
      find: viewport,
      rowGroup: viewport,
      clipboard: {
        getSelectionClipboardText: () => selection.getSelectionClipboardText(),
        emitPaste: (event) => opts.publish('paste', out.paste, event),
      },
      locale: { getLocale: () => opts.getLocale() },
      sideBar: {
        openToolPanel: (panelId) => viewport.activeSidePanel.set(panelId),
        getOpenedToolPanel: () => viewport.activeSidePanel(),
      },
    }),
  );

  kernel = new GridKernel<T>(
    {
      api,
      getDisplayRowCount: () => viewport.pagedDisplayRows().length,
      getColumnIds: () => columnLayout.visibleColumns().map((c) => c.id),
      ensureRowVisible: (rowIndex) => viewport.ensureRowVisible(rowIndex),
      onFocusChange: (cell) => {
        viewport.focusedCell.set(cell);
        editSync.syncDomFocus(cell, { force: true });
      },
      onStartEdit: (cell, reason) =>
        editSync.startEditAtFocus(cell.rowIndex, cell.columnId, reason),
      onCancelEdit: () => editSync.cancelActiveEdit(),
      onToggleSelect: (rowIndex) => selection.toggleSelectionAtIndex(rowIndex),
      onSelectAll: () => {
        if (effectiveSelectionMode() !== 'multi') {
          return false;
        }
        selection.selectAllVisible();
        return true;
      },
      onToggleGroup: (rowIndex) => {
        const item = viewport.pagedDisplayRows()[rowIndex];
        if (item?.kind === 'group') {
          viewport.toggleGroup(item.id);
        }
      },
      isGroupRow: (rowIndex) => viewport.pagedDisplayRows()[rowIndex]?.kind === 'group',
      getPageRowCount: () =>
        Math.max(1, Math.floor(viewport.viewportHeight() / rowHeight()) || 10),
      onHeaderActivate: (columnId, multi) => columnLayout.activateHeaderSort(columnId, multi),
      onOpenColumnMenu: (columnId) => menu.openColumnMenu(columnId),
      hasFloatingFilters: () => ctrl().chrome.floatingFilters() && columnLayout.hasFilters(),
      onExtendRange: (dRow, dCol) => api.extendCellRange(dRow, dCol),
      onClearRange: () => api.clearCellRange(),
      getFindMatchCount: (): number => viewport.findMatches().length,
      getFindActiveIndex: (): number => viewport.findActiveIndex(),
      setFindActiveIndex: (index) => viewport.findActiveIndex.set(index),
      onFindNavigate: () => viewport.scrollToActiveFind(),
    },
    opts.injector(),
  );

  api.attachPluginLifecycle(kernel);

  const paintedOverlays = createPaintedOverlays({
    kernel: () => kernel,
    getCellRange: () => api.getCellRange(),
    visibleColumns: () => columnLayout.visibleColumns(),
    displayRows: () => viewport.pagedDisplayRows(),
    getCellElement: (rowId, columnId) => viewport.getCellElement(rowId, columnId),
    getScrollRoot: () => viewport.getScrollRoot(),
    hostElement: opts.hostElement,
  });

  return {
    kernel,
    api,
    columnLayout,
    selection,
    editSync,
    menu,
    viewport,
    processedRows,
    displayRows,
    pageRows,
    paintedOverlays,
    emitPaste: (event) => opts.publish('paste', out.paste, event),
    getQuery,
    emitState,
    emitQueryIfServer,
    destroy: () => {
      viewport.destroyRowDrag();
      editSync.destroyRowEditSession();
      kernel.destroy();
      api.events.clear();
    },
  };
}
