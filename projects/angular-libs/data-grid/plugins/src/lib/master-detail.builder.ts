import {
  isDataDisplayRow,
  wrapDataRows,
  type DisplayRow,
} from '@angular-libs/data-grid/internals';
import {
  MASTER_DETAIL_PLUGIN_KIND,
  type MasterDetailGridOptions,
  type MasterDetailPayload,
  type PersistedDetailGridState,
} from './master-detail.types';
import type { DataGridApi, DataGridNestedRealm, GridController } from '@angular-libs/data-grid';

/** Compact height for an expanded master with no detail rows (default nested grid). */
export const EMPTY_DETAIL_ROW_HEIGHT = 48;

export interface BuildMasterDetailRowsOptions<T, D = unknown> {
  rows: readonly T[];
  rowId: (row: T, index: number) => string | number;
  /** Pure expand check (adapter + optional open-by-default). */
  isExpanded: (rowId: string | number, row: T) => boolean;
  getDetailRows: (row: T) => readonly D[];
  registerNestedRealm?: (
    masterRowId: string | number,
    realm: DataGridNestedRealm | null,
  ) => void;
  isRowMaster?: (row: T) => boolean;
  detailRowHeight: number;
  detailGrid?: MasterDetailGridOptions<D>;
  /**
   * When set, expanded masters with zero detail rows use this height instead of
   * `detailRowHeight` (avoids a 200px empty nested grid). Omit for custom
   * `detailComponent` panels that still want the full slot.
   */
  emptyDetailRowHeight?: number;
  obtainDetailController?: (
    masterRowId: string | number,
    config: MasterDetailGridOptions<D>,
  ) => GridController<D>;
  persistDetailState?: (
    masterRowId: string | number,
    api: DataGridApi<D> | null,
  ) => void;
  takePersistedDetailState?: (
    masterRowId: string | number,
  ) => PersistedDetailGridState | null;
}

/**
 * Flat masters + optional full-width detail plugin rows (AG master/detail spirit).
 */
export function buildMasterDetailDisplayRows<T, D = unknown>(
  options: BuildMasterDetailRowsOptions<T, D>,
): DisplayRow<T>[] {
  const {
    rows,
    rowId,
    isExpanded,
    getDetailRows,
    registerNestedRealm,
    isRowMaster,
    detailRowHeight,
    detailGrid,
    emptyDetailRowHeight,
    obtainDetailController,
    persistDetailState,
    takePersistedDetailState,
  } = options;

  const out: DisplayRow<T>[] = [];

  for (const data of wrapDataRows(rows, rowId)) {
    out.push(data);
    if (!isDataDisplayRow(data)) {
      continue;
    }

    const master = isRowMaster ? isRowMaster(data.row) : true;
    if (!master || !isExpanded(data.rowId, data.row)) {
      continue;
    }

    const detailRows = readSyncDetailRows(getDetailRows, data.row);
    const payload: MasterDetailPayload<T, D> = {
      master: data.row,
      masterRowId: data.rowId,
      detailRows,
      detailGrid,
      obtainDetailController: obtainDetailController
        ? (cfg) => obtainDetailController(data.rowId, cfg)
        : undefined,
      persistDetailState: persistDetailState
        ? (api) => persistDetailState(data.rowId, api)
        : undefined,
      takePersistedDetailState: takePersistedDetailState
        ? () => takePersistedDetailState(data.rowId)
        : undefined,
      registerNestedRealm: registerNestedRealm
        ? (realm) => registerNestedRealm(data.rowId, realm)
        : undefined,
    };
    const empty = detailRows.length === 0;
    out.push({
      kind: 'plugin',
      pluginKind: MASTER_DETAIL_PLUGIN_KIND,
      id: `md:${String(data.rowId)}`,
      payload,
      height:
        empty && emptyDetailRowHeight != null ? emptyDetailRowHeight : detailRowHeight,
    });
  }

  return out;
}

/** 1.0 contract: `getDetailRows` is synchronous. Promises are rejected, not awaited. */
export function readSyncDetailRows<T, D>(
  getDetailRows: (row: T) => readonly D[],
  row: T,
): readonly D[] {
  const rows = getDetailRows(row) as readonly D[] | { then?: unknown };
  if (rows != null && typeof (rows as { then?: unknown }).then === 'function') {
    console.warn(
      '@angular-libs/data-grid: getDetailRows must return a synchronous array. ' +
        'Lazy/async load-on-expand is Never for 1.0 — embed detail rows on the master.',
    );
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}
