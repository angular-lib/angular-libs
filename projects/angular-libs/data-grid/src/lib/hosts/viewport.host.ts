import {
  computed,
  linkedSignal,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  computeVirtualWindow,
  rowsFittingHeight,
  type VirtualWindow,
} from '../controllers/virtual-window';
import {
  displayRowElementOf,
  measureScrollInsets,
  nextPageIndex,
  revealCellOffsets,
  ScrollFocusKeeper,
} from './viewport-dom';
import { bodyCellElementOf } from './edit-focus';
import { formatCellValue } from '../utils/cell-value';
import { collectFindMatches, splitFindHighlight, type FindMatch } from '../utils/find';
import {
  attachRowReorder,
  buildRowReorderEvent,
  isRowDragAllowed,
  resolveRowDropDataIndex,
} from '../utils/row-interactions';
import type { ViewportDeps } from './binder-surface';
import type {
  BoundRowGroupAdapter,
  BoundTreeDataAdapter,
} from '../api/grid-api';
import { focusRealmOf, leafHeaderRowIndex, type FocusCell } from '../controllers/focus';
import type { ResolvedColumn, SideBarConfig } from '../components/data-grid/data-grid.types';
import {
  countPaginationSlots,
  pageIndexForDisplayIndex,
  paginateDisplayRows,
  resolveDisplayRowHeight,
  type DisplayRow,
} from '../utils/row-display';
import {
  groupHeaderLeafIdsOf,
  isBodyRowFocusedOf,
  isCellFocusedOf,
  isFloatingFilterFocusedOf,
  isGroupHeaderCellFocusedOf,
  isHeaderFocusedOf,
} from './binder-template.helpers';
import { collectAllGroupIds } from '../utils/collect-group-ids';

/**
 * Owns scroll / paging / find / virtual window / group collapse / row drag / sidebar panel.
 * LOC may sit over the default host ceiling while find+virtual computeds live here (F2); cap: 600.
 */
export class ViewportHost<T> {
  readonly scrollTop: WritableSignal<number> = signal(0);
  readonly viewportHeight: WritableSignal<number> = signal(480);
  readonly viewportWidth: WritableSignal<number> = signal(800);
  readonly focusedCell: WritableSignal<FocusCell | null> = signal<FocusCell | null>(null);
  readonly findActiveIndex: WritableSignal<number> = signal(0);
  readonly collapsedGroupIds: WritableSignal<ReadonlySet<string>> = signal<ReadonlySet<string>>(
    new Set(),
  );
  readonly boundRowGroupAdapter: WritableSignal<BoundRowGroupAdapter | null> = signal(null);
  readonly boundTreeDataAdapter: WritableSignal<BoundTreeDataAdapter | null> = signal(null);
  readonly rowDragFromIndex: WritableSignal<number | null> = signal<number | null>(null);
  readonly rowDragOverIndex: WritableSignal<number | null> = signal<number | null>(null);

  private rowDragCleanup: (() => void) | null = null;
  /** Parks / restores DOM focus when virtualization recycles the focused row (V2). */
  private readonly focusKeeper = new ScrollFocusKeeper({
    host: () => this.s.hostElement(),
    injector: () => this.s.injector(),
    enabled: () => this.virtualEnabled(),
    focusedCellElement: () => {
      const cell = this.focusedCell();
      if (!cell || focusRealmOf(cell) !== 'body') {
        return null;
      }
      const item = this.pagedDisplayRows()[cell.rowIndex];
      return item ? bodyCellElementOf(this.s.hostElement(), item, cell.columnId) : null;
    },
  });

  /**
   * Resets to page 0 when the row set changes meaning (filters / quick filter /
   * external filter / page size). Data edits, transactions and sorts keep the
   * page, clamped to the last page.
   */
  readonly pageIndex = linkedSignal({
    source: () => ({
      filters: this.s.filters(),
      quickFilter: this.s.quickFilter(),
      pageSize: this.s.pageSize(),
      externalFilter: this.s.externalFilter(),
      totalPages: this.totalPages(),
    }),
    computation: (src, previous): number => nextPageIndex(src, previous),
  });

