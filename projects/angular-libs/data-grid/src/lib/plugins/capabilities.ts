/**
 * Capability contracts — plugins register real contributions here,
 * instead of flipping host feature flags.
 */

import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  CellRange,
  ColumnDef,
  DataGridContextMenuContext,
  DataGridContextMenuItem,
} from '../components/data-grid/data-grid.types';
import type { CustomDisplayRow, DisplayRow } from '../utils/row-display';
import { wrapDataRows } from '../utils/row-display';

export interface RowModelContext<T = unknown> {
  columnsById: Map<string, ColumnDef<T>>;
  /**
   * Grid row id. In a mounted grid this resolves the row's **source** index
   * (position in `[data]`) itself; the `index` argument is only a fallback for
   * rows not in the source array.
   */
  rowId: (row: T, index: number) => string | number;
  /**
   * Collapsed group / tree node ids from the grid's single expansion store
   * ({@link GridCapabilities.groupExpansion}). Display builders must read this
   * rather than their own adapter state.
   */
  readonly collapsedGroupIds: ReadonlySet<string>;
}

/**
 * Expand/collapse state for group / tree node ids. One store is active per grid:
 * the active display builder's `expansion`, else a grid-owned fallback.
 */
export interface GroupExpansionStore {
  collapsedIds(): ReadonlySet<string>;
  toggleCollapsed(groupId: string): void;
  expandAll(): void;
  collapseAll(allGroupIds: readonly string[]): void;
}

/**
 * Data-stage: runs on `T[]` after filter/sort (order ascending).
 */
export interface RowModelDataStage<T = unknown> {
  id: string;
  order?: number;
  transform: (rows: readonly T[], ctx: RowModelContext<T>) => readonly T[];
}

/**
 * Display builder: maps processed `T[]` → `DisplayRow[]`.
 * Later registration wins when multiple register (dedupe by id).
 */
export interface RowModelDisplayBuilder<T = unknown> {
  id: string;
  build: (rows: readonly T[], ctx: RowModelContext<T>) => DisplayRow<T>[];
  /**
   * Plugin-held expansion store (e.g. the row-group / tree adapter). When set,
   * every toggle (mouse, keyboard, API, adapter) reads/writes this store.
   */
  expansion?: GroupExpansionStore;
  /**
   * Every collapsible id for Collapse-all (including ids under collapsed parents).
   * Default: build with nothing collapsed and collect group / parent-row ids.
   */
  collectGroupIds?: (rows: readonly T[], ctx: RowModelContext<T>) => string[];
}

export interface InteractionContribution {
  id: string;
  /** Attach listeners / timers; return cleanup. */
  setup: (element: HTMLElement) => (() => void) | void;
}

export interface AggregateContribution<T = unknown> {
  id: string;
  /** Per visible column id → aggregate value (null/undefined = blank cell). */
  values: (rows: readonly T[], columns: readonly ColumnDef<T>[]) => Map<string, unknown>;
}

/**
 * Display-kind view contribution — plugins register a component for a `DisplayRow.kind`.
 * Host falls back to built-in `@switch` when no view is registered.
 */
export interface DisplayViewContribution {
  kind: string;
  component: import('@angular/core').Type<unknown>;
  /**
   * The view hosts its own focus realm (e.g. a nested grid): the row shell is
   * not a focus stop and gets no focused chrome. Default false.
   */
  nestedWidget?: boolean;
  /** DOM id for the row shell (target of a master row's `aria-details`). */
  regionId?: (item: CustomDisplayRow) => string | null;
}

/**
 * Interactive cell widget (e.g. a master-detail expand toggle). On a focused
 * body cell the widget owns Enter / Space instead of edit / select.
 */
export interface CellWidgetContribution<T = unknown> {
  id: string;
  /** Column hosting the widget — an id, or a predicate over column ids. */
  columnId: string | ((columnId: string) => boolean);
  /** Whether this row shows the widget. Default: every data row. */
  isActive?: (row: T, rowId: string | number) => boolean;
  /** Enter / Space — e.g. expand / collapse. */
  toggle: (row: T, rowId: string | number) => void;
  /**
   * Enter, tried before {@link toggle}: move into a nested widget (e.g. an
   * open detail grid). Return `true` when handled.
   */
  enter?: (row: T, rowId: string | number) => boolean;
}

/** Extra ARIA on body data rows (e.g. `aria-details` → an open detail region). */
export interface RowAriaContribution<T = unknown> {
  id: string;
  ariaDetails?: (row: T, rowId: string | number) => string | null;
}

/**
 * Cell-range selection source. The grid reads it for range paint, ARIA
 * selection, Escape, Shift+arrow and copy. One active source (last wins).
 */
