import type {
  ColumnDef,
  DataGridApi,
  DataGridState,
  GridController,
} from '@angular-libs/data-grid';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';
import {
  createMasterDetailAdapter,
  type MasterDetailAdapter,
} from './master-detail.adapter';
import {
  buildMasterDetailDisplayRows,
  EMPTY_DETAIL_ROW_HEIGHT,
} from './master-detail.builder';
import {
  createDetailGridController,
  detailGridConfigKey,
  MasterDetailDefaultView,
} from './master-detail-default.view';
import { MasterDetailExpandCell } from './master-detail-expand.cell';
import {
  MASTER_DETAIL_PLUGIN_KIND,
  type MasterDetailExpandColumnOptions,
  type MasterDetailGridOptions,
  type MasterDetailPluginOptions,
  type PersistedDetailGridState,
} from './master-detail.types';

export type {
  MasterDetailExpandColumnOptions,
  MasterDetailGridOptions,
  MasterDetailPayload,
  MasterDetailPluginOptions,
  PersistedDetailGridState,
} from './master-detail.types';
export { MASTER_DETAIL_PLUGIN_KIND } from './master-detail.types';
export type { MasterDetailAdapter } from './master-detail.adapter';
export { createMasterDetailAdapter } from './master-detail.adapter';
export { buildMasterDetailDisplayRows, EMPTY_DETAIL_ROW_HEIGHT } from './master-detail.builder';
export {
  MasterDetailDefaultView,
  createDetailGridController,
  detailGridConfigKey,
} from './master-detail-default.view';
export { MasterDetailExpandCell } from './master-detail-expand.cell';

export type MasterDetailPlugin<T = unknown, D = unknown> = DataGridPlugin<T> &
  MasterDetailAdapter & {
    /** Narrow expand column — prepend to your column defs (AG group cell spirit). */
    expandColumn(options?: MasterDetailExpandColumnOptions): ColumnDef<T>;
  };

function resolveOpenByDefault<T>(
  row: T,
  isOpenByDefault: boolean | ((row: T) => boolean) | undefined,
): boolean {
  if (isOpenByDefault == null) {
    return false;
  }
  return typeof isOpenByDefault === 'function'
    ? isOpenByDefault(row)
    : isOpenByDefault;
}

function resolveDetailGrid<T, D>(
  options: MasterDetailPluginOptions<T, D>,
): MasterDetailGridOptions<D> | undefined {
  if (options.detailGrid?.columns?.length) {
    return options.detailGrid;
  }
  if (options.detailColumns?.length) {
    return { columns: options.detailColumns };
  }
  return undefined;
}

function resolveIsRowMaster<T, D>(
  options: MasterDetailPluginOptions<T, D>,
): ((row: T) => boolean) | undefined {
  if (options.isRowMaster) {
    return options.isRowMaster;
  }
  if (options.detailComponent) {
    // Custom panels often have no child-row list — every row is a master.
    return undefined;
  }
  const getDetailRows = options.getDetailRows;
  return (row: T) => getDetailRows(row).length > 0;
}

