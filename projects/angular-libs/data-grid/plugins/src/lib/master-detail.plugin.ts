import type { ColumnDef } from '@angular-libs/data-grid';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';
import {
  createMasterDetailAdapter,
  type MasterDetailAdapter,
} from './master-detail.adapter';
import { buildMasterDetailDisplayRows } from './master-detail.builder';
import { MasterDetailDefaultView } from './master-detail-default.view';
import { MasterDetailExpandCell } from './master-detail-expand.cell';
import {
  MASTER_DETAIL_PLUGIN_KIND,
  type MasterDetailExpandColumnOptions,
  type MasterDetailPluginOptions,
} from './master-detail.types';

export type {
  MasterDetailExpandColumnOptions,
  MasterDetailPayload,
  MasterDetailPluginOptions,
} from './master-detail.types';
export { MASTER_DETAIL_PLUGIN_KIND } from './master-detail.types';
export type { MasterDetailAdapter } from './master-detail.adapter';
export { createMasterDetailAdapter } from './master-detail.adapter';
export { buildMasterDetailDisplayRows } from './master-detail.builder';
export { MasterDetailDefaultView } from './master-detail-default.view';
export { MasterDetailExpandCell } from './master-detail-expand.cell';

export type MasterDetailPlugin<T = unknown, D = unknown> = DataGridPlugin<T> &
  MasterDetailAdapter & {
    /** Narrow expand column — prepend to your column defs (AG group cell spirit). */
    expandColumn(options?: MasterDetailExpandColumnOptions): ColumnDef<T>;
  };

/**
 * Master / detail via display-kind plugin rows (AG Grid–inspired, Angular-native).
 *
 * - Expand state lives on the held adapter (`toggle` / `expandAll` / …)
 * - Detail is a full-width `plugin` display row (`pluginKind: 'masterDetail'`)
 * - Default detail UI is a compact table; override with `detailComponent`
 * - Mutually exclusive with `rowGroupPlugin` / `treeDataPlugin` (one display builder)
 *
 * @example
 * ```ts
 * const md = masterDetailPlugin({
 *   getDetailRows: (row) => row.orders,
 *   detailColumns: [
 *     { field: 'sku', header: 'SKU' },
 *     { field: 'qty', header: 'Qty', type: 'number' },
 *   ],
 *   detailRowHeight: 180,
 *   isRowMaster: (row) => row.orders.length > 0,
 * });
 *
 * const grid = createGrid({
 *   columns: [md.expandColumn(), { field: 'name' }, …],
 *   plugins: [...defaultGridPlugins(), md],
 *   rowId: (r) => r.id,
 * });
 * ```
 */
export function masterDetailPlugin<T = unknown, D = unknown>(
  options: MasterDetailPluginOptions<T, D>,
): MasterDetailPlugin<T, D> {
  const adapter = createMasterDetailAdapter();
  const detailRowHeight = options.detailRowHeight ?? 200;
  const detailView = options.detailComponent ?? MasterDetailDefaultView;
  const getDetailRows = options.getDetailRows;
  const isRowMaster = options.isRowMaster;
  const detailColumns = options.detailColumns;
  const isOpenByDefault = options.isOpenByDefault;

  const expandColumn = (
    columnOptions: MasterDetailExpandColumnOptions = {},
  ): ColumnDef<T> => ({
    id: columnOptions.id ?? '__masterDetailExpand',
    header: columnOptions.header ?? '',
    width: columnOptions.width ?? 44,
    minWidth: 36,
    sortable: false,
    filter: false,
    editable: false,
    cellRenderer: MasterDetailExpandCell,
    cellRendererParams: {
      masterDetail: adapter,
      isRowMaster,
    },
  });

  const plugin: MasterDetailPlugin<T, D> = {
    id: 'masterDetail',
    expandedIds: adapter.expandedIds,
    active: adapter.active,
    isExpanded: (id) => adapter.isExpanded(id),
    toggle: (id) => adapter.toggle(id),
    expand: (id) => adapter.expand(id),
    collapse: (id) => adapter.collapse(id),
    expandAll: (ids) => adapter.expandAll(ids),
    collapseAll: () => adapter.collapseAll(),
    seedOpenByDefault: (opts) => adapter.seedOpenByDefault(opts),
    expandColumn,

    setup(context: DataGridPluginContext<T>): () => void {
      const cleanDisplay = context.capabilities.registerDisplayBuilder({
        id: 'masterDetail',
        build: (rows, ctx) => {
          if (isOpenByDefault != null) {
            adapter.seedOpenByDefault({
              rows,
              rowId: ctx.rowId,
              isRowMaster,
              isOpenByDefault,
            });
          }
          return buildMasterDetailDisplayRows({
            rows,
            rowId: ctx.rowId,
            expandedIds: adapter.expandedIds(),
            getDetailRows,
            isRowMaster,
            detailRowHeight,
            detailColumns,
          });
        },
      });

      const cleanView = context.capabilities.registerDisplayView({
        kind: MASTER_DETAIL_PLUGIN_KIND,
        component: detailView,
      });

      return () => {
        cleanView();
        cleanDisplay();
      };
    },
  };

  return plugin;
}