export interface RangeSelectionContribution {
  id: string;
  range: () => CellRange | null;
  clear: () => void;
  /** Shift+arrow extend of the active corner. Return `true` when handled. */
  extend?: (dRow: number, dCol: number) => boolean;
  /** TSV for copy — when non-null it wins over row selection. */
  clipboardText?: () => string | null;
  /** Paint a fill handle on the range ring. Default true. */
  fillHandle?: boolean;
}

/** Context for plugin cell class decorations. */
export interface CellDecoratorContext<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  columnId: string;
  column: ColumnDef<T>;
  value: unknown;
}

export interface CellDecoratorContribution<T = unknown> {
  id: string;
  className: (ctx: CellDecoratorContext<T>) => string | string[] | null | undefined;
  /** Optional per-cell CSS custom properties / inline styles (binder applies). */
  style?: (ctx: CellDecoratorContext<T>) => Record<string, string> | null | undefined;
}

/** Plugin-contributed context-menu items (merged ahead of host/default items). */
export interface ContextMenuContribution<T = unknown> {
  id: string;
  order?: number;
  items: (ctx: DataGridContextMenuContext<T>) => readonly DataGridContextMenuItem<T>[];
}

/** CSS px relative to the range/overlay layer. */
export interface OverlayLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Overlay contribution — plugin owns state; binder owns paint.
 * `kind`: `'range-ring' | 'fill-handle' | 'custom'` (open string for forward compat).
 */
export interface OverlayContribution {
  id: string;
  kind: string;
  /** `null` = hidden */
  layout: () => OverlayLayout | null;
  /** Extra class on the overlay element */
  className?: string | (() => string | null);
}

/**
 * Registry of plugin capabilities for one grid instance.
 */
export class GridCapabilities<T = unknown> {
  private readonly dataStages: WritableSignal<RowModelDataStage<T>[]> = signal([]);
  private readonly displayBuilders: WritableSignal<RowModelDisplayBuilder<T>[]> = signal([]);
  private readonly interactions: WritableSignal<InteractionContribution[]> = signal([]);
  private readonly aggregates: WritableSignal<AggregateContribution<T>[]> = signal([]);
  private readonly displayViews: WritableSignal<DisplayViewContribution[]> = signal([]);
  private readonly cellDecorators: WritableSignal<CellDecoratorContribution<T>[]> = signal([]);
  private readonly contextMenuContributions: WritableSignal<ContextMenuContribution<T>[]> =
    signal([]);
  private readonly overlayContributions: WritableSignal<OverlayContribution[]> = signal([]);
  private readonly cellWidgets: WritableSignal<CellWidgetContribution<T>[]> = signal([]);
  private readonly rowAria: WritableSignal<RowAriaContribution<T>[]> = signal([]);
  private readonly rangeSelections: WritableSignal<RangeSelectionContribution[]> = signal([]);
  /** Bumped when overlay layouts should be re-read (range/scroll/resize). */
  private readonly overlayPaintEpochSignal: WritableSignal<number> = signal(0);
  /** Grid-owned expansion state for display builders without their own store. */
  private readonly fallbackCollapsed: WritableSignal<ReadonlySet<string>> = signal<
    ReadonlySet<string>
  >(new Set());
  private readonly fallbackExpansion: GroupExpansionStore = {
    collapsedIds: () => this.fallbackCollapsed(),
    toggleCollapsed: (groupId) =>
      this.fallbackCollapsed.update((prev) => toggleInSet(prev, groupId)),
    expandAll: () => this.fallbackCollapsed.set(new Set()),
    collapseAll: (ids) => this.fallbackCollapsed.set(new Set(ids)),
  };

  readonly hasDisplayBuilder = computed(() => this.displayBuilders().length > 0);
  /**
   * The grid's single expansion store: the active display builder's
   * `expansion`, else the grid-owned fallback. All group toggles go through it.
   */
  readonly groupExpansion: Signal<GroupExpansionStore> = computed(
    () => this.activeDisplayBuilder()?.expansion ?? this.fallbackExpansion,
  );
  /** Collapsed ids of {@link groupExpansion} (what `RowModelContext.collapsedGroupIds` reads). */
  readonly collapsedGroupIds: Signal<ReadonlySet<string>> = computed(() =>
    this.groupExpansion().collapsedIds(),
  );
  readonly hasAggregate = computed(() => this.aggregates().length > 0);
  readonly hasContextMenuItems = computed(() => this.contextMenuContributions().length > 0);
  /** Registered overlay contributions (binder paints these). */
  readonly overlays: Signal<OverlayContribution[]> = this.overlayContributions.asReadonly();
  /** Track in binder computed so layout() re-evaluates after invalidateOverlays(). */
  readonly overlayPaintEpoch: Signal<number> = this.overlayPaintEpochSignal.asReadonly();

