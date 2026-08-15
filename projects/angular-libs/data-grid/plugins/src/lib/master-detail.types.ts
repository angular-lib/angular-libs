import type { Type } from '@angular/core';
import type {
  ColumnDef,
  ColumnOrGroupDef,
  SelectionMode,
} from '@angular-libs/data-grid';
import type { DataGridPlugin } from '@angular-libs/data-grid/plugin';
import type {
  GridChromeOptions,
  GridViewportOptions,
} from '@angular-libs/data-grid';

/** Stable display-view / pluginKind id for master-detail detail rows. */
export const MASTER_DETAIL_PLUGIN_KIND = 'masterDetail';

/**
 * Options for the nested detail `<al-data-grid>` (AG `detailGridOptions` spirit).
 * Created once per expanded detail panel instance.
 */
export interface MasterDetailGridOptions<D = unknown> {
  columns: readonly ColumnOrGroupDef<D>[];
  rowId?: (row: D, index: number) => string | number;
  /** Default: no plugins (lean nested grid). */
  plugins?: readonly DataGridPlugin<D>[];
  selection?: SelectionMode;
  /** Defaults: `virtual: false`, `rowHeight: 32`. */
  viewport?: GridViewportOptions;
  /** Defaults: toolbar / floating filters off. */
  chrome?: GridChromeOptions;
}

export interface MasterDetailPayload<T = unknown, D = unknown> {
  master: T;
  masterRowId: string | number;
  detailRows: readonly D[];
  /**
   * Nested detail grid config (preferred).
   * `detailColumns` alone is normalized into this by the plugin.
   */
  detailGrid?: MasterDetailGridOptions<D>;
  /** @deprecated Prefer `detailGrid.columns` — kept for payload readers. */
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
   * Shorthand for `detailGrid: { columns }` — nested `<al-data-grid>`.
   * Ignored when `detailComponent` is set.
   */
  detailColumns?: readonly ColumnDef<D>[];
  /**
   * Full nested grid options (AG `detailGridOptions`).
   * Takes precedence over `detailColumns` when both are set.
   */
  detailGrid?: MasterDetailGridOptions<D>;
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
