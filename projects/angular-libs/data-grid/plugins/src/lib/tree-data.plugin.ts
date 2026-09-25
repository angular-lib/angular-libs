import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';
import {
  buildDisplayRows,
  collectTreeGroupIds,
  type TreeDataConfig,
} from '@angular-libs/data-grid/plugin';
import {
  createTreeDataAdapter,
  TREE_DATA_ADAPTER,
  type TreeDataAdapter,
} from './tree-data.adapter';

export type { TreeDataAdapter } from './tree-data.adapter';
export { createTreeDataAdapter, TREE_DATA_ADAPTER } from './tree-data.adapter';

export interface TreeDataPluginOptions<T = unknown> {
  getDataPath: (row: T) => readonly string[];
}

export type TreeDataPlugin<T = unknown> = DataGridPlugin<T> & TreeDataAdapter;

/**
 * Registers a tree display builder + store-style collapse adapter.
 *
 * Mutually exclusive with `rowGroupPlugin` / `masterDetailPlugin` (one display builder).
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
            collapsedGroupIds: ctx.collapsedGroupIds,
            rowGroup: null,
            treeData: treeConfig as TreeDataConfig,
          }),
        // The held adapter is the grid's expansion store while this builder is active.
        expansion: adapter,
        collectGroupIds: (rows) => collectTreeGroupIds(rows, options.getDataPath),
      });

      const cleanAdapter = context.adapters.register(TREE_DATA_ADAPTER, adapter);

      return () => {
        cleanAdapter();
        cleanDisplay();
      };
    },
  };

  return plugin;
}