  registerDataStage(stage: RowModelDataStage<T>): () => void {
    this.dataStages.update((list) =>
      sortByOrder([...list.filter((s) => s.id !== stage.id), stage]),
    );
    return () => this.dataStages.update((list) => list.filter((s) => s.id !== stage.id));
  }

  registerDisplayBuilder(builder: RowModelDisplayBuilder<T>): () => void {
    this.displayBuilders.update((list) => {
      const sameId = list.filter((b) => b.id === builder.id);
      const others = list.filter((b) => b.id !== builder.id);
      if (others.length > 0) {
        const prev = others.map((b) => b.id).join(', ');
        console.warn(
          `[data-grid] display builders are exclusive — replacing "${prev}" with "${builder.id}" (row group, tree, and master-detail cannot run together)`,
        );
      }
      // Exactly one active builder: replace any previous registration.
      return sameId.length && !others.length ? [builder] : [builder];
    });
    return () => this.displayBuilders.update((list) => list.filter((b) => b.id !== builder.id));
  }

  registerInteraction(contribution: InteractionContribution): () => void {
    this.interactions.update((list) => [
      ...list.filter((i) => i.id !== contribution.id),
      contribution,
    ]);
    return () => this.interactions.update((list) => list.filter((i) => i.id !== contribution.id));
  }

  registerAggregate(contribution: AggregateContribution<T>): () => void {
    this.aggregates.update((list) => [
      ...list.filter((a) => a.id !== contribution.id),
      contribution,
    ]);
    return () => this.aggregates.update((list) => list.filter((a) => a.id !== contribution.id));
  }

  registerDisplayView(view: DisplayViewContribution): () => void {
    this.displayViews.update((list) => [...list.filter((v) => v.kind !== view.kind), view]);
    return () => this.displayViews.update((list) => list.filter((v) => v.kind !== view.kind));
  }

  registerCellDecorator(decorator: CellDecoratorContribution<T>): () => void {
    this.cellDecorators.update((list) => [
      ...list.filter((d) => d.id !== decorator.id),
      decorator,
    ]);
    return () => this.cellDecorators.update((list) => list.filter((d) => d.id !== decorator.id));
  }

  registerContextMenuItems(contribution: ContextMenuContribution<T>): () => void {
    this.contextMenuContributions.update((list) =>
      sortByOrder([...list.filter((c) => c.id !== contribution.id), contribution]),
    );
    return () =>
      this.contextMenuContributions.update((list) =>
        list.filter((c) => c.id !== contribution.id),
      );
  }

  registerOverlay(contribution: OverlayContribution): () => void {
    this.overlayContributions.update((list) => [
      ...list.filter((o) => o.id !== contribution.id),
      contribution,
    ]);
    this.invalidateOverlays();
    return () => {
      this.overlayContributions.update((list) => list.filter((o) => o.id !== contribution.id));
      this.invalidateOverlays();
    };
  }

  registerCellWidget(widget: CellWidgetContribution<T>): () => void {
    this.cellWidgets.update((list) => [...list.filter((w) => w.id !== widget.id), widget]);
    return () => this.cellWidgets.update((list) => list.filter((w) => w !== widget));
  }

  registerRowAria(contribution: RowAriaContribution<T>): () => void {
    this.rowAria.update((list) => [...list.filter((a) => a.id !== contribution.id), contribution]);
    return () => this.rowAria.update((list) => list.filter((a) => a !== contribution));
  }

  registerRangeSelection(contribution: RangeSelectionContribution): () => void {
    this.rangeSelections.update((list) => [
      ...list.filter((r) => r.id !== contribution.id),
      contribution,
    ]);
    this.invalidateOverlays();
    return () => {
      this.rangeSelections.update((list) => list.filter((r) => r !== contribution));
      this.invalidateOverlays();
    };
  }

  /** Active range source (last registered), or `null`. */
  rangeSelection(): RangeSelectionContribution | null {
    const list = this.rangeSelections();
    return list[list.length - 1] ?? null;
  }

  /** Widget owning `columnId` on this row, or `null`. */
  resolveCellWidget(
    columnId: string,
    row: T,
    rowId: string | number,
  ): CellWidgetContribution<T> | null {
    for (const widget of this.cellWidgets()) {
      const onColumn =
        typeof widget.columnId === 'function'
          ? widget.columnId(columnId)
          : widget.columnId === columnId;
      if (onColumn && (widget.isActive?.(row, rowId) ?? true)) {
        return widget;
      }
    }
    return null;
  }

