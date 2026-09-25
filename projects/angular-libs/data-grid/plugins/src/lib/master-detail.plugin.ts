import {
  adapterKey,
  defaultGridLocale,
  type ColumnDef,
  type DataGridApi,
  type DataGridLocale,
  type DataGridState,
  type GridController,
} from '@angular-libs/data-grid';
import type { DataGridNestedRealm } from '@angular-libs/data-grid';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';
import {
  createMasterDetailAdapter,
  type MasterDetailAdapter,
} from './master-detail.adapter';
import {
  buildMasterDetailDisplayRows,
  EMPTY_DETAIL_ROW_HEIGHT,
  readSyncDetailRows,
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
  type MasterDetailPayload,
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

/** Discovery key — `api.getAdapter(MASTER_DETAIL_ADAPTER)` (the shared expand store). */
export const MASTER_DETAIL_ADAPTER = adapterKey<MasterDetailAdapter>('masterDetail');

/** DOM id of an open detail row — the master row's `aria-details` target. */
export function masterDetailRegionId(rowId: string | number): string {
  return `al-dg-detail-${String(rowId)}`;
}
export { createMasterDetailAdapter } from './master-detail.adapter';
export {
  buildMasterDetailDisplayRows,
  EMPTY_DETAIL_ROW_HEIGHT,
  readSyncDetailRows,
} from './master-detail.builder';
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
    /** Enter the nested detail grid for an expanded master (cell-widget activate). */
    enterDetail(rowId: string | number): boolean;
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
  return (row: T) => readSyncDetailRows(getDetailRows, row).length > 0;
}

