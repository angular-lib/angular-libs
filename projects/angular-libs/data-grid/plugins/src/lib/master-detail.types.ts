import type { Type } from '@angular/core';
import type {
  ColumnDef,
  ColumnOrGroupDef,
  DataGridApi,
  DataGridState,
  GridController,
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

export interface PersistedDetailGridState {
  state: DataGridState;
  selectedIds: Array<string | number>;
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
  /**
   * Default-view hook: reuse a nested controller across remounts
   * (filter-out, virtualization, collapse/expand).
   */
  obtainDetailController?: (config: MasterDetailGridOptions<D>) => GridController<D>;
  /** Snapshot nested sort/filter/selection before the detail view is destroyed. */
  persistDetailState?: (api: DataGridApi<D> | null) => void;
  /** Consume a snapshot saved by {@link persistDetailState} (once). */
  takePersistedDetailState?: () => PersistedDetailGridState | null;
}

export interface MasterDetailPluginOptions<T = unknown, D = unknown> {
  /**
   * Detail rows for a master row (sync).
   * Prefer host-owned data on the master row (AG `getDetailRowData` spirit).
   */
  getDetailRows: (row: T) => readonly D[];
  /**
   * When false, the row has no expand affordance / detail.
   * Default: rows with `getDetailRows(row).length > 0`, or every row when
   * `detailComponent` is set (custom panels often have no child-row list).
   */
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
  /**
   * When there is no explicit expand/collapse override for a row, this value
   * (or predicate) is read on **every display pass**. User toggles persist on
   * the adapter. Default collapsed.
   */
  isOpenByDefault?: boolean | ((row: T) => boolean);
  /**
   * Keep nested default-view controllers + sort/filter/selection across
   * remounts (filter, virtualization, collapse). Default true.
   * Entries are evicted when the master leaves source `[data]` (not when
   * it is only filtered out of the processed list).
   */
  keepDetailGrids?: boolean;
}

export interface MasterDetailExpandColumnOptions {
  width?: number;
  header?: string;
  id?: string;
}
