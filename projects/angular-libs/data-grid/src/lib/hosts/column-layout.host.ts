import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { attachColumnResize } from '../utils/column-interactions';
import {
  emptyColumnLayout,
  materializeColumnLayout,
  moveColumn,
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
import { downloadCsv, rowsToCsv } from '../utils/csv';
import { collectSetFilterValues } from '../utils/filter-rows';
import { nextSortDirection } from '../utils/sort-rows';
import { createEmptyGridState } from '../utils/state';
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
  /** Order + explicit pins — single layout source of truth. */
  readonly columnLayout: WritableSignal<ColumnLayout> = signal<ColumnLayout>(emptyColumnLayout());
  readonly widthOverrides: WritableSignal<Record<string, number>> = signal<Record<string, number>>(
    {},
  );

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

  readonly filterableColumns: Signal<ResolvedColumn<T>[]> = computed(() =>
    this.orderedColumns().filter((c) => !!c.filter),
  );

  /** Set-filter option lists for sidebar / shared filter field (keyed by column id). */
  readonly setFilterOptionsById: Signal<Map<string, string[]>> = computed(() => {
    const map = new Map<string, string[]>();
    const rows = this.s.data();
    for (const col of this.filterableColumns()) {
      if (col.filter === 'set') {
        map.set(col.id, collectSetFilterValues(rows, col));
      }
    }
    return map;
  });

  readonly hasFilters: Signal<boolean> = computed(() =>
    this.resolvedColumns().some((c) => !!c.filter),
  );

  readonly reservedChromeWidth: Signal<number> = computed(() => {
    let w = 0;
    if (this.s.showSelection()) {
      w += CHROME_TRACK.select;
    }
    if (this.s.rowDragEnabled()) {
      w += CHROME_TRACK.drag;
    }
    if (this.s.fullRowEdit()) {
      w += CHROME_TRACK.rowEdit;
    }
    return w;
  });

  /** CSS Grid track list — flex columns use `fr`, no viewport width measure. */
  readonly columnTrackLayout: Signal<ColumnTrackLayout> = computed(() =>
    resolveColumnTracks(this.visibleColumns(), this.widthOverrides(), {
      drag: this.s.rowDragEnabled(),
      select: this.s.showSelection(),
      rowEdit: this.s.fullRowEdit(),
    }),
  );

  readonly gridTemplateColumns: Signal<string> = computed(() => this.columnTrackLayout().tracks);

  /** Pixel widths for pin offsets / resize; flex tracks are null → use minWidth. */
  readonly resolvedWidths: Signal<Record<string, number>> = computed(() => {
    const { widthsPx } = this.columnTrackLayout();
    const out: Record<string, number> = {};
    for (const col of this.visibleColumns()) {
      out[col.id] = widthsPx[col.id] ?? col.minWidth;
    }
    return out;
  });

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
    this.s.publishSort(sorts);
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onSortChange', sorts);
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
    this.s.publishSort(sorts);
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onSortChange', sorts);
  }

  setFilter(columnId: string, value: string): void {
    const next = { ...this.filters(), [columnId]: value };
    if (!value) {
      delete next[columnId];
    }
    this.filters.set(next);
    this.s.publishFilter(next);
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onFilterChange', next);
  }

  setQuickFilter(value: string): void {
    this.s.quickFilter.set(value);
    this.s.emitState();
    this.s.emitQueryIfServer();
  }

  clearFilters(): void {
    this.filters.set({});
    this.s.quickFilter.set('');
    this.s.publishFilter({});
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onFilterChange', {});
  }

  getFilterModel(): DataGridFilterState {
    return { ...this.filters() };
  }

  setFilterModel(filters: DataGridFilterState): void {
    this.filters.set({ ...filters });
    this.s.publishFilter(this.filters());
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onFilterChange', this.filters());
  }

  getSortModel(): SortState[] {
    return [...this.sorts()];
  }

  setSortModel(sorts: SortState[]): void {
    this.sorts.set([...sorts]);
    this.s.publishSort(this.sorts());
    this.s.emitState();
    this.s.emitQueryIfServer();
    this.s.notifyPlugins('onSortChange', this.sorts());
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
    this.s.emitState();
  }

  showAllColumns(): void {
    this.s.hiddenColumnIds.set([]);
    this.s.emitState();
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
    this.s.publishColumnOrder(layout.order);
    this.s.emitState();
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
   * Lock every column to its rendered px width, then drag `columnIds`.
   * Delta is split evenly (1 column = normal resize; many = group resize).
   */
  beginResize(event: PointerEvent, columnIds: readonly string[]): void {
    event.preventDefault();
    event.stopPropagation();
    if (!columnIds.length) {
      return;
    }

    const byId = this.columnsById();
    const locked: Record<string, number> = { ...this.widthOverrides() };
    const root = this.s.hostElement();
    for (const col of this.visibleColumns()) {
      const el = root.querySelector(
        `[data-testid="al-dg-col-${CSS.escape(col.id)}"]`,
      ) as HTMLElement | null;
      locked[col.id] = Math.max(
        col.minWidth,
        Math.round(el?.getBoundingClientRect().width ?? locked[col.id] ?? col.minWidth),
      );
    }
    this.widthOverrides.set(locked);

    const targets = columnIds.map((id) => ({
      id,
      start: locked[id]!,
      min: byId.get(id)?.minWidth ?? 48,
    }));
    const startTotal = targets.reduce((sum, t) => sum + t.start, 0);
    const minTotal = targets.reduce((sum, t) => sum + t.min, 0);

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
      onEnd: () => this.s.emitState(),
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
    this.s.emitState();
  }

  exportCsv(filename = 'data-grid.csv'): string {
    const csv = rowsToCsv(this.s.processedRows(), this.visibleColumns());
    downloadCsv(filename, csv);
    return csv;
  }

  getState(): DataGridState {
    const layout = this.columnLayout();
    const extras = this.s.getStateExtras();
    return {
      sorts: this.sorts(),
      filters: this.filters(),
      quickFilter: this.s.quickFilter(),
      hiddenColumnIds: this.s.hiddenColumnIds(),
      columnOrder: [...layout.order],
      widthOverrides: this.widthOverrides(),
      columnPins: { ...layout.pin },
      pageIndex: extras.pageIndex,
      activeSidePanel: extras.activeSidePanel,
    };
  }

  setState(state: Partial<DataGridState>): void {
    const base = { ...createEmptyGridState(), ...this.getState(), ...state };
    this.sorts.set(base.sorts);
    this.filters.set(base.filters);
    this.s.quickFilter.set(base.quickFilter);
    this.s.hiddenColumnIds.set(base.hiddenColumnIds);
    this.columnLayout.set({
      order: base.columnOrder ?? [],
      pin: base.columnPins ?? {},
    });
    this.widthOverrides.set(base.widthOverrides);
    this.s.applyStateExtras({
      pageIndex: base.pageIndex,
      activeSidePanel: base.activeSidePanel,
    });
    this.s.emitState();
    this.s.emitQueryIfServer();
  }

  setFilterOptions(column: ResolvedColumn<T>): string[] {
    return collectSetFilterValues(this.s.data(), column);
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
      this.s.fullRowEdit(),
    );
  }

  ariaSort(columnId: string): 'ascending' | 'descending' | 'none' {
    return ariaSortOf(columnId, this.sorts());
  }

  sortMarker(columnId: string): string | null {
    return sortMarkerOf(columnId, this.sorts());
  }
}