/**
 * Master / detail via display-kind plugin rows (AG Grid–inspired, Angular-native).
 *
 * - Expand state lives on the held adapter (`toggle` / `expandAll` / …)
 * - Detail is a full-width `plugin` display row (`pluginKind: 'masterDetail'`)
 * - Default detail UI is a nested `<al-data-grid>` (`detailColumns` / `detailGrid`)
 * - Override with `detailComponent` for forms or fully custom chrome
 * - Mutually exclusive with `rowGroupPlugin` / `treeDataPlugin` (one display builder)
 * - Keyboard: the expand column is a cell widget (Enter / Space toggle, Enter on an
 *   open master enters the nested grid); open masters get `aria-details`
 * - One instance may serve several grids: expand state (the held adapter) is shared,
 *   nested detail controllers / focus realms are per grid
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
  /** Ids of columns created by {@link MasterDetailPlugin.expandColumn}. */
  const expandColumnIds = new Set<string>();

  interface CachedDetail {
    key: string;
    controller: GridController<D>;
    state?: DataGridState;
    selectedIds?: Array<string | number>;
  }
  /** Per attached grid — nested controllers + focus realms never cross grids. */
  interface GridDetails {
    getLocale: () => DataGridLocale;
    detailCache: Map<string, CachedDetail>;
    nestedRealms: Map<string, DataGridNestedRealm>;
  }
  const grids = new Map<DataGridPluginContext<T>, GridDetails>();
  const getLocale = (): DataGridLocale =>
    grids.values().next().value?.getLocale() ?? defaultGridLocale;

  const evictStaleDetailCaches = (
    grid: GridDetails,
    activeRows: readonly T[],
    rowId: (row: T, index: number) => string | number,
  ): void => {
    if (!keepDetailGrids || grid.detailCache.size === 0) {
      return;
    }
    const active = new Set<string>();
    for (let i = 0; i < activeRows.length; i++) {
      active.add(String(rowId(activeRows[i]!, i)));
    }
    for (const id of [...grid.detailCache.keys()]) {
      if (!active.has(id)) {
        grid.detailCache.delete(id);
      }
    }
  };

  const obtainDetailController = (
    grid: GridDetails,
    masterRowId: string | number,
    cfg: MasterDetailGridOptions<D>,
  ): GridController<D> => {
    const key = detailGridConfigKey(cfg);
    if (!keepDetailGrids) {
      return createDetailGridController(cfg);
    }
    const id = String(masterRowId);
    const hit = grid.detailCache.get(id);
    if (hit && hit.key === key) {
      return hit.controller;
    }
    const controller = createDetailGridController(cfg);
    grid.detailCache.set(id, { key, controller });
    return controller;
  };

  const persistDetailState = (
    grid: GridDetails,
    masterRowId: string | number,
    api: DataGridApi<D> | null,
  ): void => {
    if (!keepDetailGrids || !api) {
      return;
    }
    const hit = grid.detailCache.get(String(masterRowId));
    if (!hit) {
      return;
    }
    hit.state = api.getState();
    hit.selectedIds = api.getSelectedIds();
  };

  const takePersistedDetailState = (
    grid: GridDetails,
    masterRowId: string | number,
  ): PersistedDetailGridState | null => {
    const hit = grid.detailCache.get(String(masterRowId));
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
    enterDetail(rowId) {
      for (const grid of grids.values()) {
        if (grid.nestedRealms.get(String(rowId))?.enter()) {
          return true;
        }
      }
      return false;
    },

    expandColumn(columnOptions: MasterDetailExpandColumnOptions = {}): ColumnDef<T> {
      const id = columnOptions.id ?? '__masterDetailExpand';
      expandColumnIds.add(id);
      return {
        id,
        header: columnOptions.header ?? '',
        width: columnOptions.width ?? 44,
        minWidth: 36,
        sortable: false,
        filter: false,
        editable: false,
        suppressExport: true,
        cellRenderer: MasterDetailExpandCell,
        cellRendererParams: {
          masterDetail: plugin,
          isRowMaster,
          openByDefault: openDefaultFor,
          getLocale,
        },
      };
    },

    setup(context: DataGridPluginContext<T>): () => void {
      const grid: GridDetails = {
        getLocale: () => context.api.getLocale(),
        detailCache: new Map(),
        nestedRealms: new Map(),
      };
      grids.set(context, grid);
      const isMaster = (row: T): boolean => (isRowMaster ? isRowMaster(row) : true);

      const cleanDisplay = context.capabilities.registerDisplayBuilder({
        id: 'masterDetail',
        build: (rows, ctx) => {
          const source =
            typeof context.api.getSourceRows === 'function'
              ? context.api.getSourceRows()
              : rows;
          evictStaleDetailCaches(grid, source, ctx.rowId);
          return buildMasterDetailDisplayRows({
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
            obtainDetailController: (masterRowId, cfg) =>
              obtainDetailController(grid, masterRowId, cfg),
            persistDetailState: (masterRowId, api) =>
              persistDetailState(grid, masterRowId, api),
            takePersistedDetailState: (masterRowId) =>
              takePersistedDetailState(grid, masterRowId),
            registerNestedRealm: (masterRowId, realm) => {
              const key = String(masterRowId);
              if (realm) {
                grid.nestedRealms.set(key, realm);
              } else {
                grid.nestedRealms.delete(key);
              }
            },
          });
        },
      });

      const cleanView = context.capabilities.registerDisplayView({
        kind: MASTER_DETAIL_PLUGIN_KIND,
        component: detailView,
        // The detail panel is its own focus realm (nested grid / custom form).
        nestedWidget: true,
        regionId: (item) => {
          const id = (item.payload as MasterDetailPayload<T, D> | undefined)?.masterRowId;
          return id == null ? null : masterDetailRegionId(id);
        },
      });

      // Expand column = cell widget: Enter / Space toggle; Enter on an open master enters the detail.
      const cleanWidget = context.capabilities.registerCellWidget({
        id: 'masterDetailExpand',
        columnId: (columnId) => expandColumnIds.has(columnId),
        isActive: (row) => isMaster(row),
        toggle: (row, rowId) => adapter.toggle(rowId, openDefaultFor(row)),
        enter: (row, rowId) =>
          adapter.isExpanded(rowId, openDefaultFor(row)) &&
          (grid.nestedRealms.get(String(rowId))?.enter() ?? false),
      });

      const cleanAria = context.capabilities.registerRowAria({
        id: 'masterDetail',
        ariaDetails: (row, rowId) =>
          isMaster(row) && adapter.isExpanded(rowId, openDefaultFor(row))
            ? masterDetailRegionId(rowId)
            : null,
      });

      const cleanAdapter = context.adapters.register(MASTER_DETAIL_ADAPTER, adapter);

      return () => {
        grid.detailCache.clear();
        grid.nestedRealms.clear();
        grids.delete(context);
        cleanAdapter();
        cleanAria();
        cleanWidget();
        cleanView();
        cleanDisplay();
      };
    },
  };

  return plugin;
}
