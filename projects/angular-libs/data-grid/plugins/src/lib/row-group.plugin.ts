import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';
import { collectAllGroupIds } from '@angular-libs/data-grid/plugin';
import {
  buildGroupedRowsFromAdapter,
  createRowGroupAdapter,
  ROW_GROUP_ADAPTER,
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
 * Group columns live on the held adapter (also `api.getAdapter(ROW_GROUP_ADAPTER)`);
 * expand / collapse on the adapter and {@link DataGridApi} — no default toolbar buttons (compose your own via `registerToolbar` / `[toolbarActions]`).
 * Mutually exclusive with `treeDataPlugin` / `masterDetailPlugin` (one display builder).
 * One instance may serve several grids — they share the adapter (same grouping).
 *
 * @example
 * ```ts
 * const groups = rowGroupPlugin({ columns: ['department'] });
 * plugins = [groups, sideBarPlugin()];
 * groups.setColumns(['role']);
 * groups.clear();
 * ```
 */
export function rowGroupPlugin<T = any>(
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
          buildGroupedRowsFromAdapter(
            rows,
            adapter,
            ctx.columnsById,
            ctx.rowId,
            ctx.collapsedGroupIds,
          ),
        // The held adapter is the grid's expansion store while this builder is active.
        expansion: adapter,
        collectGroupIds: (rows, ctx) =>
          collectAllGroupIds(rows, adapter.columns(), ctx.columnsById),
      });

      const cleanSidebar = context.slots.registerSidebar({
        id: 'rowGroup',
        label: locale().groupsPanelShortLabel,
        order: 30,
        component: DataGridRowGroupPanel,
        inputs: { adapter },
      });

      const cleanAdapter = context.adapters.register(ROW_GROUP_ADAPTER, adapter);

      // `state.slices.rowGroup` — persisted / restored with grid state.
      const cleanState = context.capabilities.registerStateSlice({
        key: 'rowGroup',
        get: () => ({ columns: [...adapter.columns()], collapsedIds: [...adapter.collapsedIds()] }),
        apply: (value) => applyRowGroupState(adapter, value),
      });

      return () => {
        cleanState();
        cleanAdapter();
        cleanSidebar();
        cleanDisplay();
      };
    },
  };

  return plugin;
}

/** Validate + apply a persisted `rowGroup` slice (`{ columns, collapsedIds }`). */
function applyRowGroupState(adapter: RowGroupAdapter, value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  const { columns, collapsedIds } = value as { columns?: unknown; collapsedIds?: unknown };
  const strings = (list: unknown): string[] | null =>
    Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : null;
  const nextColumns = strings(columns);
  if (nextColumns) {
    adapter.setColumns(nextColumns);
  }
  const collapsed = strings(collapsedIds);
  if (collapsed) {
    adapter.collapseAll(collapsed);
  }
}