  readonly activeSidePanel = linkedSignal({
    source: () => ({
      cfg: this.s.sideBarConfig(),
      panels: this.s.sidebarSlotItems(),
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
        if (requested === null) {
          return null;
        }
        if (panels.some((p) => p.id === requested)) {
          return requested;
        }
      }
      return panels[0]?.id ?? null;
    },
  });

  readonly findEnabled: Signal<boolean> = computed((): boolean => !!this.s.kernel().findConfig());
  readonly findCaseSensitiveEffective: Signal<boolean> = computed(
    (): boolean => !!this.s.kernel().findConfig()?.caseSensitive,
  );

  readonly findMatches: Signal<FindMatch[]> = computed((): FindMatch[] => {
    if (!this.findEnabled() || !this.s.findQuery().trim()) {
      return [];
    }
    return collectFindMatches(this.s.processedRows(), this.s.visibleColumns(), this.s.findQuery(), {
      caseSensitive: this.findCaseSensitiveEffective(),
      rowId: (row, index) => this.s.resolveRowId(row, index),
    });
  });

  readonly findMatchKeys: Signal<ReadonlySet<string>> = computed(() => {
    const set = new Set<string>();
    for (const m of this.findMatches()) {
      set.add(`${m.rowId}::${m.columnId}`);
    }
    return set;
  });

  readonly activeFindMatch: Signal<FindMatch | null> = computed((): FindMatch | null => {
    const matches = this.findMatches();
    if (!matches.length) {
      return null;
    }
    const idx = ((this.findActiveIndex() % matches.length) + matches.length) % matches.length;
    return matches[idx] ?? null;
  });

  readonly resolvedSideBarConfig: Signal<boolean | SideBarConfig | null> = computed(
    (): boolean | SideBarConfig | null => this.s.sideBarConfig(),
  );

  readonly sideBarEnabled: Signal<boolean> = computed(() => !!this.resolvedSideBarConfig());
  readonly sideBarPosition: Signal<'left' | 'right'> = computed(() => {
    const cfg = this.resolvedSideBarConfig();
    return typeof cfg === 'object' && cfg?.position ? cfg.position : 'right';
  });

  /** Row drag only when the display model is flat (no active group/tree headers). */
  readonly rowDragEnabled: Signal<boolean> = computed(() =>
    isRowDragAllowed({
      pluginEnabled: this.s.kernel().rowDragEnabled(),
      serverSide: this.s.serverSide(),
      hasActiveSort: this.s.hasActiveSort(),
      hasActiveFilter:
        !!this.s.externalFilter() ||
        !!this.s.quickFilter().trim() ||
        Object.values(this.s.filters()).some((v) => !!v?.trim()),
      displayIsFlat: !this.s.displayRows().some((row) => row.kind !== 'data'),
    }),
  );

  readonly rowGroupColumnIds: Signal<readonly string[]> = computed(
    () => this.boundRowGroupAdapter()?.columns() ?? [],
  );

  /** Server pagination: `[data]` is the current page, `serverRowCount` the total (V5). */
  readonly serverPaging: Signal<boolean> = computed(
    () => this.s.pagination() && this.s.serverSide() && this.s.serverRowCount() != null,
  );

  /** Total row count for status / ARIA (server total when known). */
  readonly totalRowCount: Signal<number> = computed(
    () => (this.s.serverSide() ? this.s.serverRowCount() : null) ?? this.s.processedRows().length,
  );

  readonly totalPages: Signal<number> = computed(() => {
    if (!this.s.pagination()) {
      return 1;
    }
    const count = this.serverPaging()
      ? (this.s.serverRowCount() ?? 0)
      : countPaginationSlots(this.s.displayRows());
    return Math.max(1, Math.ceil(count / this.s.pageSize()));
  });

  readonly pagedDisplayRows: Signal<readonly DisplayRow<T>[]> = computed(() =>
    this.s.pagination() && !this.serverPaging()
      ? paginateDisplayRows(this.s.displayRows(), this.pageIndex(), this.s.pageSize())
      : this.s.displayRows(),
  );

