import { computed, linkedSignal, signal, type Signal, type WritableSignal } from '@angular/core';
import { attachColumnResize } from '../utils/column-interactions';
import {
  emptyColumnLayout,
  materializeColumnLayout,
  moveColumn,
  reconcileColumnLayout,
  resolveColumnTracks,
  setColumnPin,
  CHROME_TRACK,
  type ColumnLayout,
  type ColumnTrackLayout,
} from '../utils/column-layout';
import {
  buildLeafGroupMap,
  buildVisibleGroupHeaderRow,
  hasColumnGroups as defsHaveColumnGroups,
  resolveColumnOrGroupDefs,
  sameColumnGroup,
  type ColumnGroupMeta,
  type HeaderGroupCell,
} from '../utils/column-groups';
import { estimateColumnWidth } from '../utils/autosize';
import { downloadCsv, rowsToCsvExport, type CsvExportOptions } from '../utils/csv';
import {
  EMPTY_SET_FILTER_OPTIONS,
  collectSetFilterValues,
  type SetFilterOptions,
} from '../utils/filter-rows';
import {
  normalizeFilterModel,
  resolveFilterKind,
  sanitizeFilterState,
  type ColumnFilterModel,
} from '../utils/filter-model';
import { nextSortDirection } from '../utils/sort-rows';
import { GRID_STATE_VERSION, jsonEqual, sanitizeGridState } from '../utils/state';
import type { ColumnLayoutDeps } from './binder-surface';
import {
  ariaSortOf,
  columnWidthOf,
  pinnedLeftOffsetOf,
  pinnedRightOffsetOf,
  sortMarkerOf,
} from './binder-template.helpers';
import type {
  ColumnDef,
  ColumnPin,
  DataGridFilterState,
  DataGridState,
  ResolvedColumn,
  SetGridStateOptions,
  SortState,
} from '../components/data-grid/data-grid.types';

/**
 * Owns column-domain writables + derived layout/filter/sort computeds.
 * Binder passes lean deps (models, chrome flags, publish) — not a mega surface of every field.
 *
 * LOC may sit slightly over the default host ceiling while column track/chrome
 * computeds live here; F2 can split tracks if needed. Cap: 600.
 */
export class ColumnLayoutHost<T> {
  readonly sorts: WritableSignal<SortState[]> = signal<SortState[]>([]);
  readonly filters: WritableSignal<DataGridFilterState> = signal<DataGridFilterState>({});
  /**
   * Order + explicit pins — single layout source of truth. Reconciled with the
   * column defs whenever they change (surviving ids keep order / pin, new ids
   * append with their def pin) — no binder effect.
   */
  readonly columnLayout: WritableSignal<ColumnLayout> = linkedSignal<
    ResolvedColumn<T>[],
    ColumnLayout
  >({
    source: () => this.resolvedColumns(),
    computation: (cols, previous) => {
      const prev = previous?.value ?? emptyColumnLayout();
      return cols.length ? reconcileColumnLayout(prev, cols) : prev;
    },
    equal: jsonEqual,
  });
  readonly widthOverrides: WritableSignal<Record<string, number>> = signal<Record<string, number>>(
    {},
  );
  /** True while a column resize drag is active (`stateChange` waits for the drop). */
  readonly resizing: WritableSignal<boolean> = signal(false);

  private headerDragFrom: number | null = null;

  readonly resolvedColumns: Signal<ResolvedColumn<T>[]> = computed(() =>
    resolveColumnOrGroupDefs(this.s.effectiveColumns()),
  );

  readonly leafGroupMap: Signal<Map<string, ColumnGroupMeta>> = computed(() =>
    buildLeafGroupMap(this.s.effectiveColumns()),
  );

  readonly hasColumnGroups: Signal<boolean> = computed(() =>
    defsHaveColumnGroups(this.s.effectiveColumns()),
  );

  /** Group header cells aligned to current visible leaf order. */
  readonly groupHeaderRow: Signal<HeaderGroupCell[]> = computed(() => {
    if (!this.hasColumnGroups()) {
      return [];
    }
    return buildVisibleGroupHeaderRow(this.visibleColumns(), this.leafGroupMap());
  });

  readonly orderedColumns: Signal<ResolvedColumn<T>[]> = computed(() =>
    materializeColumnLayout(this.resolvedColumns(), this.columnLayout()),
  );

