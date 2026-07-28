/**
 * Store-style adapter for row grouping — owned by `rowGroupPlugin`.
 */

import { computed, signal, type Signal } from '@angular/core';
import {
  buildDisplayRows,
  collectAllGroupIds,
  type ColumnDef,
  type DisplayRow,
  type RowGroupConfig,
} from '@angular-libs/data-grid';

export interface RowGroupAdapter {
  readonly columns: Signal<readonly string[]>;
  readonly collapsedIds: Signal<ReadonlySet<string>>;
  readonly active: Signal<boolean>;
  setColumns(columns: readonly string[]): void;
  clear(): void;
  toggleCollapsed(groupId: string): void;
  expandAll(): void;
  collapseAll(allGroupIds: readonly string[]): void;
}

export function createRowGroupAdapter(
  initialColumns: readonly string[] = [],
): RowGroupAdapter {
  const columns = signal<readonly string[]>([...initialColumns]);
  const collapsedIds = signal<ReadonlySet<string>>(new Set());

  return {
    columns: columns.asReadonly(),
    collapsedIds: collapsedIds.asReadonly(),
    active: computed(() => columns().length > 0),
    setColumns(next) {
      columns.set([...next]);
      collapsedIds.set(new Set());
    },
    clear() {
      columns.set([]);
      collapsedIds.set(new Set());
    },
    toggleCollapsed(groupId) {
      collapsedIds.update((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) {
          next.delete(groupId);
        } else {
          next.add(groupId);
        }
        return next;
      });
    },
    expandAll() {
      collapsedIds.set(new Set());
    },
    collapseAll(allGroupIds) {
      collapsedIds.set(new Set(allGroupIds));
    },
  };
}

/** All group ids for Collapse-all — pure, no expand/collapse mutation. */
export function collectAllGroupIdsFromAdapter<T>(
  rows: readonly T[],
  adapter: RowGroupAdapter,
  columnsById: Map<string, ColumnDef<T>>,
): string[] {
  return collectAllGroupIds(rows, adapter.columns(), columnsById);
}

export function buildGroupedRowsFromAdapter<T>(
  rows: readonly T[],
  adapter: RowGroupAdapter,
  columnsById: Map<string, ColumnDef<T>>,
  rowId: (row: T, index: number) => string | number,
): DisplayRow<T>[] {
  const config: RowGroupConfig = { columns: adapter.columns() };
  if (!config.columns.length) {
    return buildDisplayRows({
      rows,
      rowId,
      columnsById,
      collapsedGroupIds: new Set(),
      rowGroup: null,
      treeData: null,
    });
  }
  return buildDisplayRows({
    rows,
    rowId,
    columnsById,
    collapsedGroupIds: adapter.collapsedIds(),
    rowGroup: config,
    treeData: null,
  });
}
