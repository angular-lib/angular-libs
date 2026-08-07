import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  contentChildren,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
  type Type,
} from '@angular/core';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { DataGridApi } from '../../api/grid-api';
import type { DataGridEventMap } from '../../api/grid-events';
import type { GridController } from '../../create-grid';
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
import {
  type ResolvedEditInteraction,
} from '../../editing/edit-interaction';
import {
  CellEditorRegistry,
  defaultCellEditorRegistry,
  resolveCellEditor,
} from '../../editing/cell-editor-registry';
import {
  type DataGridPlugin,
  type DataGridToolbarSlotItem,
} from '../../plugins/types';
import {
  formatAggregateValue,
  isCustomRendererComponent,
  isSelectEditor,
  resolveSelectValues,
} from '../../utils/editors';
import {
  reconcileColumnLayout,
  reconcileHiddenColumnIds,
} from '../../utils/column-layout';
import { type DisplayRow } from '../../utils/row-display';
import {
  formatCellValue,
  getCellValue,
  isBooleanColumn,
  isDateColumn,
  resolveRowClass,
} from '../../utils/cell-value';
import { type FindMatch } from '../../utils/find';
import {
  createDataGridSession,
  type GridSession,
} from '../../session/create-session';
import type {
  ColumnLayoutHost,
  EditSyncHost,
  MenuHost,
  SelectionHost,
  ViewportHost,
} from '../../hosts';
import {
  ariaBodyRowIndexOf,
  ariaColIndexOf,
  ariaRowCountOf,
  cellAriaSelectedOf,
  headerRowCountOf,
  mergeCellClass,
  resolveBaseCellClass,
} from '../../hosts/binder-template.helpers';
import type {
  CellClickEvent,
  CellEditEvent,
  CellEditorParams,
  CellRendererParams,
  ColumnDef,
  ColumnOrGroupDef,
  CreateRowFormFn,
  DataGridContextMenuContext,
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
export class DataGrid<T = unknown> {
  readonly data = input.required<readonly T[]>();
  /**
   * Required bootstrap from `createGrid()` — columns, plugins, selection, edit policy, optional rows.
   */
  readonly controller = input.required<GridController<T>>();
  readonly loading = input(false);
  readonly emptyMessage = input<string | null>(null);
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
  /** Host-owned row predicate applied after column filters. */
  readonly externalFilter = input<((row: T) => boolean) | null>(null);
  /**
   * Typed menu items or factory (chrome enablement is `createGrid({ chrome: { contextMenu } })`).
   * Takes priority over defaults when set.
   */
  readonly contextMenuItems = input<DataGridContextMenuItems<T> | null>(null);
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

  /** Runtime ownership root — hosts, kernel, pipeline, api. */
  readonly session!: GridSession<T>;

  /** Imperative façade for hosts and plugins. */
  readonly api!: DataGridApi<T>;

  /** Template aliases — hosts owned by session (F3: no signal façades). */
  readonly columnLayoutHost!: ColumnLayoutHost<T>;
  readonly viewportHost!: ViewportHost<T>;
  readonly selectionHost!: SelectionHost<T>;
  readonly editSyncHost!: EditSyncHost<T>;
  readonly menuHost!: MenuHost<T>;

  private readonly cellTemplates = contentChildren(DataGridCellDirective);
  private readonly headerTemplates = contentChildren(DataGridHeaderDirective);
  readonly loadingOverlay = contentChild(DataGridLoadingDirective);
  readonly emptyOverlay = contentChild(DataGridEmptyDirective);
  private readonly contextMenuOverlay = contentChild(DataGridContextMenuDirective);

  private knownColumnIds = new Set<string>();
  private pluginsMounted = false;
  private lastPluginKey = '';
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly parentInjector = inject(EnvironmentInjector);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly resolvedLocale = computed(() => mergeGridLocale(this.locale()));

  readonly emptyMessageText = computed(
    () => this.emptyMessage() ?? this.resolvedLocale().emptyMessage,
  );

  /** Schema from `[controller]` only — no binder overrides. */
  readonly effectiveColumns = computed(
    (): readonly ColumnOrGroupDef<T>[] => this.controller().columns,
  );

  readonly effectiveRowId = computed((): ((row: T, index: number) => string | number) => {
    return this.controller().rowId;
  });

  readonly effectiveSelectionMode = computed(
    (): SelectionMode => this.controller().selection,
  );

  readonly effectiveEditMode = computed(
    (): EditMode => this.controller().editMode(),
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

  /** Plugins come only from `[controller]` / `createGrid` / `setPlugins`. */
  readonly effectivePlugins = computed(
    (): readonly DataGridPlugin<T>[] => this.controller().plugins(),
  );

  /** Viewport / chrome accessors — templates + hosts read controller signals. */
  pagination(): boolean { return this.controller().viewport.pagination(); }
  pageSize(): number { return this.controller().viewport.pageSize(); }
  virtual(): boolean { return this.controller().viewport.virtual(); }
  rowHeight(): number { return this.controller().viewport.rowHeight(); }
  overscan(): number { return this.controller().viewport.overscan(); }
  stripe(): boolean { return this.controller().chrome.stripe(); }
  multiSort(): boolean { return this.controller().multiSort(); }
  floatingFilters(): boolean { return this.controller().chrome.floatingFilters(); }
  showToolbar(): boolean { return this.controller().chrome.showToolbar(); }
  columnReorder(): boolean { return this.controller().chrome.columnReorder(); }
  serverSide(): boolean { return this.controller().serverSide(); }
  contextMenu(): boolean { return this.controller().chrome.contextMenu(); }

  readonly showQuickFilterBar = computed(() => this.showToolbar());
  /** Host `[toolbarActions]` + plugin slot items, sorted by `order`. */
  readonly resolvedToolbarActions = computed((): readonly DataGridToolbarSlotItem[] => {
    const byId = new Map<string, DataGridToolbarSlotItem>();
    for (const item of this.session.kernel.toolbarSlotItems()) {
      byId.set(item.id, item);
    }
    for (const item of this.toolbarActions()) {
      byId.set(item.id, item);
    }
    return [...byId.values()].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
    );
  });

  readonly pasteEnabled = computed(() => this.session.kernel.pasteEnabled());
  /** Copy via `clipboardPlugin` (`slots.enableCopy`). */
  readonly copyEnabled = computed(() => this.session.kernel.copyEnabled());
  readonly aggregateRowEnabled = computed(() => this.session.kernel.capabilities.hasAggregate());
  readonly infiniteScrollEnabled = computed((): boolean =>
    this.session.kernel.capabilities.getInteractions().some((i) => i.id === 'infiniteScroll'),
  );

  readonly aggregateValues = computed((): Map<string, unknown> => {
    if (!this.aggregateRowEnabled()) return new Map();
    return this.session.kernel.capabilities.collectAggregates(
      this.session.processedRows(),
      this.columnLayoutHost.visibleColumns(),
    );
  });

  readonly colSpan = computed(
    () =>
      this.columnLayoutHost.visibleColumns().length +
      (this.selectionHost.showSelection() ? 1 : 0) +
      (this.viewportHost.rowDragEnabled() ? 1 : 0) +
      (this.effectiveEditMode() === 'fullRow' ? 1 : 0),
  );

  readonly statusBarVisible = computed(() =>
    this.session.kernel.statusBarSlotItems().some((item) => {
      try {
        return !!item.text();
      } catch {
        return false;
      }
    }),
  );

  /** Avoid duplicating "N rows" when statusBarPlugin already registers it. */
  readonly showPaginationRowCount = computed(
    () => this.pagination() && !this.session.kernel.statusBarSlotItems().some((item) => item.id === 'rows'),
  );

  readonly toolbarLabels = computed(() => toolbarLabelsFromLocale(this.resolvedLocale()));

  readonly statusBarLabels = computed(() => {
    const l = this.resolvedLocale();
    return { statusRows: l.statusRows, paginationLabel: l.paginationLabel, paginationPrev: l.paginationPrev, paginationNext: l.paginationNext };
  });

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
    this.session = createDataGridSession<T>({
      controller: () => this.controller(),
      data: () => this.data(),
      models: {
        selectedIds: this.selectedIds,
        quickFilter: this.quickFilter,
        hiddenColumnIds: this.hiddenColumnIds,
        findQuery: this.findQuery,
        rowForm: this.rowForm,
        rowEditSession: this.rowEditSession,
        rowEditDraft: this.rowEditDraft,
      },
      outputs: {
        sortChange: this.sortChange,
        filterChange: this.filterChange,
        cellEdit: this.cellEdit,
        rowEdit: this.rowEdit,
        rowEditStart: this.rowEditStart,
        rowEditCancel: this.rowEditCancel,
        rowClick: this.rowClick,
        selectionChange: this.selectionChange,
        queryChange: this.queryChange,
        stateChange: this.stateChange,
        columnOrderChange: this.columnOrderChange,
        contextMenuOpened: this.contextMenuOpened,
        contextMenuClosed: this.contextMenuClosed,
        findMatchesChange: this.findMatchesChange,
        rowReorder: this.rowReorder,
        nearEnd: this.nearEnd,
        paste: this.paste,
      },
      publish: (name, outputRef, payload) => this.publish(name, outputRef, payload),
      hostElement: () => this.host.nativeElement,
      injector: () => this.injector,
      parentInjector: () => this.parentInjector,
      externalFilter: () => this.externalFilter(),
      contextMenuItems: () => this.contextMenuItems(),
      contextMenuOverlayPresent: () => !!this.contextMenuOverlay(),
      contextMenuTemplate: () => this.contextMenuTemplate(),
      rowEditSchema: () => this.rowEditSchema(),
      createRowForm: () => this.createRowForm(),
      resolvedLocale: () => this.resolvedLocale(),
      getLocale: () => this.getLocale(),
    });
    this.api = this.session.api;
    this.columnLayoutHost = this.session.columnLayout;
    this.viewportHost = this.session.viewport;
    this.selectionHost = this.session.selection;
    this.editSyncHost = this.session.editSync;
    this.menuHost = this.session.menu;

    effect(() => {
      const cols = this.columnLayoutHost.resolvedColumns();
      if (!cols.length) {
        return;
      }
      const ids = cols.map((c) => c.id);
      const layout = this.columnLayoutHost.columnLayout();
      const nextLayout = reconcileColumnLayout(layout, cols);
      if (
        nextLayout.order.join('\0') !== layout.order.join('\0') ||
        JSON.stringify(nextLayout.pin) !== JSON.stringify(layout.pin)
      ) {
        this.columnLayoutHost.columnLayout.set(nextLayout);
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
      const max = this.viewportHost.totalPages() - 1;
      if (this.viewportHost.pageIndex() > max) {
        this.viewportHost.pageIndex.set(Math.max(0, max));
      }
    });

    // Keep find active index in range — emit from findMatchesChange only on query updates.
    effect(() => {
      const matches = this.viewportHost.findMatches();
      if (!matches.length) {
        if (this.viewportHost.findActiveIndex() !== 0) {
          this.viewportHost.findActiveIndex.set(0);
        }
        return;
      }
      if (this.viewportHost.findActiveIndex() >= matches.length) {
        this.viewportHost.findActiveIndex.set(0);
      }
    });

    afterNextRender(() => {
      this.measureViewport();
      this.observeViewportResize();
      // Imperative once — never reactivate from an effect (slot writes would loop).
      this.session.kernel.activatePlugins(this.effectivePlugins(), this.host.nativeElement);
      this.pluginsMounted = true;
      this.lastPluginKey = this.pluginListKey(this.effectivePlugins());
      this.publish('apiReady', this.apiReady, this.api);
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
      this.session.destroy();
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

  private measureViewport(): void {
    this.viewportHost.measureViewport();
  }

  getLocale(): DataGridLocale { return this.resolvedLocale(); }

  contextMenuTemplate() { return this.contextMenuOverlay()?.template ?? null; }

  trackRow(_viewIndex: number, item: DisplayRow<T>): string { return item.id; }

  cellValue(row: T, column: ColumnDef<T>, rowIndex: number): unknown {
    return getCellValue(row, column, rowIndex);
  }

  displayValue(value: unknown, row: T, column: ColumnDef<T>, rowIndex: number): string {
    return formatCellValue(value, row, column, rowIndex);
  }

  cellClass(row: T, column: ColumnDef<T>, rowIndex: number, value: unknown): string {
    const base = resolveBaseCellClass(value, row, column, rowIndex);
    const decorated = this.session.kernel.capabilities.resolveCellDecoratorClasses({
      row,
      rowId: this.effectiveRowId()(row, rowIndex),
      rowIndex,
      columnId: column.id ?? column.field ?? '',
      column,
      value,
    });
    return mergeCellClass(base, decorated);
  }

  cellDecoratorStyle(
    row: T,
    column: ColumnDef<T>,
    rowIndex: number,
    value: unknown,
  ): Record<string, string> {
    return this.session.kernel.capabilities.resolveCellDecoratorStyles({
      row,
      rowId: this.effectiveRowId()(row, rowIndex),
      rowIndex,
      columnId: column.id ?? column.field ?? '',
      column,
      value,
    });
  }

  cellTemplate(columnId: string) { return this.templateMap().get(columnId) ?? null; }
  headerTemplate(columnId: string) { return this.headerTemplateMap().get(columnId) ?? null; }

  isBooleanColumn = isBooleanColumn;
  isDateColumn = isDateColumn;
  isSelectEditor = isSelectEditor;

  readonly editorRegistry = new CellEditorRegistry(defaultCellEditorRegistry);

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
    return { value, row, rowIndex, column, columnId: column.id };
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
      draft: this.editSyncHost.editDraft(),
      setDraft: (next) => this.editSyncHost.editDraft.set(next),
      commit: () => this.editSyncHost.commitEdit(row, rowId, rowIndex, column),
      cancel: () => this.editSyncHost.cancelEdit(),
    };
  }

  formatAgg(value: unknown, column?: ResolvedColumn<T> | null): string {
    return formatAggregateValue(value, column);
  }

  aggValue(columnId: string): unknown { return this.aggregateValues().get(columnId); }

  rowClasses(row: T, rowIndex: number): string {
    return resolveRowClass(row, rowIndex, this.rowClass());
  }

  focusHeaderColumn(columnId: string): void {
    this.session.kernel.focus.focusCell(0, columnId, 'header');
  }

  focusFloatingFilterColumn(columnId: string): void {
    this.session.kernel.focus.focusCell(0, columnId, 'floatingFilter');
  }

  private headerRows(): number {
    return headerRowCountOf(
      this.columnLayoutHost.hasColumnGroups(),
      this.floatingFilters() && this.columnLayoutHost.hasFilters(),
    );
  }

  ariaRowCount(): number {
    return ariaRowCountOf(this.headerRows(), this.session.displayRows().length);
  }

  ariaColIndex(visibleColIndex: number): number {
    return ariaColIndexOf(
      visibleColIndex,
      this.viewportHost.rowDragEnabled(),
      this.selectionHost.showSelection(),
    );
  }

  ariaBodyRowIndex(displayIndex: number): number {
    return ariaBodyRowIndexOf(this.headerRows(), displayIndex);
  }

  cellAriaSelected(
    rowId: string | number,
    displayIndex: number,
    columnId: string,
  ): boolean | null {
    void this.session.kernel.capabilities.overlayPaintEpoch();
    return cellAriaSelectedOf(
      this.selectionHost.isSelected(rowId),
      this.api.getCellRange(),
      displayIndex,
      columnId,
      this.columnLayoutHost.visibleColumns().map((c) => c.id),
    );
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
    if (this.editSyncHost.isEditorEventTarget(event.target)) {
      return;
    }
    const focusIndex = displayIndex ?? rowIndex;
    this.session.kernel.focus.focusCell(focusIndex, column.id);
    this.publish('cellClick', this.cellClick, {
      row,
      rowId,
      rowIndex,
      column,
      columnId: column.id,
      value,
      event,
    });
    if (this.effectiveEditInteraction().pointerStart === 'click') {
      this.editSyncHost.startEdit(row, rowId, rowIndex, column, value);
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
    if (this.editSyncHost.isEditorEventTarget(event.target)) {
      return;
    }
    if (this.effectiveEditInteraction().pointerStart !== 'dblclick') {
      return;
    }
    this.editSyncHost.startEdit(row, rowId, rowIndex, column, value);
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

    const interaction = this.effectiveEditInteraction();
    const fullRowEditing =
      this.effectiveEditMode() === 'fullRow' && this.editSyncHost.rowEditMgr.editingId() != null;
    const passHorizontal =
      fullRowEditing &&
      interaction.arrowEditing === 'moveHorizontal' &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
    if (inField && !passHorizontal) {
      return;
    }

    if (!inField && this.editSyncHost.tryTypeToEdit(event)) {
      event.preventDefault();
      return;
    }

    if (this.session.kernel.focus.handleKeydown(event)) {
      event.preventDefault();
    }
  }

  onEscapeKey(event?: Event): void {
    const focus = this.session.kernel.focus.getFocus();
    if (focus && focusRealmOf(focus) === 'floatingFilter') {
      this.session.kernel.focus.focusCell(0, focus.columnId, 'header');
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    if (this.menuHost.columnMenuColumnId() || this.menuHost.contextMenuState()?.source === 'header') {
      this.menuHost.closeColumnMenu();
      this.menuHost.closeContextMenu();
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    if (this.api.getCellRange()) {
      this.api.clearCellRange();
      (event as KeyboardEvent | undefined)?.preventDefault?.();
      return;
    }
    const hadEdit = this.editSyncHost.editingCell() != null || this.editSyncHost.rowEditMgr.editingId() != null;
    const hadMenu = this.menuHost.contextMenuState() != null;
    this.editSyncHost.cancelActiveEdit();
    this.menuHost.closeContextMenu();
    if (hadEdit || hadMenu) {
      (event as KeyboardEvent | undefined)?.preventDefault?.();
    }
  }

  syncDomFocus(cell: FocusCell | null, opts?: { force?: boolean }): void {
    this.editSyncHost.syncDomFocus(cell, opts);
  }

  onGridFocusIn(event: FocusEvent): void { this.viewportHost.onGridFocusIn(event); }

  onCellContextMenu(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
    event: MouseEvent,
    displayIndex?: number,
  ): void {
    this.menuHost.onCellContextMenu(row, rowId, rowIndex, column, value, event, displayIndex);
  }

  onHeaderContextMenu(column: ResolvedColumn<T>, event: MouseEvent): void {
    this.menuHost.onHeaderContextMenu(column, event);
  }

  onDocumentPointerDown(event: Event): void { this.menuHost.onDocumentPointerDown(event); }

  private pluginListKey(plugins: readonly DataGridPlugin<T>[]): string { return plugins.map((p) => p.id ?? '').join('\0'); }

  onRowDragPointerDown(index: number, event: PointerEvent): void {
    this.viewportHost.onRowDragPointerDown(index, event);
  }

  /**
   * Fan-out: Angular `output()` + typed {@link DataGridApi.events} bus.
   * Hosts bind outputs; tool panels / plugins subscribe via `api.events`.
   */
  private publish<K extends keyof DataGridEventMap<T>>(
    name: K,
    outputRef: { emit(value: DataGridEventMap<T>[K]): void },
    payload: DataGridEventMap<T>[K],
  ): void {
    outputRef.emit(payload);
    this.api.events.emit(name, payload);
  }
}