  readonly columnsById: Signal<Map<string, ResolvedColumn<T>>> = computed(() => {
    const map = new Map<string, ResolvedColumn<T>>();
    for (const col of this.resolvedColumns()) {
      map.set(col.id, col);
    }
    return map;
  });

  readonly visibleColumns: Signal<ResolvedColumn<T>[]> = computed(() => {
    const hidden = new Set(this.s.hiddenColumnIds());
    return this.orderedColumns().filter((c) => !hidden.has(c.id));
  });

  /** Stable id list for per-cell helpers (range / ARIA) — avoid `.map` per cell. */
  readonly visibleColumnIds: Signal<string[]> = computed(() =>
    this.visibleColumns().map((c) => c.id),
  );

  readonly filterableColumns: Signal<ResolvedColumn<T>[]> = computed(() =>
    this.orderedColumns().filter((c) => !!c.filter),
  );

  /** Per-column lazy set-filter option computeds (rebuilt when column defs change). */
  private readonly setFilterOptionCache = computed(() => {
    this.columnsById();
    return new Map<string, Signal<SetFilterOptions>>();
  });

  /**
   * Distinct set-filter values for one column — computed on first read and
   * memoized until `[data]` / columns change (closed dropdowns cost nothing).
   */
  getSetFilterOptions(columnId: string): SetFilterOptions {
    const cache = this.setFilterOptionCache();
    let options = cache.get(columnId);
    if (!options) {
      const column = this.columnsById().get(columnId);
      if (!column || resolveFilterKind(column) !== 'set') {
        return EMPTY_SET_FILTER_OPTIONS;
      }
      options = computed(() => collectSetFilterValues(this.s.data(), column));
      cache.set(columnId, options);
    }
    return options();
  }

  private readonly setFilterOptionGetters = new Map<string, () => SetFilterOptions>();

  /** Stable (per column id) getter for `DataGridFilterField.setOptions`. */
  readonly setFilterOptionsFn = (columnId: string): (() => SetFilterOptions) => {
    let getter = this.setFilterOptionGetters.get(columnId);
    if (!getter) {
      getter = () => this.getSetFilterOptions(columnId);
      this.setFilterOptionGetters.set(columnId, getter);
    }
    return getter;
  };

  readonly hasFilters: Signal<boolean> = computed(() =>
    this.resolvedColumns().some((c) => !!c.filter),
  );

  /**
   * Keep the row-edit track once full-row mode has been on, so toggling back to
   * cell edit does not reflow flex / fill columns.
   */
  readonly reserveRowEditColumn = linkedSignal({
    source: () => this.s.fullRowEdit(),
    computation: (fullRow, previous): boolean => fullRow || (previous?.value ?? false),
  });

  readonly reservedChromeWidth: Signal<number> = computed(() => {
    let w = 0;
    if (this.s.showSelection()) {
      w += CHROME_TRACK.select;
    }
    if (this.s.rowDragEnabled()) {
      w += CHROME_TRACK.drag;
    }
    if (this.reserveRowEditColumn()) {
      w += CHROME_TRACK.rowEdit;
    }
    return w;
  });

  /**
   * CSS Grid track list — every track resolved to px against the measured
   * scrollport width, so rows lay out identically whatever is rendered.
   */
  readonly columnTrackLayout: Signal<ColumnTrackLayout> = computed(() =>
    resolveColumnTracks(
      this.visibleColumns(),
      this.widthOverrides(),
      {
        drag: this.s.rowDragEnabled(),
        select: this.s.showSelection(),
        rowEdit: this.reserveRowEditColumn(),
      },
      this.s.viewportWidth(),
    ),
  );

  readonly gridTemplateColumns: Signal<string> = computed(() => this.columnTrackLayout().tracks);

  /** Rendered pixel widths (same numbers as the tracks) for pin offsets / resize. */
  readonly resolvedWidths: Signal<Record<string, number>> = computed(
    () => this.columnTrackLayout().widthsPx,
  );

  constructor(private readonly s: ColumnLayoutDeps<T>) {}

  toggleSort(column: ResolvedColumn<T>, event: MouseEvent): void {
    if (!column.sortable) {
      return;
    }
    this.activateHeaderSort(column.id, this.s.multiSort() && event.shiftKey);
  }

