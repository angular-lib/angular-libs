import {
  afterNextRender,
  computed,
  linkedSignal,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {
  computeVirtualWindow,
  type VirtualWindow,
} from '../controllers/virtual-window';
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
import { leafHeaderRowIndex, type FocusCell } from '../controllers/focus';
import type { ResolvedColumn, SideBarConfig } from '../components/data-grid/data-grid.types';
import type { DisplayRow } from '../utils/row-display';
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

  readonly pageIndex = linkedSignal({
    source: () =>
      [
        this.s.data(),
        this.s.filters(),
        this.s.quickFilter(),
        this.s.pageSize(),
        this.s.externalFilter(),
      ] as const,
    computation: () => 0,
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
        !!this.s.quickFilter().trim() ||
        Object.values(this.s.filters()).some((v) => !!v?.trim()),
      displayIsFlat: !this.s.displayRows().some((row) => row.kind !== 'data'),
    }),
  );

  readonly rowGroupColumnIds: Signal<readonly string[]> = computed(
    () => this.boundRowGroupAdapter()?.columns() ?? [],
  );

  readonly totalPages: Signal<number> = computed(() => {
    if (!this.s.pagination()) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.s.displayRows().length / this.s.pageSize()));
  });

  readonly pagedDisplayRows: Signal<readonly DisplayRow<T>[]> = computed(() => {
    const rows = this.s.displayRows();
    if (!this.s.pagination()) {
      return rows;
    }
    const size = this.s.pageSize();
    const start = this.pageIndex() * size;
    return rows.slice(start, start + size);
  });

  readonly virtualEnabled: Signal<boolean> = computed(
    () => this.s.virtual() && !this.s.pagination(),
  );

  readonly virtualWindow: Signal<VirtualWindow> = computed((): VirtualWindow =>
    computeVirtualWindow({
      rowCount: this.pagedDisplayRows().length,
      rowHeight: this.s.rowHeight(),
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
  }

  /** Called by `infiniteScrollPlugin` via `api.notifyNearEnd()`. */
  notifyNearEnd(): void {
    this.s.publishNearEnd();
  }

  ensureRowVisible(rowIndex: number): void {
    if (this.s.pagination()) {
      const size = this.s.pageSize();
      const page = Math.floor(rowIndex / size);
      if (page !== this.pageIndex()) {
        this.goToPage(page);
      }
      return;
    }
    if (!this.virtualEnabled()) {
      return;
    }
    const top = rowIndex * this.s.rowHeight();
    const scroll = this.s.hostElement().querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    if (!scroll) {
      return;
    }
    if (top < scroll.scrollTop) {
      scroll.scrollTop = top;
    } else if (top + this.s.rowHeight() > scroll.scrollTop + scroll.clientHeight) {
      scroll.scrollTop = top - scroll.clientHeight + this.s.rowHeight();
    }
  }

  focusCell(rowIndex: number, columnId: string): void {
    this.s.kernel().focus.focusCell(rowIndex, columnId);
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

  scrollToActiveFind(): void {
    const match = this.activeFindMatch();
    if (!match) {
      return;
    }

    const absoluteDisplayIndex = this.s.displayRows().findIndex(
      (item) => item.kind === 'data' && item.rowId === match.rowId,
    );
    const scrollIndex = absoluteDisplayIndex >= 0 ? absoluteDisplayIndex : match.rowIndex;

    if (this.s.pagination()) {
      const page = Math.floor(scrollIndex / this.s.pageSize());
      if (page !== this.pageIndex()) {
        this.pageIndex.set(page);
      }
    } else if (this.virtualEnabled()) {
      const top = Math.max(0, scrollIndex * this.s.rowHeight() - this.s.rowHeight() * 2);
      this.scrollTop.set(top);
      const scroll = this.s.hostElement().querySelector('.al-data-grid__scroll') as HTMLElement | null;
      if (scroll) {
        scroll.scrollTop = top;
      }
    }
    afterNextRender(() => {
      const el = this.s.hostElement().querySelector(
        `[data-testid="al-dg-cell-${match.rowId}-${match.columnId}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const focusIndex = this.pagedDisplayRows().findIndex(
        (item) => item.kind === 'data' && item.rowId === match.rowId,
      );
      if (focusIndex >= 0) {
        this.s.kernel().focus.focusCell(focusIndex, match.columnId);
      }
    }, { injector: this.s.injector() });
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
