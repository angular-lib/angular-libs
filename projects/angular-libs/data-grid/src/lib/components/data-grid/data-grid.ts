import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  type Type,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { composeDataGridApiHost } from '../../api/compose-host';
import {
  DataGridApi,
  type BoundRowGroupAdapter,
  type BoundTreeDataAdapter,
  type DataGridApiHost,
} from '../../api/grid-api';
import { GridKernel } from '../../kernel/grid-kernel';
import type { GridController } from '../../create-grid';
import {
  computeVirtualWindow,
  type VirtualWindow,
} from '../../controllers/virtual-window';
import { focusRealmOf, type FocusCell } from '../../controllers/focus';
import {
  DataGridCellDirective,
  DataGridContextMenuDirective,
  DataGridEmptyDirective,
  DataGridHeaderDirective,
  DataGridLoadingDirective,
} from '../../data-grid-cell.directive';
import { AlTooltipDirective } from '../../tooltip/tooltip.directive';
import { DataGridSidebar } from '../chrome/data-grid-sidebar';
import { DataGridFilterField } from '../chrome/data-grid-filter-field';
import { DataGridToolbar } from '../chrome/data-grid-toolbar';
import { DataGridStatusBar } from '../chrome/data-grid-status-bar';
import {
  mergeGridLocale,
  toolbarLabelsFromLocale,
  type DataGridLocale,
} from '../../locale/default-locale';
import { RowEditSession } from '../../editing/row-edit-session';
import {
  type ResolvedEditInteraction,
} from '../../editing/edit-interaction';
import {
  CellEditorRegistry,
  defaultCellEditorRegistry,
  resolveCellEditor,
  type RowEditAdapter,
} from '../../editing/cell-editor-registry';
import {
  notifyPlugins,
  type DataGridPlugin,
  type DataGridPluginContext,
  type DataGridToolbarSlotItem,
} from '../../plugins/types';
import { estimateColumnWidth } from '../../utils/autosize';
import { coerceCellEditValue } from '../../utils/coerce-cell-value';
import {
  formatAggregateValue,
  isCustomEditorComponent,
  isCustomRendererComponent,
  isSelectEditor,
  resolveSelectValues,
} from '../../utils/editors';
import { runGridRowModel } from '../../utils/grid-row-model';
import {
  attachColumnResize,
  nextWidthOverride,
} from '../../utils/column-interactions';
import {
  emptyColumnLayout,
  materializeColumnLayout,
  moveColumn,
  reconcileColumnLayout,
  reconcileHiddenColumnIds,
  resolveColumnTracks,
  setColumnPin,
  CHROME_TRACK,
  type ColumnLayout,
} from '../../utils/column-layout';
import {
  attachRowReorder,
  buildRowReorderEvent,
  isRowDragAllowed,
  resolveRowDropDataIndex,
} from '../../utils/row-interactions';
import {
  isDataDisplayRow,
  isGroupDisplayRow,
  type DisplayRow,
} from '../../utils/row-display';
import {
  formatCellValue,
  getCellValue,
  isBooleanColumn,
  isDateColumn,
  resolveCellClass,
  resolveRowClass,
} from '../../utils/cell-value';
import {
  buildLeafGroupMap,
  buildVisibleGroupHeaderRow,
  hasColumnGroups as defsHaveColumnGroups,
  resolveColumnOrGroupDefs,
  sameColumnGroup,
} from '../../utils/column-groups';
import {
  defaultContextMenuItems,
  positionMenu,
  resolveContextMenuItems,
  writeClipboardText,
} from '../../utils/context-menu';
import { buildLeanColumnMenuItems } from '../../utils/column-menu';
import { downloadCsv, rowsToCsv } from '../../utils/csv';
import {
  collectFindMatches,
  splitFindHighlight,
  type FindMatch,
} from '../../utils/find';
import {
  collectSetFilterValues,
  toDateKey,
} from '../../utils/filter-rows';
import { formFieldForColumn } from '../../utils/row-edit';
import { nextSortDirection } from '../../utils/sort-rows';
import { createEmptyGridState } from '../../utils/state';
import type {
  CellClickEvent,
  CellEditEvent,
  CellEditorParams,
  CellRendererParams,
  ColumnDef,
  ColumnOrGroupDef,
  ColumnPin,
  CreateRowFormFn,
  DataGridContextMenuContext,
  DataGridContextMenuItem,
  DataGridContextMenuItems,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  EditMode,
  PasteEvent,
  ResolvedColumn,
  RowClassFn,
  RowClickEvent,
  RowEditContext,
  RowEditEvent,
  RowEditSchema,
  RowReorderEvent,
  SelectionMode,
  SideBarConfig,
  SortState,
} from './data-grid.types';

@Component({
  selector: 'al-data-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    NgComponentOutlet,
    DataGridSidebar,
    DataGridToolbar,
    DataGridStatusBar,
    DataGridFilterField,
    FormField,
    AlTooltipDirective,
  ],
  host: {
    class: 'al-data-grid',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '(keydown)': 'onGridKeydown($event)',
    '(focusin)': 'onGridFocusIn($event)',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'onEscapeKey($event)',
  },
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.css',
})
export class DataGrid<T = unknown> implements DataGridApiHost<T> {
  readonly data = input.required<readonly T[]>();
  /**
   * Override leaf/group columns from `[controller]`. Prefer setting columns on `createGrid`.
   */
  readonly columns = input<readonly ColumnOrGroupDef<T>[] | null>(null);
  /** Override `rowId` from `[controller]`. Prefer `createGrid({ rowId })`. */
  readonly rowId = input<((row: T, index: number) => string | number) | null>(null);
  /** Override selection mode from `[controller]`. Prefer `createGrid({ selection })`. */
  readonly selectionMode = input<SelectionMode | null>(null);
  /**
   * Required bootstrap from `createGrid()` — columns, plugins, selection, edit policy, optional rows.
   */
  readonly controller = input.required<GridController<T>>();
  readonly pagination = input(false);
  readonly pageSize = input(25);
  readonly virtual = input(true);
  readonly rowHeight = input(36);
  readonly overscan = input(8);
  readonly loading = input(false);
  readonly emptyMessage = input<string | null>(null);
  readonly stripe = input(true);
  readonly multiSort = input(true);
  /** Show floating filter row under headers. Default true when any column is filterable. */
  readonly floatingFilters = input(true);
  /** Show toolbar quick-filter. Default true. CSV/autosize are opt-in plugins. */
  readonly showToolbar = input(true);
  /**
   * Opaque host bag passed into toolbar `actionClick` params.
   * Host-only: services, permissions, notifications, held plugins — not the grid controller.
   */
  readonly context = input<unknown>(null);
  /**
   * Host-declared toolbar actions (merged with plugin `registerToolbar` items by `order`).
   * Each `actionClick` receives `{ api, controller, context, event }`.
   */
  readonly toolbarActions = input<readonly DataGridToolbarSlotItem[]>([]);
  /** Drag header to reorder columns. */
  readonly columnReorder = input(true);
  /** Skip client sort/filter; emit `queryChange` instead. */
  readonly serverSide = input(false);
  /** Host-owned row predicate applied after column filters. */
  readonly externalFilter = input<((row: T) => boolean) | null>(null);
  /** Enable context menu.
   * - `true` → built-in defaults (copy / csv / autosize / clear filters)
   * - provide `contextMenuItems` and/or `alGridContextMenu` template to customize
   */
  readonly contextMenu = input(false, { transform: booleanAttribute });
  /** Typed menu items or factory. Takes priority over defaults when set. */
  readonly contextMenuItems = input<DataGridContextMenuItems<T> | null>(null);
  /**
   * Editing mode.
   * - `cell` (default): double-click a cell
   * - `fullRow`: signal-forms FieldTree for the whole row (validation-aware)
   * Override `[controller].editMode` when set.
   */
  readonly editMode = input<EditMode | null>(null);
  /**
   * Signal Forms `FieldTree` for full-row editing — the powerful path.
   *
   * Bind your own persistent form so it stays available outside the grid:
   * ```ts
   * model = signal(emptyRow());
   * rowForm = form(this.model, schema);
   * // <al-data-grid [rowForm]="rowForm" [(rowEditSession)]="session" />
   * ```
   * The grid loads the editing row via `rowForm().value.set(clone)`.
   *
   * Or omit it and pass `rowEditSchema` / `createRowForm` — the grid creates a
   * session form and writes it into this model while editing.
   */
  readonly rowForm = model<FieldTree<T> | null>(null);
  /**
   * Active full-row edit session as a signal (`null` when idle).
   * Prefer this over `rowEditStart` when building reactive host UI from the form.
   */
  readonly rowEditSession = model<RowEditContext<T> | null>(null);
  /** Schema used only when the grid creates a session form (no host `rowForm` yet). */
  readonly rowEditSchema = input<RowEditSchema<T> | null>(null);
  /** Factory used only when the grid creates a session form. Overrides `rowEditSchema`. */
  readonly createRowForm = input<CreateRowFormFn<T> | null>(null);
  /** Row-level CSS class(es). */
  readonly rowClass = input<RowClassFn<T> | null>(null);
  /** Chrome string overrides (merged with defaults). */
  readonly locale = input<Partial<DataGridLocale> | null>(null);
  /**
   * Extensibility plugins (dialog/store-style factories).
   * @example `[plugins]="[findPlugin(), sideBarPlugin(), statusBarPlugin()]"`
   */
  readonly plugins = input<readonly DataGridPlugin<T>[]>([]);

  readonly selectedIds = model<Array<string | number>>([]);
  readonly quickFilter = model('');
  readonly hiddenColumnIds = model<string[]>([]);
  /** Find query (two-way). */
  readonly findQuery = model('');
  /** Live draft model while a full-row edit is active. */
  readonly rowEditDraft = model<T | null>(null);

  readonly sortChange = output<SortState[]>();
  readonly filterChange = output<DataGridFilterState>();
  readonly cellEdit = output<CellEditEvent<T>>();
  readonly rowEdit = output<RowEditEvent<T>>();
  readonly rowEditStart = output<RowEditContext<T>>();
  readonly rowEditCancel = output<{ rowId: string | number }>();
  readonly cellClick = output<CellClickEvent<T>>();
  readonly rowClick = output<RowClickEvent<T>>();
  readonly selectionChange = output<Array<string | number>>();
  readonly queryChange = output<DataGridQuery>();
  readonly stateChange = output<DataGridState>();
  readonly columnOrderChange = output<string[]>();
  readonly contextMenuOpened = output<DataGridContextMenuContext<T>>();
  readonly contextMenuClosed = output<void>();
  readonly findMatchesChange = output<FindMatch[]>();
  readonly rowReorder = output<RowReorderEvent<T>>();
  readonly paste = output<PasteEvent<T>>();
  /** Fired by `infiniteScrollPlugin` when the viewport nears the bottom. */
  readonly nearEnd = output<void>();
  /** Fires once with the imperative API (AG-style `api`). */
  readonly apiReady = output<DataGridApi<T>>();

