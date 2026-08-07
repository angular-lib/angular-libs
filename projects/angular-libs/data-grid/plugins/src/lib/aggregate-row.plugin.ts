import type { ColumnDef } from '@angular-libs/data-grid';
import type {
  DataGridPlugin,
  DataGridPluginContext,
} from '@angular-libs/data-grid/plugin';
import { aggregateColumn } from '@angular-libs/data-grid/internals';

/**
 * Registers an aggregate footer contribution (capability).
 * Columns with `aggFunc` are included.
 */
export function aggregateRowPlugin<T = unknown>(): DataGridPlugin<T> {
  return {
    id: 'aggregateRow',
    setup(context: DataGridPluginContext<T>): () => void {
      return context.capabilities.registerAggregate({
        id: 'aggFunc',
        values: (rows, columns) => {
          const map = new Map<string, unknown>();
          for (const col of columns) {
            if (!col.aggFunc) {
              continue;
            }
            const id = col.id ?? col.field;
            if (!id) {
              continue;
            }
            map.set(id, aggregateColumn(rows, col as ColumnDef<T>));
          }
          return map;
        },
      });
    },
  };
}
