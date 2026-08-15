/**
 * Store-style expand adapter for `masterDetailPlugin`.
 *
 * Explicit overrides win; otherwise `isOpenByDefault` is evaluated purely in the
 * display builder (no signal writes inside computed).
 */

import { computed, signal, type Signal } from '@angular/core';

export interface MasterDetailAdapter {
  /** Row ids explicitly forced open. */
  readonly expandedIds: Signal<ReadonlySet<string | number>>;
  /** Row ids explicitly forced closed. */
  readonly collapsedIds: Signal<ReadonlySet<string | number>>;
  readonly active: Signal<boolean>;
  /**
   * @param openByDefault Result of `isOpenByDefault` for this row (pure).
   */
  isExpanded(rowId: string | number, openByDefault?: boolean): boolean;
  toggle(rowId: string | number, openByDefault?: boolean): void;
  expand(rowId: string | number): void;
  collapse(rowId: string | number): void;
  expandAll(rowIds: readonly (string | number)[]): void;
  /**
   * Collapse everything. When `isOpenByDefault` is used, pass all master ids
   * (or omit to block default-open until an explicit expand).
   */
  collapseAll(allMasterIds?: readonly (string | number)[]): void;
}

export function createMasterDetailAdapter(): MasterDetailAdapter {
  /** Explicit true/false per row id. */
  const overrides = signal<ReadonlyMap<string | number, boolean>>(new Map());
  /** After collapseAll() without ids — ignore openByDefault until expand. */
  const blockDefaultOpen = signal(false);

  const expandedIds = computed(() => {
    const ids = new Set<string | number>();
    for (const [id, open] of overrides()) {
      if (open) {
        ids.add(id);
      }
    }
    return ids as ReadonlySet<string | number>;
  });

  const collapsedIds = computed(() => {
    const ids = new Set<string | number>();
    for (const [id, open] of overrides()) {
      if (!open) {
        ids.add(id);
      }
    }
    return ids as ReadonlySet<string | number>;
  });

  const isExpanded = (rowId: string | number, openByDefault = false): boolean => {
    const forced = overrides().get(rowId);
    if (forced !== undefined) {
      return forced;
    }
    if (blockDefaultOpen()) {
      return false;
    }
    return openByDefault;
  };

  const setOverride = (rowId: string | number, open: boolean): void => {
    overrides.update((prev) => {
      if (prev.get(rowId) === open) {
        return prev;
      }
      const next = new Map(prev);
      next.set(rowId, open);
      return next;
    });
  };

  return {
    expandedIds,
    collapsedIds,
    active: computed(() => true),
    isExpanded,
    toggle(rowId, openByDefault = false) {
      setOverride(rowId, !isExpanded(rowId, openByDefault));
    },
    expand(rowId) {
      setOverride(rowId, true);
    },
    collapse(rowId) {
      setOverride(rowId, false);
    },
    expandAll(rowIds) {
      blockDefaultOpen.set(false);
      overrides.set(new Map(rowIds.map((id) => [id, true])));
    },
    collapseAll(allMasterIds) {
      if (allMasterIds?.length) {
        blockDefaultOpen.set(false);
        overrides.set(new Map(allMasterIds.map((id) => [id, false])));
        return;
      }
      overrides.set(new Map());
      blockDefaultOpen.set(true);
    },
  };
}
