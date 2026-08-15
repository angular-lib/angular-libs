import type { Type } from '@angular/core';
import type { ColumnDef } from '@angular-libs/data-grid';

/** Stable display-view / pluginKind id for master-detail detail rows. */
export const MASTER_DETAIL_PLUGIN_KIND = 'masterDetail';

export interface MasterDetailPayload<T = unknown, D = unknown> {
  master: T;
  masterRowId: string | number;
  detailRows: readonly D[];
  /** Present when using the built-in detail table. */
  detailColumns?: readonly ColumnDef<D>[];
}

export interface MasterDetailPluginOptions<T = unknown, D = unknown> {
  /**
   * Detail rows for a master row (sync).
   * Prefer host-owned data on the master row (AG `getDetailRowData` spirit).
   */
  getDetailRows: (row: T) => readonly D[];
  /** When false, the row has no expand affordance / detail. Default: all rows. */
  isRowMaster?: (row: T) => boolean;
  /** Fixed height for the inserted detail display row. Default `200`. */
  detailRowHeight?: number;
  /**
   * Columns for the built-in detail table (`D` row type).
   * Ignored when `detailComponent` is set.
   */
  detailColumns?: readonly ColumnDef<D>[];
  /**
   * Custom detail panel. Component inputs: `item` (CustomDisplayRow with
   * {@link MasterDetailPayload} payload) and `api`.
   */
  detailComponent?: Type<unknown>;
  /** Seed expanded masters on first encounter. Default collapsed. */
  isOpenByDefault?: boolean | ((row: T) => boolean);
}

export interface MasterDetailExpandColumnOptions {
  width?: number;
  header?: string;
  id?: string;
}
