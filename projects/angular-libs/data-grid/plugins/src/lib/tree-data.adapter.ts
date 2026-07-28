/**
 * Store-style adapter for tree collapse — owned by `treeDataPlugin`.
 */

import { computed, signal, type Signal } from '@angular/core';

export interface TreeDataAdapter {
  readonly collapsedIds: Signal<ReadonlySet<string>>;
  readonly active: Signal<boolean>;
  toggleCollapsed(groupId: string): void;
  expandAll(): void;
  collapseAll(allGroupIds: readonly string[]): void;
  collectAllGroupIds(rows: readonly unknown[]): string[];
}

export function createTreeDataAdapter(
  collectAllGroupIds: (rows: readonly unknown[]) => string[] = () => [],
): TreeDataAdapter {
  const collapsedIds = signal<ReadonlySet<string>>(new Set());

  return {
    collapsedIds: collapsedIds.asReadonly(),
    // Tree is always "active" once the plugin is mounted (path-driven).
    active: computed(() => true),
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
    collectAllGroupIds,
  };
}
