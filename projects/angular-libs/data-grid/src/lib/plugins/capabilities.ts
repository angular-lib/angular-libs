/**
 * Capability contracts — plugins register real contributions here,
 * instead of flipping host feature flags.
 */

import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  ColumnDef,
  DataGridContextMenuContext,
  DataGridContextMenuItem,
} from '../components/data-grid/data-grid.types';
import type { DisplayRow } from '../utils/row-display';
import { wrapDataRows } from '../utils/row-display';

export interface RowModelContext<T = unknown> {
  columnsById: Map<string, ColumnDef<T>>;
  rowId: (row: T, index: number) => string | number;
  collapsedGroupIds: ReadonlySet<string>;
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
}

/** Plugin-contributed context-menu items (merged ahead of host/default items). */
export interface ContextMenuContribution<T = unknown> {
  id: string;
  order?: number;
  items: (ctx: DataGridContextMenuContext<T>) => readonly DataGridContextMenuItem<T>[];
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

  readonly hasDisplayBuilder = computed(() => this.displayBuilders().length > 0);
  readonly hasAggregate = computed(() => this.aggregates().length > 0);
  readonly hasContextMenuItems = computed(() => this.contextMenuContributions().length > 0);

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
          `[data-grid] display builders are exclusive — replacing "${prev}" with "${builder.id}" (row group and tree cannot run together)`,
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

  resolveContextMenuItems(
    ctx: DataGridContextMenuContext<T>,
  ): DataGridContextMenuItem<T>[] {
    const items: DataGridContextMenuItem<T>[] = [];
    for (const contribution of this.contextMenuContributions()) {
      items.push(...contribution.items(ctx));
    }
    return items;
  }

  runDataStages(rows: readonly T[], ctx: RowModelContext<T>): T[] {
    let next = [...rows];
    for (const stage of this.dataStages()) {
      next = [...stage.transform(next, ctx)];
    }
    return next;
  }

  buildDisplayRows(rows: readonly T[], ctx: RowModelContext<T>): DisplayRow<T>[] {
    const builders = this.displayBuilders();
    if (!builders.length) {
      return wrapDataRows(rows, ctx.rowId);
    }
    // Last registered builder wins (e.g. tree over group if both somehow present).
    return builders[builders.length - 1]!.build(rows, ctx);
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
  }
}

function sortByOrder<T extends { id: string; order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

/** DI token string key for optional adapters provided by plugins. */
export const ROW_GROUP_ADAPTER = 'al.data-grid.RowGroupAdapter' as const;
export const TREE_DATA_ADAPTER = 'al.data-grid.TreeDataAdapter' as const;