  /** First non-null `aria-details` from row ARIA contributions. */
  resolveRowAriaDetails(row: T, rowId: string | number): string | null {
    for (const contribution of this.rowAria()) {
      const id = contribution.ariaDetails?.(row, rowId);
      if (id) {
        return id;
      }
    }
    return null;
  }

  /** Ask the binder to re-read overlay `layout()` callbacks (range/scroll/resize). */
  invalidateOverlays(): void {
    this.overlayPaintEpochSignal.update((n) => n + 1);
  }

  listOverlays(): readonly OverlayContribution[] {
    return this.overlayContributions();
  }

  /** Active interaction contributions (for host to call setup after render). */
  getInteractions(): readonly InteractionContribution[] {
    return this.interactions();
  }

  getDisplayView(kind: string): DisplayViewContribution | null {
    return this.displayViews().find((v) => v.kind === kind) ?? null;
  }

  getDisplayViews(): readonly DisplayViewContribution[] {
    return this.displayViews();
  }

  resolveCellDecoratorClasses(ctx: CellDecoratorContext<T>): string {
    const parts: string[] = [];
    for (const decorator of this.cellDecorators()) {
      const raw = decorator.className(ctx);
      if (!raw) {
        continue;
      }
      if (Array.isArray(raw)) {
        parts.push(...raw.filter(Boolean));
      } else {
        parts.push(raw);
      }
    }
    return parts.join(' ');
  }

  /** Merge per-decorator inline styles / CSS vars (later decorators win on key clash). */
  resolveCellDecoratorStyles(ctx: CellDecoratorContext<T>): Record<string, string> {
    const merged: Record<string, string> = {};
    for (const decorator of this.cellDecorators()) {
      const part = decorator.style?.(ctx);
      if (!part) {
        continue;
      }
      Object.assign(merged, part);
    }
    return merged;
  }

  resolveContextMenuItems(
    ctx: DataGridContextMenuContext<T>,
  ): DataGridContextMenuItem<T>[] {
    const items: DataGridContextMenuItem<T>[] = [];
    for (const contribution of this.contextMenuContributions()) {
      items.push(...contribution.items(ctx));
    }
    return items;
  }

  /** Run data stages in order. Returns `rows` itself when no stage is registered. */
  runDataStages(rows: readonly T[], ctx: RowModelContext<T>): readonly T[] {
    let next = rows;
    for (const stage of this.dataStages()) {
      next = stage.transform(next, ctx);
    }
    return next;
  }

  buildDisplayRows(rows: readonly T[], ctx: RowModelContext<T>): DisplayRow<T>[] {
    const builder = this.activeDisplayBuilder();
    if (!builder) {
      return wrapDataRows(rows, ctx.rowId);
    }
    return builder.build(rows, ctx);
  }

  /** Toggle one group / tree node in the active expansion store. */
  toggleGroup(groupId: string): void {
    this.groupExpansion().toggleCollapsed(groupId);
  }

  expandAllGroups(): void {
    this.groupExpansion().expandAll();
  }

  /** Collapse every collapsible id of the active display builder. */
  collapseAllGroups(rows: readonly T[], ctx: RowModelContext<T>): void {
    const builder = this.activeDisplayBuilder();
    const open: RowModelContext<T> = { ...ctx, collapsedGroupIds: new Set() };
    const ids = builder?.collectGroupIds
      ? builder.collectGroupIds(rows, open)
      : this.buildDisplayRows(rows, open).flatMap((row) =>
          row.kind === 'group' ? [row.id] : row.kind === 'data' && row.groupId ? [row.groupId] : [],
        );
    this.groupExpansion().collapseAll(ids);
  }

  /** Last registered builder wins (e.g. tree over group if both somehow present). */
  private activeDisplayBuilder(): RowModelDisplayBuilder<T> | null {
    const builders = this.displayBuilders();
    return builders[builders.length - 1] ?? null;
  }

  collectAggregates(
    rows: readonly T[],
    columns: readonly ColumnDef<T>[],
  ): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const agg of this.aggregates()) {
      const part = agg.values(rows, columns);
      for (const [k, v] of part) {
        map.set(k, v);
      }
    }
    return map;
  }

  clearAll(): void {
    this.dataStages.set([]);
    this.displayBuilders.set([]);
    this.interactions.set([]);
    this.aggregates.set([]);
    this.displayViews.set([]);
    this.cellDecorators.set([]);
    this.contextMenuContributions.set([]);
    this.overlayContributions.set([]);
    this.cellWidgets.set([]);
    this.rowAria.set([]);
    this.rangeSelections.set([]);
    this.overlayPaintEpochSignal.set(0);
    this.fallbackCollapsed.set(new Set());
  }
}

function toggleInSet(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function sortByOrder<T extends { id: string; order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}
