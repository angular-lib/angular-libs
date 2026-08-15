/**
 * Store-style expand adapter for `masterDetailPlugin`.
 */

import { computed, signal, type Signal } from '@angular/core';

export interface MasterDetailAdapter {
  readonly expandedIds: Signal<ReadonlySet<string | number>>;
  readonly active: Signal<boolean>;
  isExpanded(rowId: string | number): boolean;
  toggle(rowId: string | number): void;
  expand(rowId: string | number): void;
  collapse(rowId: string | number): void;
  expandAll(rowIds: readonly (string | number)[]): void;
  collapseAll(): void;
  /**
   * One-shot open-by-default seeding for unseen master ids.
   * Safe to call from a display builder (may rewrite `expandedIds` once).
   */
  seedOpenByDefault<T>(options: {
    rows: readonly T[];
    rowId: (row: T, index: number) => string | number;
    isRowMaster?: (row: T) => boolean;
    isOpenByDefault: boolean | ((row: T) => boolean);
  }): void;
}

export function createMasterDetailAdapter(): MasterDetailAdapter {
  const expandedIds = signal<ReadonlySet<string | number>>(new Set());
  const seededIds = new Set<string | number>();

  return {
    expandedIds: expandedIds.asReadonly(),
    active: computed(() => true),
    isExpanded(rowId) {
      return expandedIds().has(rowId);
    },
    toggle(rowId) {
      expandedIds.update((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
    },
    expand(rowId) {
      expandedIds.update((prev) => {
        if (prev.has(rowId)) {
          return prev;
        }
        const next = new Set(prev);
        next.add(rowId);
        return next;
      });
    },
    collapse(rowId) {
      expandedIds.update((prev) => {
        if (!prev.has(rowId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    },
    expandAll(rowIds) {
      for (const id of rowIds) {
        seededIds.add(id);
      }
      expandedIds.set(new Set(rowIds));
    },
    collapseAll() {
      expandedIds.set(new Set());
    },
    seedOpenByDefault({ rows, rowId, isRowMaster, isOpenByDefault }) {
      let changed = false;
      const next = new Set(expandedIds());
      rows.forEach((row, index) => {
        const id = rowId(row, index);
        if (seededIds.has(id)) {
          return;
        }
        seededIds.add(id);
        const master = isRowMaster ? isRowMaster(row) : true;
        if (!master) {
          return;
        }
        const open =
          typeof isOpenByDefault === 'function'
            ? isOpenByDefault(row)
            : isOpenByDefault;
        if (open) {
          next.add(id);
          changed = true;
        }
      });
      if (changed) {
        expandedIds.set(next);
      }
    },
  };
}