  /** Rows before the current page (ARIA row index offset). */
  readonly ariaRowOffset: Signal<number> = computed(() => {
    if (this.serverPaging()) {
      return this.pageIndex() * this.s.pageSize();
    }
    if (!this.s.pagination()) {
      return 0;
    }
    const first = this.pagedDisplayRows()[0];
    return first ? Math.max(0, this.s.displayRows().indexOf(first)) : 0;
  });

  /** `aria-rowcount` body rows: every display row, or the server total. */
  readonly ariaBodyRowCount: Signal<number> = computed(() =>
    this.serverPaging()
      ? Math.max(this.s.serverRowCount() ?? 0, this.ariaRowOffset() + this.pagedDisplayRows().length)
      : this.s.displayRows().length,
  );

  readonly virtualEnabled: Signal<boolean> = computed(
    () => this.s.virtual() && !this.s.pagination(),
  );

  /** Per-display-row heights (uniform unless plugin rows set `height`). */
  readonly displayRowHeights: Signal<readonly number[]> = computed(() => {
    const defaultH = this.s.rowHeight();
    return this.pagedDisplayRows().map((row) => resolveDisplayRowHeight(row, defaultH));
  });

  readonly virtualWindow: Signal<VirtualWindow> = computed((): VirtualWindow =>
    computeVirtualWindow({
      rowCount: this.pagedDisplayRows().length,
      rowHeight: this.s.rowHeight(),
      rowHeights: this.displayRowHeights(),
      scrollTop: this.scrollTop(),
      viewportHeight: this.viewportHeight(),
      overscan: this.s.overscan(),
      enabled: this.virtualEnabled(),
    }),
  );

  readonly renderedStart: Signal<number> = computed(() => this.virtualWindow().start);
  readonly renderedRows: Signal<readonly DisplayRow<T>[]> = computed(() => {
    const window = this.virtualWindow();
    return this.pagedDisplayRows().slice(window.start, window.end);
  });

  constructor(private readonly s: ViewportDeps<T>) {}

  goToPage(index: number): void {
    this.pageIndex.set(Math.max(0, Math.min(this.totalPages() - 1, index)));
    const scroll = this.getScrollRoot();
    if (scroll) {
      scroll.scrollTop = 0;
    }
    this.scrollTop.set(0);
    this.s.emitState();
    this.s.emitQueryIfServer();
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.scrollTop.set(el.scrollTop);
    const height = el.clientHeight || 480;
    if (this.viewportHeight() !== height) {
      this.viewportHeight.set(height);
    }
    this.focusKeeper.onScroll();
  }

  /** Called by `infiniteScrollPlugin` via `api.notifyNearEnd()`. */
  notifyNearEnd(): void {
    this.s.publishNearEnd();
  }

  /**
   * Scroll so a body cell is fully visible: below the sticky header block, above
   * the aggregate footer and between pinned column bands. Same path for paged,
   * non-virtual and virtual modes. Updates `scrollTop` synchronously so the virtual
   * window renders the target before DOM focus syncs (V1/V2).
   */
  scrollCellIntoView(rowIndex: number, columnId?: string | null): void {
    const scroll = this.getScrollRoot();
    const item = this.pagedDisplayRows()[rowIndex];
    if (!scroll || !item) {
      return;
    }
    const next = revealCellOffsets({
      scroll,
      rowIndex,
      rowEl: displayRowElementOf(scroll, item),
      columnId: columnId ?? null,
      rowHeight: this.s.rowHeight(),
      rowHeights: this.displayRowHeights(),
      viewportHeight: this.viewportHeight(),
      viewportWidth: this.viewportWidth(),
    });
    if (next.left != null) {
      scroll.scrollLeft = next.left;
    }
    if (next.top != null) {
      scroll.scrollTop = next.top;
      this.scrollTop.set(scroll.scrollTop);
    }
  }