  /** Imperative façade for hosts and plugins. */
  readonly api: DataGridApi<T>;

  private readonly selectionHost = {
    getSelectedIds: () => this.getSelectedIds(),
    setSelectedIds: (ids: Array<string | number>) => this.setSelectedIds(ids),
    getDisplayedRowCount: () => this.getDisplayedRowCount(),
    getProcessedRows: () => this.getProcessedRows(),
    getSourceRows: () => this.data(),
    getQuery: () => this.getQuery(),
  };

  private readonly columnsHost = {
    exportCsv: (filename?: string) => this.exportCsv(filename),
    autoSizeColumns: (columnIds?: string[]) => this.autoSizeColumns(columnIds),
    clearFilters: () => this.clearFilters(),
    getState: () => this.getState(),
    setState: (state: Partial<DataGridState>) => this.setState(state),
    getFilterModel: () => this.getFilterModel(),
    setFilterModel: (filters: DataGridFilterState) => this.setFilterModel(filters),
    getSortModel: () => this.getSortModel(),
    setSortModel: (sorts: SortState[]) => this.setSortModel(sorts),
    getQuickFilter: () => this.getQuickFilter(),
    setQuickFilter: (value: string) => this.setQuickFilter(value),
    setColumnPinned: (columnId: string, pinned: ColumnPin | null) =>
      this.setColumnPinned(columnId, pinned),
    getColumnPinned: (columnId: string) => this.getColumnPinned(columnId),
    setColumnVisible: (columnId: string, visible: boolean) =>
      this.setColumnVisible(columnId, visible),
    getColumnsById: () => this.getColumnsById(),
    getVisibleColumnIds: () => this.getVisibleColumnIds(),
  };

  private readonly editingHost = {
    startRowEditById: (rowId: string | number) => this.startRowEditById(rowId),
    stopEditing: (cancel?: boolean) => this.stopEditing(cancel),
  };

  private readonly viewportHost = {
    focusCell: (rowIndex: number, columnId: string) => this.focusCell(rowIndex, columnId),
    getFocusedCell: () => this.getFocusedCell(),
    getPagedDisplayRows: () => this.getPagedDisplayRows(),
    resolveRowId: (row: T, index: number) => this.resolveRowId(row, index),
    notifyNearEnd: () => this.notifyNearEnd(),
    openColumnMenu: (columnId: string) => this.openColumnMenu(columnId),
  };

  private readonly findHost = {
    findNext: () => this.findNext(),
    findPrev: () => this.findPrev(),
    getFindMatches: () => this.getFindMatches(),
    focusFindInput: () => this.focusFindInput(),
  };

  private readonly rowGroupHost = {
    expandAll: () => this.expandAll(),
    collapseAll: () => this.collapseAll(),
    toggleGroup: (groupId: string) => this.toggleGroup(groupId),
    setRowGroupColumns: (columns: readonly string[]) => this.setRowGroupColumns(columns),
    getRowGroupColumns: () => this.getRowGroupColumns(),
    clearRowGroup: () => this.clearRowGroup(),
    bindRowGroupAdapter: (adapter: BoundRowGroupAdapter | null) => this.bindRowGroupAdapter(adapter),
    bindTreeDataAdapter: (adapter: BoundTreeDataAdapter | null) => this.bindTreeDataAdapter(adapter),
  };

  private readonly clipboardHost = {
    getSelectionClipboardText: () => this.getSelectionClipboardText(),
    emitPaste: (event: PasteEvent<T>) => this.emitPaste(event),
  };

  private readonly localeHost = {
    getLocale: () => this.getLocale(),
  };

  private readonly cellTemplates = contentChildren(DataGridCellDirective);
  private readonly headerTemplates = contentChildren(DataGridHeaderDirective);
  private readonly loadingOverlay = contentChild(DataGridLoadingDirective);
  private readonly emptyOverlay = contentChild(DataGridEmptyDirective);
  private readonly contextMenuOverlay = contentChild(DataGridContextMenuDirective);

  readonly sorts = signal<SortState[]>([]);
  readonly filters = signal<DataGridFilterState>({});
  /** Order + explicit pins — single layout source of truth. */
  readonly columnLayout = signal<ColumnLayout>(emptyColumnLayout());
  readonly pageIndex = linkedSignal({
    source: () =>
      [this.data(), this.filters(), this.quickFilter(), this.pageSize(), this.externalFilter()] as const,
    computation: () => 0,
  });
  readonly scrollTop = signal(0);
  readonly viewportHeight = signal(480);
  readonly viewportWidth = signal(800);
  readonly widthOverrides = signal<Record<string, number>>({});
  readonly editDraft = signal('');
  readonly contextMenuState = signal<{
    left: number;
    top: number;
    /** Present for cell menus; omitted for header pin menu. */
    ctx: DataGridContextMenuContext<T> | null;
    /** `'header'` skips custom cell template and shows built-in pin items. */
    source: 'cell' | 'header';
    items: DataGridContextMenuItem<T>[];
  } | null>(null);
  readonly findActiveIndex = signal(0);
  readonly focusedCell = signal<FocusCell | null>(null);
  /**
   * Column id for the open lean column menu (Alt+↓ / `api.openColumnMenu`).
   * Cleared when the menu closes.
   */
  readonly columnMenuColumnId = signal<string | null>(null);
  /** Collapsed tree node ids (row-group collapse lives on the plugin adapter). */
  readonly collapsedGroupIds = signal<ReadonlySet<string>>(new Set());
  private readonly boundRowGroupAdapter = signal<BoundRowGroupAdapter | null>(null);
  readonly boundTreeDataAdapter = signal<BoundTreeDataAdapter | null>(null);

  private readonly editingCell = signal<{ rowId: string | number; columnId: string } | null>(null);
  private readonly rowEditMgr = new RowEditSession<T>({
    getHostForm: () => this.rowForm(),
    setHostForm: (tree) => this.rowForm.set(tree),
    getSchema: () => this.effectiveRowEditSchema(),
    getFactory: () => this.effectiveCreateRowForm(),
    resolveColumn: (key) =>
      this.columnsById().get(key) ?? this.resolvedColumns().find((c) => c.field === key),
    parentInjector: inject(EnvironmentInjector),
    onSession: (ctx) => this.rowEditSession.set(ctx),
    onDraft: (draft) => this.rowEditDraft.set(draft),
    onStart: (ctx) => this.rowEditStart.emit(ctx),
    onCommit: (event) => this.rowEdit.emit(event),
    onCancel: (payload) => this.rowEditCancel.emit(payload),
  });
  /** Imperative adapter for full-row edit (optional DX sugar). */
  readonly rowEditAdapter: RowEditAdapter<T> = this.rowEditMgr;
  private headerDragFrom: number | null = null;
  private knownColumnIds = new Set<string>();
  private pluginsMounted = false;
  private lastPluginKey = '';
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly parentInjector = inject(EnvironmentInjector);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly kernel!: GridKernel<T>;

  readonly toolbarSlotItems!: GridKernel<T>['toolbarSlotItems'];
  readonly statusBarSlotItems!: GridKernel<T>['statusBarSlotItems'];
  readonly sidebarSlotItems!: GridKernel<T>['sidebarSlotItems'];

  readonly resolvedLocale = computed(() => mergeGridLocale(this.locale()));

  readonly emptyMessageText = computed(
    () => this.emptyMessage() ?? this.resolvedLocale().emptyMessage,
  );

  /** Columns from binder override or `[controller]`. */
  readonly effectiveColumns = computed(
    (): readonly ColumnOrGroupDef<T>[] =>
      this.columns() ?? this.controller().columns,
  );

  readonly effectiveRowId = computed((): ((row: T, index: number) => string | number) => {
    return this.rowId() ?? this.controller().rowId;
  });

  readonly effectiveSelectionMode = computed(
    (): SelectionMode => this.selectionMode() ?? this.controller().selection,
  );

  readonly effectiveEditMode = computed(
    (): EditMode => this.editMode() ?? this.controller().editMode,
  );

  readonly effectiveEditInteraction = computed((): ResolvedEditInteraction => {
    return this.controller().editInteraction;
  });

  readonly effectiveRowClickSelects = computed(
    (): boolean => this.controller().rowClickSelects,
  );

  readonly effectiveRowEditSchema = computed(
    () => this.rowEditSchema() ?? this.controller().rowEditSchema,
  );

  readonly effectiveCreateRowForm = computed(
    () => this.createRowForm() ?? this.controller().createRowForm,
  );

  /** Prefer explicit `[plugins]` when non-empty; else controller plugins. */
  readonly effectivePlugins = computed((): readonly DataGridPlugin<T>[] => {
    const fromInput = this.plugins();
    if (fromInput.length) {
      return fromInput;
    }
    return this.controller().plugins();
  });

  readonly resolvedColumns = computed(() => resolveColumnOrGroupDefs(this.effectiveColumns()));

  readonly leafGroupMap = computed(() => buildLeafGroupMap(this.effectiveColumns()));

  readonly hasColumnGroups = computed(() => defsHaveColumnGroups(this.effectiveColumns()));

  /** Group header cells aligned to current visible leaf order. */
  readonly groupHeaderRow = computed(() => {
    if (!this.hasColumnGroups()) {
      return [];
    }
    return buildVisibleGroupHeaderRow(this.visibleColumns(), this.leafGroupMap());
  });

  readonly orderedColumns = computed(() =>
    materializeColumnLayout(this.resolvedColumns(), this.columnLayout()),
  );

  readonly columnsById = computed(() => {
    const map = new Map<string, ResolvedColumn<T>>();
    for (const col of this.resolvedColumns()) {
      map.set(col.id, col);
    }
    return map;
  });

  readonly visibleColumns = computed(() => {
    const hidden = new Set(this.hiddenColumnIds());
    return this.orderedColumns().filter((c) => !hidden.has(c.id));
  });

  readonly filterableColumns = computed(() =>
    this.orderedColumns().filter((c) => !!c.filter),
  );

