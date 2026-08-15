import {
  isDataDisplayRow,
  wrapDataRows,
  type DisplayRow,
} from '@angular-libs/data-grid/internals';
import {
  MASTER_DETAIL_PLUGIN_KIND,
  type MasterDetailPayload,
} from './master-detail.types';

export interface BuildMasterDetailRowsOptions<T, D = unknown> {
  rows: readonly T[];
  rowId: (row: T, index: number) => string | number;
  expandedIds: ReadonlySet<string | number>;
  getDetailRows: (row: T) => readonly D[];
  isRowMaster?: (row: T) => boolean;
  detailRowHeight: number;
  detailColumns?: readonly import('@angular-libs/data-grid').ColumnDef<D>[];
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
    expandedIds,
    getDetailRows,
    isRowMaster,
    detailRowHeight,
    detailColumns,
  } = options;

  const out: DisplayRow<T>[] = [];

  for (const data of wrapDataRows(rows, rowId)) {
    out.push(data);
    if (!isDataDisplayRow(data)) {
      continue;
    }

    const master = isRowMaster ? isRowMaster(data.row) : true;
    if (!master || !expandedIds.has(data.rowId)) {
      continue;
    }

    const detailRows = getDetailRows(data.row);
    const payload: MasterDetailPayload<T, D> = {
      master: data.row,
      masterRowId: data.rowId,
      detailRows,
      detailColumns,
    };
    out.push({
      kind: 'plugin',
      pluginKind: MASTER_DETAIL_PLUGIN_KIND,
      id: `md:${String(data.rowId)}`,
      payload,
      height: detailRowHeight,
    });
  }

  return out;
}