  /** Keyboard / API sort toggle (Enter on header). */
  activateHeaderSort(columnId: string, multi: boolean): void {
    const column = this.columnsById().get(columnId);
    if (!column?.sortable) {
      return;
    }
    const useMulti = this.s.multiSort() && multi;
    const existing = this.sorts();
    const current = existing.find((entry) => entry.columnId === column.id)?.direction ?? null;
    const next = nextSortDirection(current, useMulti);

    let sorts: SortState[];
    if (!useMulti) {
      sorts = next ? [{ columnId: column.id, direction: next }] : [];
    } else {
      const others = existing.filter((entry) => entry.columnId !== column.id);
      sorts = next ? [...others, { columnId: column.id, direction: next }] : others;
    }

    this.sorts.set(sorts);
    this.s.publishSort({ sorts });
    this.s.notifyPlugins('onSortChange', { sorts });
  }

  /** Set / clear a single-column sort (lean menu). */
  setColumnSort(columnId: string, direction: 'asc' | 'desc' | null): void {
    const column = this.columnsById().get(columnId);
    if (!column?.sortable) {
      return;
    }
    const sorts: SortState[] = direction
      ? [{ columnId: column.id, direction }]
      : this.sorts().filter((entry) => entry.columnId !== column.id);
    this.sorts.set(sorts);
    this.s.publishSort({ sorts });
    this.s.notifyPlugins('onSortChange', { sorts });
  }

  /** Set (or with `null` / an empty model, clear) one column's filter. */
  setColumnFilter(columnId: string, model: ColumnFilterModel | null): void {
    const normalized = normalizeFilterModel(model);
    const next = { ...this.filters() };
    if (normalized) {
      next[columnId] = normalized;
    } else if (columnId in next) {
      delete next[columnId];
    } else {
      return;
    }
    this.applyFilters(next);
  }

  getColumnFilter(columnId: string): ColumnFilterModel | null {
    return this.filters()[columnId] ?? null;
  }

  private applyFilters(next: DataGridFilterState): void {
    this.filters.set(next);
    this.s.publishFilter({ filters: next });
    this.s.notifyPlugins('onFilterChange', { filters: next });
  }

  setQuickFilter(value: string): void {
    this.s.quickFilter.set(value);
  }

  clearFilters(): void {
    this.filters.set({});
    this.s.quickFilter.set('');
    this.s.publishFilter({ filters: {} });
    this.s.notifyPlugins('onFilterChange', { filters: {} });
  }

  getFilterModel(): DataGridFilterState {
    return { ...this.filters() };
  }

  /** Replace all column filters; invalid / empty models are dropped. */
  setFilterModel(filters: DataGridFilterState): void {
    this.applyFilters(sanitizeFilterState(filters));
  }

  getSortModel(): SortState[] {
    return [...this.sorts()];
  }

  setSortModel(sorts: SortState[]): void {
    this.sorts.set([...sorts]);
    this.s.publishSort({ sorts: this.sorts() });
    this.s.notifyPlugins('onSortChange', { sorts: this.sorts() });
  }

  getQuickFilter(): string {
    return this.s.quickFilter();
  }

  setColumnVisible(columnId: string, visible: boolean): void {
    const set = new Set(this.s.hiddenColumnIds());
    if (visible) {
      set.delete(columnId);
    } else {
      if (
        this.visibleColumns().length <= 1 &&
        this.visibleColumns().some((c) => c.id === columnId)
      ) {
        return;
      }
      set.add(columnId);
    }
    const next = [...set];
    this.s.hiddenColumnIds.set(next);
  }

  showAllColumns(): void {
    this.s.hiddenColumnIds.set([]);
  }

  onColumnVisibility(event: { columnId: string; visible: boolean }): void {
    this.setColumnVisible(event.columnId, event.visible);
  }