  /** Set-filter option lists for sidebar / shared filter field (keyed by column id). */
  readonly setFilterOptionsById = computed(() => {
    const map = new Map<string, string[]>();
    const rows = this.data();
    for (const col of this.filterableColumns()) {
      if (col.filter === 'set') {
        map.set(col.id, collectSetFilterValues(rows, col));
      }
    }
    return map;
  });

  readonly showSelection = computed(() => this.effectiveSelectionMode() !== 'none');
  readonly hasFilters = computed(() => this.resolvedColumns().some((c) => !!c.filter));
  readonly showQuickFilterBar = computed(() => this.showToolbar());
  /** Host `[toolbarActions]` + plugin slot items, sorted by `order`. */
  readonly resolvedToolbarActions = computed((): readonly DataGridToolbarSlotItem[] => {
    const byId = new Map<string, DataGridToolbarSlotItem>();
    for (const item of this.toolbarSlotItems()) {
      byId.set(item.id, item);
    }
    for (const item of this.toolbarActions()) {
      byId.set(item.id, item);
    }
    return [...byId.values()].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    );
  });

  readonly findMatches = computed((): FindMatch[] => {
    if (!this.findEnabled() || !this.findQuery().trim()) {
      return [];
    }
    return collectFindMatches(this.processedRows(), this.visibleColumns(), this.findQuery(), {
      caseSensitive: this.findCaseSensitiveEffective(),
      rowId: (row, index) => this.resolveRowId(row, index),
    });
  });

  readonly findMatchKeys = computed(() => {
    const set = new Set<string>();
    for (const m of this.findMatches()) {
      set.add(`${m.rowId}::${m.columnId}`);
    }
    return set;
  });

  readonly activeFindMatch = computed((): FindMatch | null => {
    const matches = this.findMatches();
    if (!matches.length) {
      return null;
    }
    const idx = ((this.findActiveIndex() % matches.length) + matches.length) % matches.length;
    return matches[idx] ?? null;
  });

  readonly findEnabled = computed((): boolean => !!this.kernel.findConfig());
  readonly findCaseSensitiveEffective = computed(
    (): boolean => !!this.kernel.findConfig()?.caseSensitive,
  );
  readonly resolvedSideBarConfig = computed(
    (): boolean | SideBarConfig | null => this.kernel.sideBarConfig(),
  );
  /** Row drag only when the display model is flat (no active group/tree headers). */
  readonly rowDragEnabled = computed(() =>
    isRowDragAllowed({
      pluginEnabled: this.kernel.rowDragEnabled(),
      serverSide: this.serverSide(),
      hasActiveSort: this.sorts().length > 0,
      hasActiveFilter:
        !!this.quickFilter().trim() ||
        Object.values(this.filters()).some((v) => !!v?.trim()),
      displayIsFlat: !this.displayRows().some((row) => row.kind !== 'data'),
    }),
  );
  readonly pasteEnabled = computed(() => this.kernel.pasteEnabled());
  /** Copy via `clipboardPlugin` (`slots.enableCopy`). */
  readonly copyEnabled = computed(() => this.kernel.copyEnabled());
  readonly aggregateRowEnabled = computed(() => this.kernel.capabilities.hasAggregate());
  readonly rowGroupColumnIds = computed(() => this.boundRowGroupAdapter()?.columns() ?? []);
  readonly infiniteScrollEnabled = computed((): boolean =>
    this.kernel.capabilities.getInteractions().some((i) => i.id === 'infiniteScroll'),
  );

  readonly aggregateValues = computed((): Map<string, unknown> => {
    if (!this.aggregateRowEnabled()) {
      return new Map<string, unknown>();
    }
    return this.kernel.capabilities.collectAggregates(
      this.processedRows(),
      this.visibleColumns(),
    );
  });

  readonly sideBarEnabled = computed(() => !!this.resolvedSideBarConfig());
  readonly sideBarPosition = computed(() => {
    const cfg = this.resolvedSideBarConfig();
    return typeof cfg === 'object' && cfg?.position ? cfg.position : 'right';
  });

  /**
   * Open tool panel — derived from sidebar slots, user-overridable.
   * Must NOT be an effect writing signals (that freezes when slots toggle).
   */
  readonly activeSidePanel = linkedSignal({
    source: () => ({
      cfg: this.resolvedSideBarConfig(),
      panels: this.sidebarSlotItems(),
    }),
    computation: ({ cfg, panels }, previous): string | null => {
      if (!cfg) {
        return null;
      }
      if (typeof cfg === 'object' && cfg.collapsed) {
        return null;
      }
      const prev = previous?.value ?? null;
      if (prev && panels.some((p) => p.id === prev)) {
        return prev;
      }
      if (typeof cfg === 'object' && cfg.defaultPanel !== undefined) {
        const requested = cfg.defaultPanel;
        if (panels.some((p) => p.id === requested)) {
          return requested;
        }
      }
      return panels[0]?.id ?? null;
    },
  });

  private readonly rowModel = computed(() =>
    runGridRowModel({
      data: this.data(),
      filters: this.filters(),
      quickFilter: this.quickFilter(),
      externalFilter: this.externalFilter(),
      sorts: this.sorts(),
      columnsById: this.columnsById(),
      visibleColumns: this.visibleColumns(),
      serverSide: this.serverSide(),
      capabilities: this.kernel.capabilities,
      rowModelContext: this.rowModelContext(),
    }),
  );

  readonly processedRows = computed((): T[] => this.rowModel().processedRows);

  readonly displayRows = computed((): DisplayRow<T>[] => {
    // Track adapter / capability signals so grouping reactively rebuilds.
    this.boundRowGroupAdapter()?.columns();
    this.boundRowGroupAdapter()?.collapsedIds();
    this.boundTreeDataAdapter()?.collapsedIds();
    this.kernel.capabilities.hasDisplayBuilder();
    return this.rowModel().displayRows;
  });

  readonly totalPages = computed(() => {
    if (!this.pagination()) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.displayRows().length / this.pageSize()));
  });

  /** @deprecated Prefer `pagedDisplayRows` — kept for paste/reorder data helpers. */
  readonly pageRows = computed(() => {
    const rows = this.processedRows();
    if (!this.pagination() || this.kernel.capabilities.hasDisplayBuilder()) {
      return rows;
    }
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    return rows.slice(start, start + size);
  });

  readonly pagedDisplayRows = computed(() => {
    const rows = this.displayRows();
    if (!this.pagination()) {
      return rows;
    }
    const size = this.pageSize();
    const start = this.pageIndex() * size;
    return rows.slice(start, start + size);
  });

  readonly virtualEnabled = computed(() => this.virtual() && !this.pagination());

  readonly virtualWindow = computed((): VirtualWindow =>
    computeVirtualWindow({
      rowCount: this.pagedDisplayRows().length,
      rowHeight: this.rowHeight(),
      scrollTop: this.scrollTop(),
      viewportHeight: this.viewportHeight(),
      overscan: this.overscan(),
      enabled: this.virtualEnabled(),
    }),
  );

  readonly renderedStart = computed(() => this.virtualWindow().start);
  readonly renderedRows = computed(() => {
    const window = this.virtualWindow();
    return this.pagedDisplayRows().slice(window.start, window.end);
  });
  readonly colSpan = computed(
    () =>
      this.visibleColumns().length +
      (this.showSelection() ? 1 : 0) +
      (this.rowDragEnabled() ? 1 : 0) +
      (this.effectiveEditMode() === 'fullRow' ? 1 : 0),
  );

  readonly reservedChromeWidth = computed(() => {
    let w = 0;
    if (this.showSelection()) {
      w += CHROME_TRACK.select;
    }
    if (this.rowDragEnabled()) {
      w += CHROME_TRACK.drag;
    }
    if (this.effectiveEditMode() === 'fullRow') {
      w += CHROME_TRACK.rowEdit;
    }
    return w;
  });

  /** CSS Grid track list — flex columns use `fr`, no viewport width measure. */
  readonly columnTrackLayout = computed(() =>
    resolveColumnTracks(this.visibleColumns(), this.widthOverrides(), {
      drag: this.rowDragEnabled(),
      select: this.showSelection(),
      rowEdit: this.effectiveEditMode() === 'fullRow',
    }),
  );

  readonly gridTemplateColumns = computed(() => this.columnTrackLayout().tracks);

  /** Pixel widths for pin offsets / resize; flex tracks are null → use minWidth. */
  readonly resolvedWidths = computed(() => {
    const { widthsPx } = this.columnTrackLayout();
    const out: Record<string, number> = {};
    for (const col of this.visibleColumns()) {
      out[col.id] = widthsPx[col.id] ?? col.minWidth;
    }
    return out;
  });

  readonly statusBarVisible = computed(() =>
    this.statusBarSlotItems().some((item) => {
      try {
        return !!item.text();
      } catch {
        return false;
      }
    }),
  );

  /** Avoid duplicating "N rows" when statusBarPlugin already registers it. */
  readonly showPaginationRowCount = computed(
    () => this.pagination() && !this.statusBarSlotItems().some((item) => item.id === 'rows'),
  );

  readonly toolbarLabels = computed(() => toolbarLabelsFromLocale(this.resolvedLocale()));

  readonly statusBarLabels = computed(() => {
    const l = this.resolvedLocale();
    return {
      statusRows: l.statusRows,
      paginationLabel: l.paginationLabel,
      paginationPrev: l.paginationPrev,
      paginationNext: l.paginationNext,
    };
  });

  readonly allVisibleSelected = computed(() => {
    const ids = this.visibleDataRowIds();
    if (!ids.length) {
      return false;
    }
    const selected = new Set(this.selectedIds());
    return ids.every((id) => selected.has(id));
  });

  readonly someVisibleSelected = computed(() => {
    const selected = new Set(this.selectedIds());
    return this.visibleDataRowIds().some((id) => selected.has(id));
  });

  private visibleDataRowIds(): Array<string | number> {
    const ids: Array<string | number> = [];
    for (const item of this.pagedDisplayRows()) {
      if (isDataDisplayRow(item)) {
        ids.push(item.rowId);
      }
    }
    return ids;
  }

  private readonly templateMap = computed(() => {
    const map = new Map<string, DataGridCellDirective<T>['template']>();
    for (const directive of this.cellTemplates()) {
      map.set(directive.alGridCell(), directive.template as DataGridCellDirective<T>['template']);
    }
    return map;
  });

  private readonly headerTemplateMap = computed(() => {
    const map = new Map<string, DataGridHeaderDirective<T>['template']>();
    for (const directive of this.headerTemplates()) {
      map.set(
        directive.alGridHeader(),
        directive.template as DataGridHeaderDirective<T>['template'],
      );
    }
    return map;
  });

  constructor() {
    this.api = new DataGridApi<T>(
      composeDataGridApiHost({
        selection: this.selectionHost,
        columns: this.columnsHost,
        editing: this.editingHost,
        viewport: this.viewportHost,
        find: this.findHost,
        rowGroup: this.rowGroupHost,
        clipboard: this.clipboardHost,
        locale: this.localeHost,
      }),
    );

    this.kernel = new GridKernel<T>(
      {
        api: this.api,
        getDisplayRowCount: () => this.pagedDisplayRows().length,
        getColumnIds: () => this.visibleColumns().map((c) => c.id),
        ensureRowVisible: (rowIndex) => this.ensureRowVisible(rowIndex),
        onFocusChange: (cell) => {
          this.focusedCell.set(cell);
          this.syncDomFocus(cell);
        },
        onStartEdit: (cell, reason) =>
          this.startEditAtFocus(cell.rowIndex, cell.columnId, reason),
        onCancelEdit: () => this.cancelActiveEdit(),
        onToggleSelect: (rowIndex) => this.toggleSelectionAtIndex(rowIndex),
        onSelectAll: () => {
          if (this.effectiveSelectionMode() !== 'multi') {
            return false;
          }
          this.selectAllVisible();
          return true;
        },
        onToggleGroup: (rowIndex) => {
          const item = this.pagedDisplayRows()[rowIndex];
          if (item?.kind === 'group') {
            this.toggleGroup(item.id);
          }
        },
        isGroupRow: (rowIndex) => this.pagedDisplayRows()[rowIndex]?.kind === 'group',
        getPageRowCount: () =>
          Math.max(1, Math.floor(this.viewportHeight() / this.rowHeight()) || 10),
        onHeaderActivate: (columnId, multi) => this.activateHeaderSort(columnId, multi),
        onOpenColumnMenu: (columnId) => this.openColumnMenu(columnId),
        hasFloatingFilters: () => this.floatingFilters() && this.hasFilters(),
        onExtendRange: (dRow, dCol) => this.api.extendCellRange(dRow, dCol),
        onClearRange: () => this.api.clearCellRange(),
        getFindMatchCount: (): number => this.findMatches().length,
        getFindActiveIndex: (): number => this.findActiveIndex(),
        setFindActiveIndex: (index) => this.findActiveIndex.set(index),
        onFindNavigate: () => this.scrollToActiveFind(),
      },
      this.injector,
    );
    this.toolbarSlotItems = this.kernel.toolbarSlotItems;
    this.statusBarSlotItems = this.kernel.statusBarSlotItems;
    this.sidebarSlotItems = this.kernel.sidebarSlotItems;

    this.api.attachPluginLifecycle(this.kernel);

    effect(() => {
      const cols = this.resolvedColumns();
      if (!cols.length) {
        return;
      }
      const ids = cols.map((c) => c.id);
      const layout = this.columnLayout();
      const nextLayout = reconcileColumnLayout(layout, cols);
      if (
        nextLayout.order.join('\0') !== layout.order.join('\0') ||
        JSON.stringify(nextLayout.pin) !== JSON.stringify(layout.pin)
      ) {
        this.columnLayout.set(nextLayout);
      }
      const newlyHidden = cols
        .filter((c) => c.hide && !this.knownColumnIds.has(c.id))
        .map((c) => c.id);
      const hidden = this.hiddenColumnIds();
      const nextHidden = reconcileHiddenColumnIds(hidden, ids, newlyHidden);
      if (nextHidden.join('\0') !== hidden.join('\0')) {
        this.hiddenColumnIds.set(nextHidden);
      }
      this.knownColumnIds = new Set(ids);
    });

    effect(() => {
      const max = this.totalPages() - 1;
      if (this.pageIndex() > max) {
        this.pageIndex.set(Math.max(0, max));
      }
    });

    // Keep find active index in range — emit from findMatchesChange only on query updates.
    effect(() => {
      const matches = this.findMatches();
      if (!matches.length) {
        if (this.findActiveIndex() !== 0) {
          this.findActiveIndex.set(0);
        }
        return;
      }
      if (this.findActiveIndex() >= matches.length) {
        this.findActiveIndex.set(0);
      }
    });

    afterNextRender(() => {
      this.measureViewport();
      this.observeViewportResize();
      // Imperative once — never reactivate from an effect (slot writes would loop).
      this.kernel.activatePlugins(this.effectivePlugins(), this.host.nativeElement);
      this.pluginsMounted = true;
      this.lastPluginKey = this.pluginListKey(this.effectivePlugins());
      this.apiReady.emit(this.api);
      this.controller().bindApi(this.api);
    });

    effect(() => {
      const list = this.effectivePlugins();
      const key = this.pluginListKey(list);
      untracked(() => {
        if (!this.pluginsMounted) {
          return;
        }
        if (key === this.lastPluginKey) {
          return;
        }
        this.lastPluginKey = key;
        this.api.recomposePlugins(list);
      });
    });

    this.destroyRef.onDestroy(() => {
      if (this.measureViewportRaf) {
        cancelAnimationFrame(this.measureViewportRaf);
        this.measureViewportRaf = 0;
      }
      this.viewportResizeObserver?.disconnect();
      this.controller().bindApi(null);
      this.teardownPlugins();
      this.destroyRowEditSession();
      this.rowDragCleanup?.();
      this.rowDragCleanup = null;
    });
  }

  private viewportResizeObserver: ResizeObserver | null = null;
  private measureViewportRaf = 0;

  private observeViewportResize(): void {
    const scroll = this.host.nativeElement.querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    if (!scroll || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = new ResizeObserver(() => this.scheduleMeasureViewport());
    this.viewportResizeObserver.observe(scroll);
  }

  private scheduleMeasureViewport(): void {
    if (this.measureViewportRaf) {
      return;
    }
    this.measureViewportRaf = requestAnimationFrame(() => {
      this.measureViewportRaf = 0;
      this.measureViewport();
    });
  }

  private pluginContext(): DataGridPluginContext<T> {
    return this.kernel.pluginContext(this.host.nativeElement);
  }

  private rowModelContext() {
    return {
      columnsById: this.columnsById() as Map<string, ColumnDef<T>>,
      rowId: (row: T, index: number) => this.resolveRowId(row, index),
      collapsedGroupIds: this.collapsedGroupIds(),
    };
  }

  private teardownPlugins(): void {
    this.kernel.destroy();
  }

  private measureViewport(): void {
    const scroll = this.host.nativeElement.querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    if (!scroll) {
      return;
    }
    const width = scroll.clientWidth || 800;
    const height = scroll.clientHeight || 480;
    // Avoid flex-width churn when the measured box is unchanged.
    if (this.viewportWidth() !== width) {
      this.viewportWidth.set(width);
    }
    if (this.viewportHeight() !== height) {
      this.viewportHeight.set(height);
    }
  }

  resolvedEmptyMessage(): string {
    return this.emptyMessageText();
  }

  i18n(): DataGridLocale {
    return this.resolvedLocale();
  }

  getLocale(): DataGridLocale {
    return this.resolvedLocale();
  }

  loadingTemplate() {
    return this.loadingOverlay()?.template ?? null;
  }

  emptyTemplate() {
    return this.emptyOverlay()?.template ?? null;
  }

  contextMenuTemplate() {
    return this.contextMenuOverlay()?.template ?? null;
  }

  contextMenuEnabled(): boolean {
    return (
      this.contextMenu() ||
      !!this.contextMenuItems() ||
      !!this.contextMenuOverlay() ||
      this.kernel.capabilities.hasContextMenuItems()
    );
  }

  resolveRowId(row: T, index: number): string | number {
    return this.effectiveRowId()(row, index);
  }

  trackRow(_viewIndex: number, item: DisplayRow<T>): string {
    return item.id;
  }

  cellValue(row: T, column: ColumnDef<T>, rowIndex: number): unknown {
    return getCellValue(row, column, rowIndex);
  }

  displayValue(value: unknown, row: T, column: ColumnDef<T>, rowIndex: number): string {
    return formatCellValue(value, row, column, rowIndex);
  }

  cellClass(row: T, column: ColumnDef<T>, rowIndex: number, value: unknown): string {
    const base = resolveCellClass(value, row, column, rowIndex);
    const decorated = this.kernel.capabilities.resolveCellDecoratorClasses({
      row,
      rowId: this.resolveRowId(row, rowIndex),
      rowIndex,
      columnId: column.id ?? column.field ?? '',
      column,
      value,
    });
    return [base, decorated].filter(Boolean).join(' ');
  }

  cellTemplate(columnId: string) {
    return this.templateMap().get(columnId) ?? null;
  }

  headerTemplate(columnId: string) {
    return this.headerTemplateMap().get(columnId) ?? null;
  }

  isBooleanColumn = isBooleanColumn;
  isDateColumn = isDateColumn;
  isSelectEditor = isSelectEditor;

  /** Per-instance editor registry (inherits app-wide default resolvers). */
  readonly editorRegistry = new CellEditorRegistry(defaultCellEditorRegistry);

  resolveCellEditor = (column: ColumnDef<T>) =>
    resolveCellEditor(column, this.editorRegistry);

  /** Plugin-registered view for a display-row kind (beyond built-in group/data). */
  displayViewFor(kind: string) {
    return this.kernel.capabilities.getDisplayView(kind);
  }

  customRendererType(column: ColumnDef<T>): Type<unknown> | null {
    return isCustomRendererComponent(column) ? (column.cellRenderer ?? null) : null;
  }

  customEditorType(column: ColumnDef<T>): Type<unknown> | null {
    const resolved = resolveCellEditor(column, this.editorRegistry);
    return resolved.kind === 'custom' ? resolved.component : null;
  }

  selectValues(column: ColumnDef<T>, row: T): string[] {
    return resolveSelectValues(column, row);
  }

  cellRendererParams(
    row: T,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
  ): CellRendererParams<T> {
    return {
      value,
      row,
      rowIndex,
      column,
      columnId: column.id,
    };
  }

  cellEditorParams(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
  ): CellEditorParams<T> {
    return {
      ...this.cellRendererParams(row, rowIndex, column, value),
      draft: this.editDraft(),
      setDraft: (next) => this.editDraft.set(next),
      commit: () => this.commitEdit(row, rowId, rowIndex, column),
      cancel: () => this.cancelEdit(),
    };
  }

  formatAgg(value: unknown, column?: ResolvedColumn<T> | null): string {
    return formatAggregateValue(value, column);
  }

  aggValue(columnId: string): unknown {
    return this.aggregateValues().get(columnId);
  }

  columnWidth(column: ResolvedColumn<T>): number | null {
    return this.resolvedWidths()[column.id] ?? column.width ?? column.minWidth;
  }

  rowClasses(row: T, rowIndex: number): string {
    return resolveRowClass(row, rowIndex, this.rowClass());
  }

  isCellFocused(rowIndex: number, columnId: string): boolean {
    const focus = this.focusedCell();
    return (
      !!focus &&
      focusRealmOf(focus) === 'body' &&
      focus.rowIndex === rowIndex &&
      focus.columnId === columnId
    );
  }

  isHeaderFocused(columnId: string): boolean {
    const focus = this.focusedCell();
    return !!focus && focusRealmOf(focus) === 'header' && focus.columnId === columnId;
  }

  isFloatingFilterFocused(columnId: string): boolean {
    const focus = this.focusedCell();
    return !!focus && focusRealmOf(focus) === 'floatingFilter' && focus.columnId === columnId;
  }

  /** Lean column menu — pin / sort / autosize / hide (Wave 4). */
  openColumnMenu(columnId: string): void {
    const column = this.columnsById().get(columnId);
    if (!column) {
      return;
    }
    this.columnMenuColumnId.set(columnId);
    const items = this.leanColumnMenuItems(column);
    const escape =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape
        : (s: string) => s.replace(/"/g, '\\"');
    const th = this.host.nativeElement.querySelector(
      `[data-testid="al-dg-col-${escape(columnId)}"]`,
    ) as HTMLElement | null;
    const rect = th?.getBoundingClientRect();
    const pos = positionMenu(
      rect?.left ?? 8,
      (rect?.bottom ?? 8) + 4,
      220,
      8 + items.length * 36,
    );
    this.contextMenuState.set({
      left: pos.left,
      top: pos.top,
      ctx: null,
      source: 'header',
      items,
    });
  }

  closeColumnMenu(): void {
    this.columnMenuColumnId.set(null);
    if (this.contextMenuState()?.source === 'header') {
      this.contextMenuState.set(null);
    }
  }

  private leanColumnMenuItems(column: ResolvedColumn<T>): DataGridContextMenuItem<T>[] {
    const locale = this.resolvedLocale();
    const pinned = column.pinned === 'left' || column.pinned === 'right' ? column.pinned : null;
    const sortDirection =
      this.sorts().find((s) => s.columnId === column.id)?.direction ?? null;
    return buildLeanColumnMenuItems({
      locale,
      pinned,
      sortable: !!column.sortable,
      sortDirection,
      canHide: this.visibleColumns().length > 1,
      sortAsc: () => this.setColumnSort(column.id, 'asc'),
      sortDesc: () => this.setColumnSort(column.id, 'desc'),
      clearSort: () => this.setColumnSort(column.id, null),
      pinLeft: () => this.setColumnPinned(column.id, 'left'),
      pinRight: () => this.setColumnPinned(column.id, 'right'),
      unpin: () => this.setColumnPinned(column.id, null),
      autosize: () => this.autoSizeColumns([column.id]),
      hide: () => this.setColumnVisible(column.id, false),
    });
  }

  /** Set / clear a single-column sort (lean menu). */
  setColumnSort(columnId: string, direction: 'asc' | 'desc' | null): void {
    const column = this.columnsById().get(columnId);
    if (!column?.sortable) {
      return;
    }
    const sorts: SortState[] = direction
      ? [{ columnId: column.id, direction }]
      : this.sorts().filter((s) => s.columnId !== column.id);
    this.sorts.set(sorts);
    this.sortChange.emit(sorts);
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSortChange', sorts);
  }

  focusHeaderColumn(columnId: string): void {
    this.kernel.focus.focusCell(0, columnId, 'header');
  }

  focusFloatingFilterColumn(columnId: string): void {
    this.kernel.focus.focusCell(0, columnId, 'floatingFilter');
  }

  /** Header + body row count for `aria-rowcount` (1 leaf header row + optional filter + data). */
  ariaRowCount(): number {
    const headerRows = 1 + (this.hasColumnGroups() ? 1 : 0) + (this.floatingFilters() && this.hasFilters() ? 1 : 0);
    return headerRows + this.displayRows().length;
  }

  /** 1-based column index including optional drag/select leading columns. */
  ariaColIndex(visibleColIndex: number): number {
    let offset = 1;
    if (this.rowDragEnabled()) {
      offset += 1;
    }
    if (this.showSelection()) {
      offset += 1;
    }
    return offset + visibleColIndex;
  }

  /** 1-based `aria-rowindex` for body rows (accounts for header rows). */
  ariaBodyRowIndex(displayIndex: number): number {
    const headerRows = 1 + (this.hasColumnGroups() ? 1 : 0) + (this.floatingFilters() && this.hasFilters() ? 1 : 0);
    return headerRows + displayIndex + 1;
  }

  dateInputValue(value: unknown): string {
    return toDateKey(value) ?? '';
  }

  pinnedLeftOffset(columnId: string): number {
    let offset = (this.showSelection() ? 40 : 0) + (this.rowDragEnabled() ? 36 : 0);
    for (const col of this.visibleColumns()) {
      if (col.pinned !== 'left') {
        continue;
      }
      if (col.id === columnId) {
        return offset;
      }
      offset += this.columnWidth(col) ?? col.minWidth;
    }
    return offset;
  }

  pinnedRightOffset(columnId: string): number {
    let offset = this.effectiveEditMode() === 'fullRow' ? 132 : 0;
    const pinned = this.visibleColumns().filter((c) => c.pinned === 'right');
    for (let i = pinned.length - 1; i >= 0; i--) {
      const col = pinned[i]!;
      if (col.id === columnId) {
        return offset;
      }
      offset += this.columnWidth(col) ?? col.minWidth;
    }
    return offset;
  }

  ariaSort(columnId: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sorts().find((s) => s.columnId === columnId);
    if (!sort) {
      return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  sortMarker(columnId: string): string | null {
    const index = this.sorts().findIndex((s) => s.columnId === columnId);
    if (index < 0) {
      return null;
    }
    const sort = this.sorts()[index]!;
    const arrow = sort.direction === 'asc' ? '↑' : '↓';
    return this.sorts().length > 1 ? `${arrow}${index + 1}` : arrow;
  }

  toggleSort(column: ResolvedColumn<T>, event: MouseEvent): void {
    if (!column.sortable) {
      return;
    }
    this.activateHeaderSort(column.id, this.multiSort() && event.shiftKey);
  }

  /** Keyboard / API sort toggle (Enter on header). */
  activateHeaderSort(columnId: string, multi: boolean): void {
    const column = this.columnsById().get(columnId);
    if (!column?.sortable) {
      return;
    }
    const useMulti = this.multiSort() && multi;
    const existing = this.sorts();
    const current = existing.find((s) => s.columnId === column.id)?.direction ?? null;
    const next = nextSortDirection(current, useMulti);

    let sorts: SortState[];
    if (!useMulti) {
      sorts = next ? [{ columnId: column.id, direction: next }] : [];
    } else {
      const others = existing.filter((s) => s.columnId !== column.id);
      sorts = next ? [...others, { columnId: column.id, direction: next }] : others;
    }

    this.sorts.set(sorts);
    this.sortChange.emit(sorts);
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSortChange', sorts);
  }

  setFilter(columnId: string, value: string): void {
    const next = { ...this.filters(), [columnId]: value };
    if (!value) {
      delete next[columnId];
    }
    this.filters.set(next);
    this.filterChange.emit(next);
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onFilterChange', next);
  }

  setQuickFilter(value: string): void {
    this.quickFilter.set(value);
    this.emitState();
    this.emitQueryIfServer();
  }

  clearFilters(): void {
    this.filters.set({});
    this.quickFilter.set('');
    this.filterChange.emit({});
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onFilterChange', {});
  }

  goToPage(index: number): void {
    this.pageIndex.set(Math.max(0, Math.min(this.totalPages() - 1, index)));
    this.emitState();
    this.emitQueryIfServer();
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.scrollTop.set(el.scrollTop);
    // Height can change if a horizontal scrollbar toggles; width is owned by ResizeObserver.
    const height = el.clientHeight || 480;
    if (this.viewportHeight() !== height) {
      this.viewportHeight.set(height);
    }
  }

  /** Called by `infiniteScrollPlugin` via `api.notifyNearEnd()`. */
  notifyNearEnd(): void {
    this.nearEnd.emit();
  }

  toggleGroup(groupId: string): void {
    const adapter = this.boundRowGroupAdapter();
    if (adapter) {
      adapter.toggleCollapsed(groupId);
      return;
    }
    this.collapsedGroupIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  expandAll(): void {
    const adapter = this.boundRowGroupAdapter();
    if (adapter) {
      adapter.expandAll();
      return;
    }
    this.collapsedGroupIds.set(new Set());
  }

  setRowGroupColumns(columns: readonly string[]): void {
    this.boundRowGroupAdapter()?.setColumns(columns);
  }

  getRowGroupColumns(): string[] {
    return [...(this.boundRowGroupAdapter()?.columns() ?? [])];
  }

  clearRowGroup(): void {
    this.boundRowGroupAdapter()?.clear();
  }

  collapseAll(): void {
    const adapter = this.boundRowGroupAdapter();
    const all = this.kernel.capabilities.buildDisplayRows(this.processedRows(), {
      ...this.rowModelContext(),
      collapsedGroupIds: new Set(),
    });
    const ids = all.filter((row) => row.kind === 'group').map((row) => row.id);
    if (adapter) {
      adapter.collapseAll(ids);
      return;
    }
    this.collapsedGroupIds.set(new Set(ids));
  }

  isSelected(id: string | number): boolean {
    return this.selectedIds().includes(id);
  }

  /** §5d — host may exclude rows from checkbox / Space / click-select. */
  isRowSelectable(row: T, rowId: string | number): boolean {
    const fn = this.controller().isRowSelectable;
    return fn ? fn(row, rowId) : true;
  }

  toggleRowSelection(id: string | number, event: Event): void {
    const row = this.findDataRowById(id);
    if (row && !this.isRowSelectable(row, id)) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    if (this.effectiveSelectionMode() === 'single') {
      const next = checked ? [id] : [];
      this.selectedIds.set(next);
      this.selectionChange.emit(next);
      notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSelectionChange', next);
      return;
    }
    const set = new Set(this.selectedIds());
    if (checked) {
      set.add(id);
    } else {
      set.delete(id);
    }
    const next = [...set];
    this.selectedIds.set(next);
    this.selectionChange.emit(next);
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSelectionChange', next);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!checked) {
      this.selectedIds.set([]);
      this.selectionChange.emit([]);
      notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSelectionChange', []);
      return;
    }
    const ids = this.visibleDataRowIds().filter((id) => {
      const row = this.findDataRowById(id);
      return !row || this.isRowSelectable(row, id);
    });
    this.selectedIds.set(ids);
    this.selectionChange.emit(ids);
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSelectionChange', ids);
  }

  onRowClick(row: T, rowId: string | number, rowIndex: number, event: MouseEvent): void {
    if (
      this.effectiveRowClickSelects() &&
      this.effectiveSelectionMode() !== 'none' &&
      this.isRowSelectable(row, rowId) &&
      !(event.target instanceof HTMLElement && event.target.closest('input,button,a,select,textarea'))
    ) {
      const selected = this.isSelected(rowId);
      const fake = {
        target: { checked: !selected },
      } as unknown as Event;
      this.toggleRowSelection(rowId, fake);
    }
    this.rowClick.emit({ row, rowId, rowIndex, event });
  }

  onCellClick(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
    event: MouseEvent,
    /** Index in the paged display row list (focus / keyboard model). */
    displayIndex?: number,
  ): void {
    // Don't steal focus from an active editor (breaks double-click select-all).
    if (this.isEditorEventTarget(event.target)) {
      return;
    }
    const focusIndex = displayIndex ?? rowIndex;
    this.kernel.focus.focusCell(focusIndex, column.id);
    this.cellClick.emit({
      row,
      rowId,
      rowIndex,
      column,
      columnId: column.id,
      value,
      event,
    });
    if (this.effectiveEditInteraction().pointerStart === 'click') {
      this.startEdit(row, rowId, rowIndex, column, value);
    }
  }

  onCellDblClick(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
    event: MouseEvent,
  ): void {
    if (this.isEditorEventTarget(event.target)) {
      return;
    }
    if (this.effectiveEditInteraction().pointerStart !== 'dblclick') {
      return;
    }
    this.startEdit(row, rowId, rowIndex, column, value);
  }

  private findDataRowById(id: string | number): T | null {
    const getId = this.effectiveRowId();
    for (let i = 0; i < this.data().length; i++) {
      const row = this.data()[i]!;
      if (getId(row, i) === id) {
        return row;
      }
    }
    return null;
  }

  private isEditorEventTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable ||
      !!target.closest('.al-data-grid__edit-input, .al-data-grid__edit-check')
    );
  }

  onGridKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const inField =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    // Escape must cancel edit even while focus is inside an editor field.
    if (event.key === 'Escape') {
      this.onEscapeKey(event);
      return;
    }

    if (inField) {
      return;
    }
    if (this.kernel.focus.handleKeydown(event)) {
      event.preventDefault();
    }
  }

  onEscapeKey(event?: Event): void {
    const focus = this.kernel.focus.getFocus();
    if (focus && focusRealmOf(focus) === 'floatingFilter') {
      this.kernel.focus.focusCell(0, focus.columnId, 'header');
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    if (this.columnMenuColumnId() || this.contextMenuState()?.source === 'header') {
      this.closeColumnMenu();
      this.closeContextMenu();
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    if (this.api.getCellRange()) {
      this.api.clearCellRange();
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    const hadEdit = this.editingCell() != null || this.rowEditMgr.editingId() != null;
    const hadMenu = this.contextMenuState() != null;
    this.cancelActiveEdit();
    this.closeContextMenu();
    if (hadEdit || hadMenu) {
      (event as KeyboardEvent | undefined)?.preventDefault?.();
    }
  }

  cancelActiveEdit(): void {
    if (this.rowEditMgr.editingId() != null) {
      this.cancelRowEdit();
      return;
    }
    if (this.editingCell() != null) {
      this.cancelEdit();
    }
  }

  syncDomFocus(cell: FocusCell | null): void {
    if (!cell) {
      return;
    }
    queueMicrotask(() => {
      const realm = focusRealmOf(cell);
      if (realm === 'header') {
        const el = this.host.nativeElement.querySelector(
          `[data-testid="al-dg-col-${cell.columnId}"]`,
        ) as HTMLElement | null;
        el?.focus({ preventScroll: true });
        return;
      }
      if (realm === 'floatingFilter') {
        const el = this.host.nativeElement.querySelector(
          `[data-testid="al-dg-filter-${cell.columnId}"]`,
        ) as HTMLElement | null;
        el?.focus({ preventScroll: true });
        return;
      }
      const item = this.pagedDisplayRows()[cell.rowIndex];
      if (!item) {
        return;
      }
      if (isGroupDisplayRow(item)) {
        const el = this.host.nativeElement.querySelector(
          `[data-testid="al-dg-group-${item.id}"] .al-data-grid__group-toggle`,
        ) as HTMLElement | null;
        el?.focus({ preventScroll: true });
        return;
      }
      if (!isDataDisplayRow(item)) {
        return;
      }
      const el = this.host.nativeElement.querySelector(
        `[data-testid="al-dg-cell-${item.rowId}-${cell.columnId}"]`,
      ) as HTMLElement | null;
      // Keep caret/selection inside an active editor (e.g. double-click select-all).
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (el && active instanceof HTMLElement && el.contains(active) && this.isEditorEventTarget(active)) {
        return;
      }
      el?.focus({ preventScroll: true });
    });
  }

  /** Tab / focusin on the grid frame — restore last cell or default (K4). */
  onGridFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || !this.host.nativeElement.contains(target)) {
      return;
    }
    // Already on a cell/header/filter — don't steal.
    if (
      target.closest(
        '.al-data-grid__td, .al-data-grid__th, .al-data-grid__edit-input, .al-data-grid__filter-field, al-data-grid-toolbar, al-data-grid-find-bar',
      )
    ) {
      return;
    }
    if (target.classList.contains('al-data-grid__frame') || target === this.host.nativeElement) {
      this.kernel.focus.restoreOrFocusDefault();
    }
  }

  startEditAtFocus(
    rowIndex: number,
    columnId: string,
    reason: 'enter' | 'f2' = 'enter',
  ): void {
    const focus = this.kernel.focus.getFocus();
    if (focus && focusRealmOf(focus) !== 'body') {
      return;
    }
    if (reason === 'enter' && this.effectiveEditInteraction().enterIdle === 'moveDown') {
      this.kernel.focus.move(1, 0);
      return;
    }
    const item = this.pagedDisplayRows()[rowIndex];
    const col = this.columnsById().get(columnId);
    if (!item || !isDataDisplayRow(item) || !col?.editable) {
      return;
    }
    this.startEdit(
      item.row,
      item.rowId,
      item.dataIndex,
      col,
      this.cellValue(item.row, col, item.dataIndex),
    );
  }

  toggleSelectionAtIndex(rowIndex: number): void {
    if (this.effectiveSelectionMode() === 'none') {
      return;
    }
    const item = this.pagedDisplayRows()[rowIndex];
    if (!item || !isDataDisplayRow(item)) {
      return;
    }
    if (!this.isRowSelectable(item.row, item.rowId)) {
      return;
    }
    const selected = this.isSelected(item.rowId);
    const fake = {
      target: { checked: !selected },
    } as unknown as Event;
    this.toggleRowSelection(item.rowId, fake);
  }

  selectAllVisible(): void {
    if (this.effectiveSelectionMode() !== 'multi') {
      return;
    }
    const ids = this.visibleDataRowIds().filter((id) => {
      const row = this.findDataRowById(id);
      return !row || this.isRowSelectable(row, id);
    });
    this.setSelectedIds(ids);
  }

  ensureRowVisible(rowIndex: number): void {
    if (this.pagination()) {
      const size = this.pageSize();
      const page = Math.floor(rowIndex / size);
      if (page !== this.pageIndex()) {
        this.goToPage(page);
      }
      return;
    }
    if (!this.virtualEnabled()) {
      return;
    }
    const top = rowIndex * this.rowHeight();
    const scroll = this.host.nativeElement.querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    if (!scroll) {
      return;
    }
    if (top < scroll.scrollTop) {
      scroll.scrollTop = top;
    } else if (top + this.rowHeight() > scroll.scrollTop + scroll.clientHeight) {
      scroll.scrollTop = top - scroll.clientHeight + this.rowHeight();
    }
  }

  onCellContextMenu(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
    event: MouseEvent,
    displayIndex?: number,
  ): void {
    if (!this.contextMenuEnabled()) {
      return;
    }
    // Hold Ctrl/⌘ to get the browser menu (DevTools) — better than AG's popupParent dance.
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.kernel.focus.focusCell(displayIndex ?? rowIndex, column.id);

    const ctx: DataGridContextMenuContext<T> = {
      row,
      rowId,
      rowIndex,
      column,
      columnId: column.id,
      value,
      event,
      selectedIds: this.selectedIds(),
      form: this.isRowEditing(rowId) ? this.rowForm() : null,
      close: () => this.closeContextMenu(),
    };

    const custom = this.contextMenuItems();
    const pluginItems = this.kernel.capabilities.resolveContextMenuItems(ctx);
    let hostItems: DataGridContextMenuItem<T>[] = [];
    if (custom) {
      hostItems = resolveContextMenuItems(custom, ctx);
    } else if (this.contextMenu() || this.contextMenuOverlay()) {
      hostItems = defaultContextMenuItems<T>({
        copyCell: () => writeClipboardText(formatCellValue(value, row, column, rowIndex)),
        copyRow: () =>
          writeClipboardText(
            rowsToCsv([row], this.visibleColumns(), { includeHeaders: false }),
          ),
        exportCsv: () => this.exportCsv(),
        autoSize: () => this.autoSizeColumns(),
        clearFilters: () => this.clearFilters(),
        hasFilters:
          Object.keys(this.filters()).length > 0 || this.quickFilter().trim().length > 0,
      });
    }
    const items = [...pluginItems, ...hostItems];

    if (!this.contextMenuTemplate() && !items.length) {
      return;
    }

    const pos = positionMenu(event.clientX, event.clientY, 200, 8 + items.length * 36);
    this.contextMenuState.set({ left: pos.left, top: pos.top, ctx, source: 'cell', items });
    this.contextMenuOpened.emit(ctx);
  }

  /**
   * Lean column menu — Alt+↓ / API, and header right-click.
   * Drag-onto-column pin still works via {@link reorderVisibleColumns}.
   */
  onHeaderContextMenu(column: ResolvedColumn<T>, event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.columnMenuColumnId.set(column.id);
    const items = this.leanColumnMenuItems(column);
    const pos = positionMenu(event.clientX, event.clientY, 220, 8 + items.length * 36);
    this.contextMenuState.set({
      left: pos.left,
      top: pos.top,
      ctx: null,
      source: 'header',
      items,
    });
  }

  runContextMenuItem(item: DataGridContextMenuItem<T>): void {
    const menu = this.contextMenuState();
    if (!menu || item.disabled) {
      return;
    }
    // Header actions are closed over column id and ignore ctx; cell actions need ctx.
    if (menu.ctx) {
      item.action?.(menu.ctx);
    } else {
      (item.action as (() => void) | undefined)?.();
    }
    this.closeContextMenu();
  }

  closeContextMenu(): void {
    if (!this.contextMenuState()) {
      this.columnMenuColumnId.set(null);
      return;
    }
    this.contextMenuState.set(null);
    this.columnMenuColumnId.set(null);
    this.contextMenuClosed.emit();
  }

  onDocumentPointerDown(event: Event): void {
    if (!this.contextMenuState()) {
      return;
    }
    const target = event.target as Node | null;
    const menuEl = this.host.nativeElement.querySelector('.al-data-grid__ctx');
    if (menuEl && target && menuEl.contains(target)) {
      return;
    }
    this.closeContextMenu();
  }

  isEditing(rowId: string | number, columnId: string): boolean {
    if (this.effectiveEditMode() === 'fullRow') {
      return this.isRowEditing(rowId);
    }
    const cell = this.editingCell();
    return !!cell && cell.rowId === rowId && cell.columnId === columnId;
  }

  isRowEditing(rowId: string | number): boolean {
    return this.rowEditMgr.isEditing(rowId);
  }

  activeRowForm(): FieldTree<T> | null {
    return this.rowForm();
  }

  rowFormInvalid(): boolean {
    const id = this.rowEditMgr.editingId();
    const tree = this.rowForm();
    return id != null && !!tree && tree().invalid();
  }

  formFieldFor(column: ColumnDef<T>): FieldTree<unknown> | null {
    if (!this.rowEditMgr.editingId()) {
      return null;
    }
    return formFieldForColumn(this.rowForm(), column);
  }

  fieldInvalid(field: FieldTree<unknown> | null): boolean {
    return !!field && field().invalid();
  }

  fieldError(field: FieldTree<unknown> | null): string | null {
    if (!field) {
      return null;
    }
    const errors = field().errors();
    const first = errors[0];
    return first?.message ?? (first ? first.kind : null);
  }

  cellTemplateContext(
    row: T,
    rowId: string | number,
    rowIndex: number,
    col: ResolvedColumn<T>,
    value: unknown,
    editing: boolean,
  ) {
    const formTree = this.isRowEditing(rowId) ? this.rowForm() : null;
    return {
      $implicit: row,
      row,
      value,
      rowIndex,
      columnId: col.id,
      editing,
      form: formTree,
      field: formFieldForColumn(formTree, col),
      rowEdit: this.isRowEditing(rowId) ? this.rowEditSession() : null,
    };
  }

  startEdit(row: T, rowId: string | number, rowIndex: number, column: ColumnDef<T>, value: unknown): void {
    if (!column.editable) {
      return;
    }
    if (this.effectiveEditMode() === 'fullRow') {
      this.startRowEdit(row, rowId, rowIndex);
      return;
    }
    if (isBooleanColumn(column, value) && !isSelectEditor(column) && !isCustomEditorComponent(column)) {
      // Checkbox-only: keyboard Enter/F2 toggles instead of opening a draft editor.
      const resolved =
        'minWidth' in column
          ? (column as ResolvedColumn<T>)
          : this.columnsById().get(column.id ?? column.field ?? '');
      if (resolved) {
        this.toggleBoolean(row, rowId, rowIndex, resolved, !Boolean(value));
      }
      return;
    }
    this.rowEditMgr.destroy();
    this.editingCell.set({ rowId, columnId: column.id ?? column.field ?? '' });
    if (isDateColumn(column) || column.cellEditor === 'date') {
      this.editDraft.set(toDateKey(value) ?? '');
    } else {
      this.editDraft.set(value == null ? '' : String(value));
    }
  }

  startRowEdit(row: T, rowId: string | number, rowIndex: number): void {
    if (this.effectiveEditMode() !== 'fullRow') {
      return;
    }
    this.editingCell.set(null);
    this.rowEditMgr.start(row, rowId, rowIndex);
  }

  commitRowEdit(): boolean {
    return this.rowEditMgr.commit();
  }

  cancelRowEdit(): void {
    this.rowEditMgr.cancel();
  }

  private destroyRowEditSession(): void {
    this.rowEditMgr.destroy();
  }

  toggleBoolean(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    checked: boolean,
  ): void {
    const previousValue = getCellValue(row, column, rowIndex);
    this.cellEdit.emit({
      row,
      rowId,
      column,
      columnId: column.id,
      previousValue,
      value: checked,
      form: this.isRowEditing(rowId) ? this.rowForm() : null,
    });
  }

  commitEdit(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    const cell = this.editingCell();
    if (!cell || cell.rowId !== rowId || cell.columnId !== column.id) {
      return;
    }
    const previousValue = getCellValue(row, column, rowIndex);
    const value = coerceCellEditValue(column, this.editDraft(), previousValue);
    this.editingCell.set(null);
    if (Object.is(value, previousValue)) {
      return;
    }
    if (
      previousValue instanceof Date &&
      value instanceof Date &&
      previousValue.getTime() === value.getTime()
    ) {
      return;
    }
    this.cellEdit.emit({
      row,
      rowId,
      column,
      columnId: column.id,
      previousValue,
      value,
      form: null,
    });
  }

  /** Enter in built-in cell editor — commit, optionally move down (§5b). */
  onEditorEnter(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    this.commitEdit(row, rowId, rowIndex, column);
    if (this.effectiveEditInteraction().enterEditing === 'commitAndMoveDown') {
      this.kernel.focus.move(1, 0);
    }
  }

  /** Blur of built-in cell editor — commit or cancel per §5b. */
  onEditorBlur(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    if (this.effectiveEditInteraction().editorBlur === 'cancel') {
      this.cancelEdit();
      return;
    }
    this.commitEdit(row, rowId, rowIndex, column);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  setFindQuery(value: string): void {
    this.findQuery.set(value);
    this.findActiveIndex.set(0);
    this.findMatchesChange.emit(this.findMatches());
  }

  findNext(): void {
    this.kernel.find.next();
  }

  findPrev(): void {
    this.kernel.find.prev();
  }

  focusFindInput(): void {
    const input = this.host.nativeElement.querySelector(
      '[data-testid="al-dg-find-input"]',
    ) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }

  isFindMatch(rowId: string | number, columnId: string): boolean {
    return this.findMatchKeys().has(`${rowId}::${columnId}`);
  }

  isFindActive(rowId: string | number, columnId: string): boolean {
    const active = this.activeFindMatch();
    return !!active && active.rowId === rowId && active.columnId === columnId;
  }

  findHighlightParts(
    value: unknown,
    row: T,
    column: ResolvedColumn<T>,
    rowIndex: number,
  ) {
    const text = formatCellValue(value, row, column, rowIndex);
    return splitFindHighlight(text, this.findQuery(), this.findCaseSensitiveEffective());
  }

  private scrollToActiveFind(): void {
    const match = this.activeFindMatch();
    if (!match) {
      return;
    }

    // Prefer absolute display-row index (includes group headers) for paging / virtual scroll.
    const absoluteDisplayIndex = this.displayRows().findIndex(
      (item) => item.kind === 'data' && item.rowId === match.rowId,
    );
    const scrollIndex = absoluteDisplayIndex >= 0 ? absoluteDisplayIndex : match.rowIndex;

    if (this.pagination()) {
      const page = Math.floor(scrollIndex / this.pageSize());
      if (page !== this.pageIndex()) {
        this.pageIndex.set(page);
      }
    } else if (this.virtualEnabled()) {
      const top = Math.max(0, scrollIndex * this.rowHeight() - this.rowHeight() * 2);
      this.scrollTop.set(top);
      const scroll = this.host.nativeElement.querySelector('.al-data-grid__scroll') as HTMLElement | null;
      if (scroll) {
        scroll.scrollTop = top;
      }
    }
    afterNextRender(() => {
      const el = this.host.nativeElement.querySelector(
        `[data-testid="al-dg-cell-${match.rowId}-${match.columnId}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const focusIndex = this.pagedDisplayRows().findIndex(
        (item) => item.kind === 'data' && item.rowId === match.rowId,
      );
      if (focusIndex >= 0) {
        this.kernel.focus.focusCell(focusIndex, match.columnId);
      }
    }, { injector: this.injector });
  }

  startResize(event: PointerEvent, column: ResolvedColumn<T>): void {
    event.preventDefault();
    event.stopPropagation();
    // Prefer rendered track width so flex (`fr`) columns don't jump from minWidth.
    const header = (event.currentTarget as HTMLElement | null)?.closest('.al-data-grid__th');
    const rendered = header?.getBoundingClientRect().width;
    attachColumnResize({
      startX: event.clientX,
      startWidth: Math.round(rendered ?? this.columnWidth(column) ?? column.minWidth),
      minWidth: column.minWidth,
      onWidth: (width) => {
        this.widthOverrides.update((widths) => nextWidthOverride(widths, column.id, width, column.minWidth));
      },
      onEnd: () => this.emitState(),
    });
  }

  onHeaderDragStart(index: number, event: DragEvent): void {
    if (!this.columnReorder()) {
      return;
    }
    this.headerDragFrom = index;
    event.dataTransfer?.setData('text/plain', String(index));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onHeaderDrop(toIndex: number, event: DragEvent): void {
    event.preventDefault();
    if (!this.columnReorder()) {
      return;
    }
    const from = this.headerDragFrom ?? Number(event.dataTransfer?.getData('text/plain'));
    this.headerDragFrom = null;
    this.reorderVisibleColumns(from, toIndex);
  }

  onPanelReorder(event: { fromIndex: number; toIndex: number }): void {
    const ordered = this.orderedColumns();
    const fromCol = ordered[event.fromIndex];
    const toCol = ordered[event.toIndex];
    if (!fromCol || !toCol) {
      return;
    }
    if (
      defsHaveColumnGroups(this.effectiveColumns()) &&
      !sameColumnGroup(this.leafGroupMap(), fromCol.id, toCol.id)
    ) {
      return;
    }
    const layout = this.columnLayout();
    const moved = moveColumn(layout, fromCol.id, toCol.id);
    if (!moved) {
      return;
    }
    // Columns panel reorder keeps pins as-is.
    this.applyColumnLayout({ order: moved.order, pin: layout.pin });
  }

  onColumnVisibility(event: { columnId: string; visible: boolean }): void {
    this.setColumnVisible(event.columnId, event.visible);
  }

  setColumnVisible(columnId: string, visible: boolean): void {
    const set = new Set(this.hiddenColumnIds());
    if (visible) {
      set.delete(columnId);
    } else {
      if (this.visibleColumns().length <= 1 && this.visibleColumns().some((c) => c.id === columnId)) {
        return;
      }
      set.add(columnId);
    }
    const next = [...set];
    this.hiddenColumnIds.set(next);
    this.emitState();
  }

  showAllColumns(): void {
    this.hiddenColumnIds.set([]);
    this.emitState();
  }

  reorderVisibleColumns(from: number, to: number): void {
    const visible = this.visibleColumns();
    const fromCol = visible[from];
    const toCol = visible[to];
    if (!fromCol || !toCol) {
      return;
    }
    const hasGroups = defsHaveColumnGroups(this.effectiveColumns());
    const leafMap = this.leafGroupMap();
    const next = moveColumn(this.columnLayout(), fromCol.id, toCol.id, {
      constrainSameGroup: hasGroups
        ? (a, b) => sameColumnGroup(leafMap, a, b)
        : undefined,
    });
    if (!next) {
      return;
    }
    this.applyColumnLayout(next);
  }

  /**
   * Pin / unpin a column at runtime (AG Grid `setColumnPinned`).
   * Pass `null` to unpin.
   */
  setColumnPinned(columnId: string, pinned: ColumnPin | null): void {
    if (!this.columnLayout().order.includes(columnId) && !this.columnsById().has(columnId)) {
      return;
    }
    this.applyColumnLayout(setColumnPin(this.columnLayout(), columnId, pinned));
  }

  getColumnPinned(columnId: string): ColumnPin | null {
    return this.columnLayout().pin[columnId] ?? null;
  }

  private applyColumnLayout(layout: ColumnLayout): void {
    this.columnLayout.set(layout);
    this.columnOrderChange.emit(layout.order);
    this.emitState();
  }

  autoSizeColumns(columnIds?: string[]): void {
    const targets = columnIds?.length
      ? this.visibleColumns().filter((c) => columnIds.includes(c.id))
      : this.visibleColumns();
    const rows = this.processedRows();
    const next = { ...this.widthOverrides() };
    for (const col of targets) {
      next[col.id] = estimateColumnWidth(col, rows);
    }
    this.widthOverrides.set(next);
    this.emitState();
  }

  exportCsv(filename = 'data-grid.csv'): string {
    const csv = rowsToCsv(this.processedRows(), this.visibleColumns());
    downloadCsv(filename, csv);
    return csv;
  }

  getState(): DataGridState {
    const layout = this.columnLayout();
    return {
      sorts: this.sorts(),
      filters: this.filters(),
      quickFilter: this.quickFilter(),
      hiddenColumnIds: this.hiddenColumnIds(),
      columnOrder: [...layout.order],
      widthOverrides: this.widthOverrides(),
      columnPins: { ...layout.pin },
      pageIndex: this.pageIndex(),
      activeSidePanel: this.activeSidePanel(),
    };
  }

  setState(state: Partial<DataGridState>): void {
    const base = { ...createEmptyGridState(), ...this.getState(), ...state };
    this.sorts.set(base.sorts);
    this.filters.set(base.filters);
    this.quickFilter.set(base.quickFilter);
    this.hiddenColumnIds.set(base.hiddenColumnIds);
    this.columnLayout.set({
      order: base.columnOrder ?? [],
      pin: base.columnPins ?? {},
    });
    this.widthOverrides.set(base.widthOverrides);
    this.pageIndex.set(base.pageIndex);
    this.activeSidePanel.set(base.activeSidePanel);
    this.emitState();
    this.emitQueryIfServer();
  }

  getFilterModel(): DataGridFilterState {
    return { ...this.filters() };
  }

  setFilterModel(filters: DataGridFilterState): void {
    this.filters.set({ ...filters });
    this.filterChange.emit(this.filters());
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onFilterChange', this.filters());
  }

  getSortModel(): SortState[] {
    return [...this.sorts()];
  }

  setSortModel(sorts: SortState[]): void {
    this.sorts.set([...sorts]);
    this.sortChange.emit(this.sorts());
    this.emitState();
    this.emitQueryIfServer();
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSortChange', this.sorts());
  }

  getQuickFilter(): string {
    return this.quickFilter();
  }

  getSelectedIds(): Array<string | number> {
    return [...this.selectedIds()];
  }

  setSelectedIds(ids: Array<string | number>): void {
    const next = [...ids];
    this.selectedIds.set(next);
    this.selectionChange.emit(next);
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onSelectionChange', next);
  }

  getDisplayedRowCount(): number {
    return this.displayRows().length;
  }

  getProcessedRows(): readonly T[] {
    return this.processedRows();
  }

  getSourceRows(): readonly T[] {
    return this.data();
  }

  getQuery(): DataGridQuery {
    return {
      sorts: this.sorts(),
      filters: this.filters(),
      quickFilter: this.quickFilter(),
      pageIndex: this.pageIndex(),
      pageSize: this.pageSize(),
    };
  }

  getFindMatches(): readonly FindMatch[] {
    return this.findMatches();
  }

  focusCell(rowIndex: number, columnId: string): void {
    this.kernel.focus.focusCell(rowIndex, columnId);
  }

  startRowEditById(rowId: string | number): void {
    const rows = this.processedRows();
    const index = rows.findIndex((row, i) => this.resolveRowId(row, i) === rowId);
    if (index < 0) {
      return;
    }
    this.startRowEdit(rows[index]!, rowId, index);
  }

  stopEditing(cancel = false): void {
    if (cancel) {
      if (this.rowEditMgr.editingId() != null) {
        this.cancelRowEdit();
      } else {
        this.cancelEdit();
      }
      return;
    }
    if (this.rowEditMgr.editingId() != null) {
      this.commitRowEdit();
      return;
    }
    const cell = this.editingCell();
    if (!cell) {
      return;
    }
    const rows = this.processedRows();
    const rowIndex = rows.findIndex((row, i) => this.resolveRowId(row, i) === cell.rowId);
    const column = this.columnsById().get(cell.columnId);
    if (rowIndex < 0 || !column) {
      this.cancelEdit();
      return;
    }
    this.commitEdit(rows[rowIndex]!, cell.rowId, rowIndex, column);
  }

  getSelectionClipboardText(): string | null {
    if (!this.copyEnabled()) {
      return null;
    }
    const selected = new Set(this.selectedIds());
    if (!selected.size) {
      return null;
    }
    const rows = this.processedRows().filter((row, index) =>
      selected.has(this.resolveRowId(row, index)),
    );
    if (!rows.length) {
      return null;
    }
    return rowsToCsv(rows, this.visibleColumns(), { includeHeaders: false });
  }

  getFocusedCell() {
    return this.focusedCell();
  }

  getPagedDisplayRows(): readonly DisplayRow<T>[] {
    return this.pagedDisplayRows();
  }

  getColumnsById(): Map<string, ColumnDef<any>> {
    return this.columnsById() as Map<string, ColumnDef<any>>;
  }

  getVisibleColumnIds(): string[] {
    return this.visibleColumns().map((c) => c.id);
  }

  emitPaste(event: PasteEvent<T>): void {
    this.paste.emit(event);
  }

  bindRowGroupAdapter(adapter: BoundRowGroupAdapter | null): void {
    this.boundRowGroupAdapter.set(adapter);
  }

  bindTreeDataAdapter(adapter: BoundTreeDataAdapter | null): void {
    this.boundTreeDataAdapter.set(adapter);
  }

  private pluginListKey(plugins: readonly DataGridPlugin<T>[]): string {
    return plugins.map((p) => p.id ?? '').join('\0');
  }

  /**
   * Pointer-based row reorder (HTML5 DnD is unreliable on sticky cells in overflow scrollers).
   * Session listeners live in {@link attachRowReorder}.
   */
  readonly rowDragFromIndex = signal<number | null>(null);
  readonly rowDragOverIndex = signal<number | null>(null);
  private rowDragCleanup: (() => void) | null = null;

  onRowDragPointerDown(index: number, event: PointerEvent): void {
    if (!this.rowDragEnabled() || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.rowDragCleanup?.();
    this.rowDragFromIndex.set(index);
    this.rowDragOverIndex.set(index);

    const scroll = this.host.nativeElement.querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    const thead = scroll?.querySelector('.al-data-grid__thead') as HTMLElement | null;

    this.rowDragCleanup = attachRowReorder({
      pointerId: event.pointerId,
      fromIndex: index,
      getDropIndex: (clientY) => {
        if (!scroll) {
          return null;
        }
        return resolveRowDropDataIndex({
          clientY,
          scrollTop: scroll.scrollTop,
          scrollRectTop: scroll.getBoundingClientRect().top,
          rowHeight: this.rowHeight(),
          contentOffsetY: thead?.offsetHeight ?? 0,
          displayRows: this.pagedDisplayRows(),
        });
      },
      onOver: (over) => this.rowDragOverIndex.set(over),
      onDrop: (from, to) => {
        const payload = buildRowReorderEvent(
          this.processedRows(),
          from,
          to,
          (row, i) => this.resolveRowId(row, i),
        );
        if (payload) {
          this.rowReorder.emit(payload);
        }
      },
      onEnd: () => {
        this.rowDragCleanup = null;
        this.rowDragFromIndex.set(null);
        this.rowDragOverIndex.set(null);
      },
    });
  }

  setFilterOptions(column: ResolvedColumn<T>): string[] {
    return collectSetFilterValues(this.data(), column);
  }

  private emitQueryIfServer(): void {
    if (!this.serverSide()) {
      return;
    }
    this.queryChange.emit(this.getQuery());
  }

  private emitState(): void {
    const state = this.getState();
    this.stateChange.emit(state);
    notifyPlugins(this.effectivePlugins(), this.pluginContext(), 'onStateChange', state);
  }
}
