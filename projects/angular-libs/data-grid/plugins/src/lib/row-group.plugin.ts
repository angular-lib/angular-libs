import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid';
import {
  buildGroupedRowsFromAdapter,
  createRowGroupAdapter,
  type RowGroupAdapter,
} from './row-group.adapter';
import { DataGridRowGroupPanel } from './sidebar/row-group-panel';

export type { RowGroupAdapter } from './row-group.adapter';

export interface RowGroupPluginOptions {
  columns?: readonly string[];
}

export type RowGroupPlugin<T = unknown> = DataGridPlugin<T> & RowGroupAdapter;

/**
 * Row grouping as a capability plugin + store-style adapter.
 *
 * Expand / collapse / clear are available on the adapter and {@link DataGridApi}
 * — no default toolbar buttons (compose your own via `registerToolbar` / `[toolbarActions]`).
 *
 * @example
 * ```ts
 * const groups = rowGroupPlugin({ columns: ['department'] });
 * plugins = [groups, sideBarPlugin()];
 * groups.setColumns(['role']);
 * groups.clear();
 * ```
 */
export function rowGroupPlugin<T = unknown>(
  options: RowGroupPluginOptions = {},
): RowGroupPlugin<T> {
  const adapter = createRowGroupAdapter(options.columns ?? []);

  const plugin: RowGroupPlugin<T> = {
    id: 'rowGroup',
    columns: adapter.columns,
    collapsedIds: adapter.collapsedIds,
    active: adapter.active,
    setColumns: (c) => adapter.setColumns(c),
    clear: () => adapter.clear(),
    toggleCollapsed: (id) => adapter.toggleCollapsed(id),
    expandAll: () => adapter.expandAll(),
    collapseAll: (ids) => adapter.collapseAll(ids),

    setup(context: DataGridPluginContext<T>): () => void {
      const locale = () => context.api.getLocale();

      const cleanDisplay = context.capabilities.registerDisplayBuilder({
        id: 'rowGroup',
        build: (rows, ctx) =>
          buildGroupedRowsFromAdapter(rows, adapter, ctx.columnsById, ctx.rowId),
      });

      const cleanSidebar = context.slots.registerSidebar({
        id: 'rowGroup',
        label: locale().groupsPanelShortLabel,
        order: 30,
        component: DataGridRowGroupPanel,
      });

      context.api.bindRowGroupAdapter(adapter);

      return () => {
        context.api.bindRowGroupAdapter(null);
        cleanSidebar();
        cleanDisplay();
      };
    },
  };

  return plugin;
}
