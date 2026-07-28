import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid';

/**
 * Adds a row-drag handle column and emits `rowReorder` when rows are dropped.
 */
export function rowDragPlugin<T = unknown>(): DataGridPlugin<T> {
  return {
    id: 'rowDrag',
    setup(context: DataGridPluginContext<T>): () => void {
      return context.slots.enableRowDrag();
    },
  };
}