  /** PageUp/PageDown step: rows that fit in the body (scroller minus header/footer). */
  pageRowCount(): number {
    const scroll = this.getScrollRoot();
    const insets = scroll ? measureScrollInsets(scroll) : { top: 0, bottom: 0 };
    const height = (scroll?.clientHeight || this.viewportHeight()) - insets.top - insets.bottom;
    const start = this.focusedCell()?.rowIndex ?? 0;
    return rowsFittingHeight(start, height, this.s.rowHeight(), this.displayRowHeights());
  }

  focusCell(rowIndex: number, columnId: string): void {
    this.s.kernel().focus.focusCell(rowIndex, columnId);
  }

  focusRow(rowId: string | number, columnId: string): boolean {
    const index = this.pagedDisplayRows().findIndex((row) => row.kind === 'data' && row.rowId === rowId);
    if (index < 0) return false;
    this.s.kernel().focus.focusCell(index, columnId, 'body');
    return true;
  }

  getFocusedCell() {
    return this.focusedCell();
  }

  getPagedDisplayRows(): readonly DisplayRow<T>[] {
    return this.pagedDisplayRows();
  }

  resolveRowId(row: T, index: number): string | number {
    return this.s.resolveRowId(row, index);
  }

  getCellElement(rowId: string | number, columnId: string): HTMLElement | null {
    const root = this.s.hostElement();
    const rid = cssEscapeAttr(String(rowId));
    const cid = cssEscapeAttr(columnId);
    const byTestId = root.querySelector(
      `[data-testid="al-dg-cell-${rid}-${cid}"]`,
    ) as HTMLElement | null;
    if (byTestId) {
      return byTestId;
    }
    return root.querySelector(
      `[data-row-id="${rid}"][data-column-id="${cid}"]`,
    ) as HTMLElement | null;
  }

  getScrollRoot(): HTMLElement | null {
    return this.s.hostElement().querySelector('.al-data-grid__scroll') as HTMLElement | null;
  }

  setFindQuery(value: string): void {
    this.s.findQuery.set(value);
    this.findActiveIndex.set(0);
    this.s.publishFindMatches([...this.findMatches()]);
  }

  findNext(): void {
    this.s.kernel().find.next();
  }

  findPrev(): void {
    this.s.kernel().find.prev();
  }