  reorderVisibleColumns(from: number, to: number): void {
    const visible = this.visibleColumns();
    const fromCol = visible[from];
    const toCol = visible[to];
    if (!fromCol || !toCol) {
      return;
    }
    const hasGroups = defsHaveColumnGroups(this.s.effectiveColumns());
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

  setColumnPinned(columnId: string, pinned: ColumnPin | null): void {
    if (!this.columnLayout().order.includes(columnId) && !this.columnsById().has(columnId)) {
      return;
    }
    this.applyColumnLayout(setColumnPin(this.columnLayout(), columnId, pinned));
  }

  getColumnPinned(columnId: string): ColumnPin | null {
    return this.columnLayout().pin[columnId] ?? null;
  }

  applyColumnLayout(layout: ColumnLayout): void {
    this.columnLayout.set(layout);
    this.s.publishColumnOrder({ columnOrder: layout.order });
  }

  startResize(event: PointerEvent, column: ResolvedColumn<T>): void {
    this.beginResize(event, [column.id]);
  }

  startGroupResize(event: PointerEvent, cell: HeaderGroupCell): void {
    if (cell.columnId) {
      return;
    }
    const cols = this.visibleColumns();
    const from = cols.findIndex((c) => c.id === cell.startColumnId);
    const to = cols.findIndex((c) => c.id === cell.endColumnId);
    if (from < 0 || to < from) {
      return;
    }
    this.beginResize(
      event,
      cols.slice(from, to + 1).map((c) => c.id),
    );
  }

  /**
   * Lock only `columnIds` to their rendered px width, then drag them.
   * Delta is split evenly (1 column = normal resize; many = group resize).
   * Other columns keep their sizing — flex columns absorb the change.
   */
  beginResize(event: PointerEvent, columnIds: readonly string[]): void {
    event.preventDefault();
    event.stopPropagation();
    if (!columnIds.length) {
      return;
    }

    const byId = this.columnsById();
    const rendered = this.resolvedWidths();
    const locked: Record<string, number> = {};
    for (const id of columnIds) {
      const col = byId.get(id);
      locked[id] = Math.max(
        col?.minWidth ?? 48,
        rendered[id] ?? this.widthOverrides()[id] ?? col?.minWidth ?? 48,
      );
    }
    this.widthOverrides.set({ ...this.widthOverrides(), ...locked });

    const targets = columnIds.map((id) => ({
      id,
      start: locked[id]!,
      min: byId.get(id)?.minWidth ?? 48,
    }));
    const startTotal = targets.reduce((sum, t) => sum + t.start, 0);
    const minTotal = targets.reduce((sum, t) => sum + t.min, 0);

    this.resizing.set(true);
    attachColumnResize({
      startX: event.clientX,
      startWidth: startTotal,
      minWidth: minTotal,
      onWidth: (nextTotal) => {
        const share = (nextTotal - startTotal) / targets.length;
        this.widthOverrides.update((widths) => {
          const next = { ...widths };
          for (const t of targets) {
            next[t.id] = Math.max(t.min, Math.round(t.start + share));
          }
          return next;
        });
      },
      onEnd: () => this.resizing.set(false),
    });
  }

  onHeaderDragStart(index: number, event: DragEvent): void {
    if (!this.s.columnReorder()) {
      return;
    }
    this.headerDragFrom = index;
    event.dataTransfer?.setData('text/plain', String(index));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onHeaderDrop(toIndex: number, event: DragEvent): void {
    event.preventDefault();
    if (!this.s.columnReorder()) {
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
      defsHaveColumnGroups(this.s.effectiveColumns()) &&
      !sameColumnGroup(this.leafGroupMap(), fromCol.id, toCol.id)
    ) {
      return;
    }
    const layout = this.columnLayout();
    const moved = moveColumn(layout, fromCol.id, toCol.id);
    if (!moved) {
      return;
    }
    this.applyColumnLayout({ order: moved.order, pin: layout.pin });
  }

  autoSizeColumns(columnIds?: string[]): void {
    const targets = columnIds?.length
      ? this.visibleColumns().filter((c) => columnIds.includes(c.id))
      : this.visibleColumns();
    const rows = this.s.processedRows();
    const next = { ...this.widthOverrides() };
    for (const col of targets) {
      next[col.id] = estimateColumnWidth(col, rows);
    }
    this.widthOverrides.set(next);
  }

  /**
   * Download processed rows (filter + sort order) as CSV; returns the text
   * (without BOM). A string argument is the filename.
   */
  exportCsv(filenameOrOptions: string | CsvExportOptions<T> = {}): string {
    const options: CsvExportOptions<T> =
      typeof filenameOrOptions === 'string' ? { filename: filenameOrOptions } : filenameOrOptions;
    const byId = this.columnsById();
    const columns = options.columnKeys
      ? options.columnKeys.flatMap((id) => byId.get(id) ?? [])
      : this.visibleColumns().filter((c) => !c.suppressExport);
    const rows = options.onlySelected
      ? this.s.processedRows().filter((row) => this.s.isRowSelected(row))
      : this.s.processedRows();
    const csv = rowsToCsvExport(rows, columns, options);
    downloadCsv(options.filename ?? 'data-grid.csv', csv, { bom: options.bom });
    return csv;
  }

  /** Reactive snapshot (read inside `computed` — `api.state` memoizes it). */
  getState(): DataGridState {
    const layout = this.columnLayout();
    return {
      version: GRID_STATE_VERSION,
      sorts: this.sorts(),
      filters: this.filters(),
      quickFilter: this.s.quickFilter(),
      hiddenColumnIds: this.s.hiddenColumnIds(),
      columnOrder: [...layout.order],
      widthOverrides: this.widthOverrides(),
      columnPins: { ...layout.pin },
      ...this.s.getStateExtras(),
    };
  }

  /**
   * Apply a partial, possibly untrusted snapshot: invalid fields, `ignore`d keys
   * and unknown column ids are skipped. `initial` (mount-time `initialState`)
   * is silent; otherwise sort / filter changes publish + notify plugins.
   */
  setState(
    state: Partial<DataGridState>,
    options: SetGridStateOptions = {},
    initial = false,
  ): void {
    const cols = this.resolvedColumns();
    const next = sanitizeGridState(state, cols.length ? new Set(cols.map((c) => c.id)) : null);
    for (const key of options.ignore ?? []) {
      delete next[key];
    }
    const sortsChanged = !!next.sorts && !jsonEqual(next.sorts, this.sorts());
    const filtersChanged = !!next.filters && !jsonEqual(next.filters, this.filters());
    if (sortsChanged) {
      this.sorts.set(next.sorts!);
    }
    if (filtersChanged) {
      this.filters.set(next.filters!);
    }
    if (next.quickFilter !== undefined) {
      this.s.quickFilter.set(next.quickFilter);
    }
    if (next.hiddenColumnIds) {
      this.s.hiddenColumnIds.set(next.hiddenColumnIds);
    }
    if (next.columnOrder || next.columnPins) {
      const layout = this.columnLayout();
      const requested = {
        order: next.columnOrder ?? layout.order,
        pin: next.columnPins ?? layout.pin,
      };
      this.columnLayout.set(cols.length ? reconcileColumnLayout(requested, cols) : requested);
    }
    if (next.widthOverrides) {
      this.widthOverrides.set(next.widthOverrides);
    }
    // After filters: a filter change resets the page, the restored index wins.
    this.s.applyStateExtras(next, initial);
    if (initial) {
      return;
    }
    if (sortsChanged) {
      this.s.publishSort({ sorts: this.sorts() });
      this.s.notifyPlugins('onSortChange', { sorts: this.sorts() });
    }
    if (filtersChanged) {
      this.s.publishFilter({ filters: this.filters() });
      this.s.notifyPlugins('onFilterChange', { filters: this.filters() });
    }
  }

  getColumnsById(): Map<string, ColumnDef<any>> {
    return this.columnsById() as Map<string, ColumnDef<any>>;
  }

  getVisibleColumnIds(): string[] {
    return this.visibleColumns().map((c) => c.id);
  }

  columnWidth(column: ResolvedColumn<T>): number | null {
    return columnWidthOf(column, this.resolvedWidths());
  }

  pinnedLeftOffset(columnId: string): number {
    return pinnedLeftOffsetOf(
      columnId,
      this.visibleColumns(),
      this.resolvedWidths(),
      this.s.showSelection(),
      this.s.rowDragEnabled(),
    );
  }

  pinnedRightOffset(columnId: string): number {
    return pinnedRightOffsetOf(
      columnId,
      this.visibleColumns(),
      this.resolvedWidths(),
      this.reserveRowEditColumn(),
    );
  }

  ariaSort(columnId: string): 'ascending' | 'descending' | 'none' {
    return ariaSortOf(columnId, this.sorts());
  }

  sortMarker(columnId: string): string | null {
    return sortMarkerOf(columnId, this.sorts());
  }
}
