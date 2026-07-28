import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid';
import {
  buildDisplayRows,
  collectTreeGroupIds,
  type TreeDataConfig,
} from '@angular-libs/data-grid';
import { createTreeDataAdapter, type TreeDataAdapter } from './tree-data.adapter';

export type { TreeDataAdapter } from './tree-data.adapter';
export { createTreeDataAdapter } from './tree-data.adapter';

export interface TreeDataPluginOptions<T = unknown> {
  getDataPath: (row: T) => readonly string[];
}

export type TreeDataPlugin<T = unknown> = DataGridPlugin<T> & TreeDataAdapter;

/**
 * Registers a tree display builder + store-style collapse adapter.
 *
 * Mutually exclusive with `rowGroupPlugin` (capabilities keep one display builder).
 * Expand / collapse live on the adapter / API — no default toolbar buttons.
 *
 * @example
 * ```ts
 * const tree = treeDataPlugin({ getDataPath: (r) => r.path });
 * plugins = [tree];
 * tree.expandAll();
 * ```
 */
export function treeDataPlugin<T = unknown>(
  options: TreeDataPluginOptions<T>,
): TreeDataPlugin<T> {
  const treeConfig: TreeDataConfig<T> = { getDataPath: options.getDataPath };
  const adapter = createTreeDataAdapter((rows) =>
    collectTreeGroupIds(rows as T[], options.getDataPath),
  );

  const plugin: TreeDataPlugin<T> = {
    id: 'treeData',
    collapsedIds: adapter.collapsedIds,
    active: adapter.active,
    toggleCollapsed: (id) => adapter.toggleCollapsed(id),
    expandAll: () => adapter.expandAll(),
    collapseAll: (ids) => adapter.collapseAll(ids),
    collectAllGroupIds: (rows) => adapter.collectAllGroupIds(rows),

    setup(context: DataGridPluginContext<T>): () => void {
      const cleanDisplay = context.capabilities.registerDisplayBuilder({
        id: 'treeData',
        build: (rows, ctx) =>
          buildDisplayRows({
            rows,
            rowId: ctx.rowId,
            columnsById: ctx.columnsById,
            collapsedGroupIds: adapter.collapsedIds(),
            rowGroup: null,
            treeData: treeConfig as TreeDataConfig,
          }),
      });

      context.api.bindTreeDataAdapter({
        active: () => adapter.active(),
        toggleCollapsed: (id) => adapter.toggleCollapsed(id),
        expandAll: () => adapter.expandAll(),
        collapseAll: (ids) => adapter.collapseAll(ids),
        collapsedIds: () => adapter.collapsedIds(),
        collectAllGroupIds: (rows) => collectTreeGroupIds(rows as T[], options.getDataPath),
      });

      return () => {
        context.api.bindTreeDataAdapter(null);
        cleanDisplay();
      };
    },
  };

  return plugin;
}