  focusFindInput(): void {
    const input = this.s.hostElement().querySelector(
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
    return splitFindHighlight(text, this.s.findQuery(), this.findCaseSensitiveEffective());
  }

  getFindMatches(): readonly FindMatch[] {
    return this.findMatches();
  }

  /** Switch page if needed, then focus the match — focus scrolls it fully into view. */
  scrollToActiveFind(): void {
    const match = this.activeFindMatch();
    if (!match) {
      return;
    }
    const isMatch = (item: DisplayRow<T>) => item.kind === 'data' && item.rowId === match.rowId;
    if (this.s.pagination() && !this.serverPaging()) {
      const absolute = this.s.displayRows().findIndex(isMatch);
      const index = absolute >= 0 ? absolute : match.rowIndex;
      const page = pageIndexForDisplayIndex(this.s.displayRows(), index, this.s.pageSize());
      if (page !== this.pageIndex()) {
        this.pageIndex.set(page);
      }
    }
    const focusIndex = this.pagedDisplayRows().findIndex(isMatch);
    if (focusIndex >= 0) {
      this.s.kernel().focus.focusCell(focusIndex, match.columnId);
    }
  }

  /** Tab / focusin on the grid frame — restore last cell or default (K4). */
  onGridFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || !this.s.hostElement().contains(target)) {
      return;
    }
    if (
      target.closest(
        '.al-data-grid__td, .al-data-grid__th, .al-data-grid__edit-input, .al-data-grid__filter-field, al-data-grid-toolbar, al-data-grid-find-bar',
      )
    ) {
      return;
    }
    if (this.focusKeeper.parking) {
      return;
    }
    if (target.classList.contains('al-data-grid__frame') || target === this.s.hostElement()) {
      this.s.kernel().focus.restoreOrFocusDefault();
    }
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
    if (adapter) {
      adapter.collapseAll(
        collectAllGroupIds(
          this.s.processedRows(),
          adapter.columns(),
          this.s.rowModelContext().columnsById,
        ),
      );
      return;
    }
    const all = this.s.kernel().capabilities.buildDisplayRows(this.s.processedRows(), {
      ...this.s.rowModelContext(),
      collapsedGroupIds: new Set(),
    });
    const ids = all.filter((row) => row.kind === 'group').map((row) => row.id);
    this.collapsedGroupIds.set(new Set(ids));
  }

  bindRowGroupAdapter(adapter: BoundRowGroupAdapter | null): void {
    this.boundRowGroupAdapter.set(adapter);
  }

  bindTreeDataAdapter(adapter: BoundTreeDataAdapter | null): void {
    this.boundTreeDataAdapter.set(adapter);
  }

  measureViewport(): void {
    const scroll = this.s.hostElement().querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    if (!scroll) {
      return;
    }
    const width = scroll.clientWidth || 800;
    const height = scroll.clientHeight || 480;
    if (this.viewportWidth() !== width) {
      this.viewportWidth.set(width);
    }
    if (this.viewportHeight() !== height) {
      this.viewportHeight.set(height);
    }
  }

  isCellFocused(rowIndex: number, columnId: string): boolean {
    return isCellFocusedOf(this.focusedCell(), rowIndex, columnId);
  }

  isBodyRowFocused(displayIndex: number): boolean {
    return isBodyRowFocusedOf(this.focusedCell(), displayIndex);
  }

  focusBodyRow(displayIndex: number): void {
    const columnId = this.s.visibleColumns()[0]?.id ?? '';
    this.s.kernel().focus.focusCell(displayIndex, columnId, 'body');
  }

  isHeaderFocused(columnId: string): boolean {
    return isHeaderFocusedOf(
      this.focusedCell(),
      columnId,
      leafHeaderRowIndex(this.s.hasColumnGroups()),
    );
  }

  isGroupHeaderCellFocused(cell: {
    columnId?: string;
    startColumnId?: string;
    endColumnId?: string;
  }): boolean {
    if (!this.s.hasColumnGroups()) {
      return false;
    }
    return isGroupHeaderCellFocusedOf(
      this.focusedCell(),
      cell,
      this.s.visibleColumns().map((c) => c.id),
    );
  }

  groupHeaderLeafIds(cell: {
    columnId?: string;
    startColumnId?: string;
    endColumnId?: string;
  }): string {
    return groupHeaderLeafIdsOf(
      cell,
      this.s.visibleColumns().map((c) => c.id),
    );
  }

  isFloatingFilterFocused(columnId: string): boolean {
    return isFloatingFilterFocusedOf(this.focusedCell(), columnId);
  }

  destroyRowDrag(): void {
    this.rowDragCleanup?.();
    this.rowDragCleanup = null;
  }

  /**
   * Pointer-based row reorder (HTML5 DnD is unreliable on sticky cells in overflow scrollers).
   */
  onRowDragPointerDown(index: number, event: PointerEvent): void {
    if (!this.rowDragEnabled() || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.rowDragCleanup?.();
    this.rowDragFromIndex.set(index);
    this.rowDragOverIndex.set(index);

    const scroll = this.s.hostElement().querySelector(
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
          rowHeight: this.s.rowHeight(),
          contentOffsetY: thead?.offsetHeight ?? 0,
          displayRows: this.pagedDisplayRows(),
        });
      },
      onOver: (over) => this.rowDragOverIndex.set(over),
      onDrop: (from, to) => {
        const payload = buildRowReorderEvent(
          this.s.processedRows(),
          from,
          to,
          (row, i) => this.s.resolveRowId(row, i),
          this.s.data(),
        );
        if (payload) {
          this.s.publishRowReorder(payload);
        }
      },
      onEnd: () => {
        this.rowDragCleanup = null;
        this.rowDragFromIndex.set(null);
        this.rowDragOverIndex.set(null);
      },
    });
  }
}

function cssEscapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