/**
 * Master / detail via display-kind plugin rows (AG Grid–inspired, Angular-native).
 *
 * - Expand state lives on the held adapter (`toggle` / `expandAll` / …)
 * - Detail is a full-width `plugin` display row (`pluginKind: 'masterDetail'`)
 * - Default detail UI is a nested `<al-data-grid>` (`detailColumns` / `detailGrid`)
 * - Override with `detailComponent` for forms or fully custom chrome
 * - Mutually exclusive with `rowGroupPlugin` / `treeDataPlugin` (one display builder)
 *
 * @example
 * ```ts
 * const md = masterDetailPlugin({
 *   getDetailRows: (row) => row.orders,
 *   detailGrid: {
 *     columns: [
 *       { field: 'sku', header: 'SKU' },
 *       { field: 'qty', header: 'Qty', type: 'number' },
 *     ],
 *     rowId: (r) => r.sku,
 *   },
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
  const isRowMaster = resolveIsRowMaster(options);
  const isOpenByDefault = options.isOpenByDefault;
  const hasCustomDetail = !!options.detailComponent;
  const keepDetailGrids = options.keepDetailGrids !== false;

  interface CachedDetail {
    key: string;
    controller: GridController<D>;
    state?: DataGridState;
    selectedIds?: Array<string | number>;
  }
  const detailCache = new Map<string, CachedDetail>();

  const obtainDetailController = (
    masterRowId: string | number,
    cfg: MasterDetailGridOptions<D>,
  ): GridController<D> => {
    const key = detailGridConfigKey(cfg);
    if (!keepDetailGrids) {
      return createDetailGridController(cfg);
    }
    const id = String(masterRowId);
    const hit = detailCache.get(id);
    if (hit && hit.key === key) {
      return hit.controller;
    }
    const controller = createDetailGridController(cfg);
    detailCache.set(id, { key, controller });
    return controller;
  };

  const persistDetailState = (
    masterRowId: string | number,
    api: DataGridApi<D> | null,
  ): void => {
    if (!keepDetailGrids || !api) {
      return;
    }
    const hit = detailCache.get(String(masterRowId));
    if (!hit) {
      return;
    }
    hit.state = api.getState();
    hit.selectedIds = api.getSelectedIds();
  };

  const takePersistedDetailState = (
    masterRowId: string | number,
  ): PersistedDetailGridState | null => {
    const hit = detailCache.get(String(masterRowId));
    if (!hit?.state) {
      return null;
    }
    const snap = { state: hit.state, selectedIds: hit.selectedIds ?? [] };
    hit.state = undefined;
    hit.selectedIds = undefined;
    return snap;
  };

  const openDefaultFor = (row: T): boolean =>
    resolveOpenByDefault(row, isOpenByDefault);

  let plugin!: MasterDetailPlugin<T, D>;
  plugin = {
    id: 'masterDetail',
    expandedIds: adapter.expandedIds,
    collapsedIds: adapter.collapsedIds,
    active: adapter.active,
    isExpanded: (id, openByDefault) => adapter.isExpanded(id, openByDefault),
    toggle: (id, openByDefault) => adapter.toggle(id, openByDefault),
    expand: (id) => adapter.expand(id),
    collapse: (id) => adapter.collapse(id),
    expandAll: (ids) => adapter.expandAll(ids),
    collapseAll: (ids) => adapter.collapseAll(ids),

    expandColumn(columnOptions: MasterDetailExpandColumnOptions = {}): ColumnDef<T> {
      return {
        id: columnOptions.id ?? '__masterDetailExpand',
        header: columnOptions.header ?? '',
        width: columnOptions.width ?? 44,
        minWidth: 36,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: MasterDetailExpandCell,
        cellRendererParams: {
          masterDetail: plugin,
          isRowMaster,
          openByDefault: openDefaultFor,
        },
      };
    },

    setup(context: DataGridPluginContext<T>): () => void {
      const cleanDisplay = context.capabilities.registerDisplayBuilder({
        id: 'masterDetail',
        build: (rows, ctx) =>
          buildMasterDetailDisplayRows({
            rows,
            rowId: ctx.rowId,
            isExpanded: (rowId, row) =>
              adapter.isExpanded(rowId, openDefaultFor(row)),
            getDetailRows,
            isRowMaster,
            detailRowHeight,
            // Re-read options each display pass so in-place `detailGrid` updates flow.
            detailGrid: resolveDetailGrid(options),
            emptyDetailRowHeight: hasCustomDetail ? undefined : EMPTY_DETAIL_ROW_HEIGHT,
            obtainDetailController,
            persistDetailState,
            takePersistedDetailState,
          }),
      });

      const cleanView = context.capabilities.registerDisplayView({
        kind: MASTER_DETAIL_PLUGIN_KIND,
        component: detailView,
      });

      return () => {
        detailCache.clear();
        cleanView();
        cleanDisplay();
      };
    },
  };

  return plugin;
}
