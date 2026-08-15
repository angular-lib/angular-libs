/**
 * Public types for `@angular-libs/data-grid`.
 *
 * Designed for modern Angular (signals, standalone, SSR-safe) — not AG Grid API parity.
 */

import type { FieldTree, SchemaOrSchemaFn } from '@angular/forms/signals';
import type { Type, WritableSignal } from '@angular/core';

export type SortDirection = 'asc' | 'desc';

export type EditMode = 'cell' | 'fullRow';

export type ColumnAlign = 'left' | 'center' | 'right';

export type ColumnFilterType = boolean | 'text' | 'number' | 'boolean' | 'date' | 'set';

export type ColumnDataType = 'text' | 'number' | 'boolean' | 'date';

/** Built-in editor ids — prefer these over string magic renderer names. */
export type BuiltInCellEditor = 'text' | 'number' | 'boolean' | 'date' | 'select';

export type SelectionMode = 'none' | 'single' | 'multi';

export type ColumnPin = 'left' | 'right';

export type SideBarPosition = 'left' | 'right';

export type SideBarPanelId = 'columns' | 'filters' | 'rowGroup';

export type AggFunc =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | ((values: unknown[], rows: readonly unknown[]) => unknown);

export interface SortState {
  columnId: string;
  direction: SortDirection;
}

/** Params passed into a custom cell renderer component via `[params]`. */
export interface CellRendererParams<T = unknown> {
  value: unknown;
  row: T;
  /** Stable host row id from `createGrid({ rowId })`. */
  rowId: string | number;
  rowIndex: number;
  column: ColumnDef<T>;
  columnId: string;
}

/** Params for a custom cell editor component via `[params]`. */
export interface CellEditorParams<T = unknown> extends CellRendererParams<T> {
  draft: string;
  setDraft: (value: string) => void;
  commit: () => void;
  cancel: () => void;
}

export interface CellEditorParamsConfig<T = unknown> {
  /** Options for the built-in `'select'` editor (or custom editors). */
  values?: readonly string[] | ((row: T) => readonly string[]);
  [key: string]: unknown;
}

export interface ColumnDef<T = unknown> {
  /** Stable id. Defaults to `field` or an auto id. */
  id?: string;
  /** Property path on the row object. */
  field?: keyof T & string;
  /** Header label. Defaults to `field` / `id`. */
  header?: string;
  /** Fixed width in pixels. */
  width?: number;
  /** Minimum width when resizing / flexing. */
  minWidth?: number;
  /**
   * Flex grow factor — becomes `minmax(minWidth, Nfr)` in the CSS Grid track list.
   * Prefer `flex` over omitting width when the column should fill space.
   */
  flex?: number;
  /** Enable header click sorting. Default true. */
  sortable?: boolean;
  /** Enable filter UI for this column. */
  filter?: ColumnFilterType;
  /** Allow inline editing. */
  editable?: boolean;
  /** Pin column to an edge. */
  pinned?: ColumnPin;
  align?: ColumnAlign;
  /** Infers filter/editor defaults. */
  type?: ColumnDataType;
  /** Hide from the grid initially (still listed in columns panel). */
  hide?: boolean;
  /** Derive a display/raw value from the row. */
  valueGetter?: (row: T, rowIndex: number) => unknown;
  /** Format a raw value for display. */
  valueFormatter?: (value: unknown, row: T, rowIndex: number) => string;
  /**
   * Immutable write helper used by `applyCellEdit`.
   * Return the next row object (do not mutate `row`).
   */
  valueSetter?: (params: ValueSetterParams<T>) => T | undefined;
  /** Static or dynamic cell class names. */
  cellClass?: string | ((value: unknown, row: T, rowIndex: number) => string | string[] | null | undefined);
  /** Custom sort comparator. */
  comparator?: (a: unknown, b: unknown, rowA: T, rowB: T) => number;
  /**
   * Optional Angular component renderer (typed `Type`, not a string name).
   * Component should expose an `params` input of type `CellRendererParams<T>`.
   * Templates (`alGridCell`) take precedence when both are set.
   */
  cellRenderer?: Type<unknown>;
  /**
   * Optional bag merged into custom cell renderer `params`
   * (e.g. master-detail expand adapter).
   */
  cellRendererParams?: Record<string, unknown>;
  /**
   * Built-in editor id or a custom editor component (`params: CellEditorParams`).
   * Default inferred from `type` / boolean detection.
   */
  cellEditor?: BuiltInCellEditor | Type<unknown>;
  /** Extra config for editors (e.g. `values` for `'select'`). */
  cellEditorParams?: CellEditorParamsConfig<T>;
  /** Aggregate for pinned footer row (`aggregateRowPlugin`). */
  aggFunc?: AggFunc;
}

/** Nested header group — children are columns or further groups. */
export interface ColumnGroupDef<T = unknown> {
  id?: string;
  headerName: string;
  children: Array<ColumnDef<T> | ColumnGroupDef<T>>;
}

export type ColumnOrGroupDef<T = unknown> = ColumnDef<T> | ColumnGroupDef<T>;

export interface ValueSetterParams<T = unknown> {
  row: T;
  column: ColumnDef<T>;
  columnId: string;
  previousValue: unknown;
  value: unknown;
}

/** Row-level class — set on `DataGrid` via `[rowClass]`. */
export type RowClassFn<T = unknown> =
  | string
  | string[]
  | ((row: T, rowIndex: number) => string | string[] | null | undefined);

export interface CellEditEvent<T = unknown> {
  row: T;
  rowId: string | number;
  column: ColumnDef<T>;
  columnId: string;
  previousValue: unknown;
  value: unknown;
  /** Present when the edit ran inside a full-row signal form session. */
  form?: FieldTree<T> | null;
}

/** Active full-row edit session — form tree available for validation / custom UI. */
export interface RowEditContext<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  /** Draft model the FieldTree writes into (`form().value`). */
  draft: WritableSignal<T>;
  /** Angular Signal Forms tree for the row — same reference as host `[rowForm]` when provided. */
  form: FieldTree<T>;
  /** Field for a column id/field, or null when unbound. */
  field: (column: ColumnDef<T> | string) => FieldTree<unknown> | null;
  commit: () => boolean;
  cancel: () => void;
}

export interface RowEditEvent<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  previousValue: T;
  value: T;
  form: FieldTree<T>;
}

/**
 * Optional factory when the grid owns the form session.
 * Prefer binding a persistent `[rowForm]="form(model, schema)"` when you need the FieldTree outside the grid.
 */
export type CreateRowFormFn<T = unknown> = (
  draft: WritableSignal<T>,
) => FieldTree<T>;

export type RowEditSchema<T = unknown> = SchemaOrSchemaFn<T>;

export interface CellClickEvent<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  column: ColumnDef<T>;
  columnId: string;
  value: unknown;
  event: MouseEvent;
}

/** Context passed into menu item factories / templates. */
export interface DataGridContextMenuContext<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  column: ResolvedColumn<T>;
  columnId: string;
  value: unknown;
  event: MouseEvent;
  selectedIds: Array<string | number>;
  /** Active full-row edit form when that row is being edited. */
  form: FieldTree<T> | null;
  close: () => void;
}

/** Typed menu action — no AG-style magic strings. */
export interface DataGridContextMenuItem<T = unknown> {
  id: string;
  label: string;
  disabled?: boolean;
  /** Visual separator before this item. */
  separator?: boolean;
  shortcut?: string;
  action?: (ctx: DataGridContextMenuContext<T>) => void;
}

export type DataGridContextMenuItems<T = unknown> =
  | readonly DataGridContextMenuItem<T>[]
  | ((ctx: DataGridContextMenuContext<T>) => readonly DataGridContextMenuItem<T>[]);

export interface RowClickEvent<T = unknown> {
  row: T;
  rowId: string | number;
  rowIndex: number;
  event: MouseEvent;
}

/** Emitted when `rowDragPlugin` reorders displayed rows. */
export interface RowReorderEvent<T = unknown> {
  fromIndex: number;
  toIndex: number;
  /** Row id at the drag source (before reorder). */
  fromId: string | number;
  /** Row id at the drop target (before reorder). */
  toId: string | number;
  rowIds: Array<string | number>;
  /**
   * Processed rows after reorder. Host should sync source data when the list is
   * flat and unsorted/unfiltered — prefer `fromId`/`toId` when applying to source.
   */
  rows: T[];
}

/** Emitted when paste is handled (`clipboardPlugin`). */
export interface PasteEvent<T = unknown> {
  startRowIndex: number;
  columnIds: string[];
  matrix: string[][];
  /** Suggested next rows if host applies field writes. */
  suggestedRows: T[];
}

/**
 * Single contiguous cell range (Wave 4 / OVERVIEW §5).
 * Coordinates are display-row indexes (`FocusCell.rowIndex`).
 */
export interface CellRange {
  anchor: { rowIndex: number; columnId: string };
  active: { rowIndex: number; columnId: string };
}

/**
 * Fill drag result — same write path as paste (`suggestedRows`).
 * Emitted via `(paste)` when a fill handle completes (v1).
 */
export interface FillEvent<T = unknown> extends PasteEvent<T> {
  range: CellRange;
  source: CellRange;
}

export interface DataGridFilterState {
  [columnId: string]: string;
}

/** Snapshot for persist / restore (localStorage, URL, etc.). */
export interface DataGridState {
  sorts: SortState[];
  filters: DataGridFilterState;
  quickFilter: string;
  hiddenColumnIds: string[];
  columnOrder: string[];
  widthOverrides: Record<string, number>;
  /**
   * Explicit pin per column id (`null` = unpinned).
   * Together with `columnOrder` this is the column layout snapshot.
   */
  columnPins: Record<string, ColumnPin | null>;
  pageIndex: number;
  activeSidePanel: string | null;
}

/** Emitted in server-side mode so the host can fetch. */
export interface DataGridQuery {
  sorts: SortState[];
  filters: DataGridFilterState;
  quickFilter: string;
  pageIndex: number;
  pageSize: number;
}

export interface SideBarConfig {
  /**
   * Built-in panels to register (`sideBarPlugin`).
   * Custom panels use `registerSidebar` with any string id.
   * Defaults to columns + filters.
   */
  panels?: SideBarPanelId[];
  /** Dock side. Default `right`. */
  position?: SideBarPosition;
  /**
   * Initially open panel id (built-in or custom `registerSidebar` id).
   * Default first registered panel.
   */
  defaultPanel?: string | null;
  /** Start collapsed (icons only / closed). Default false. */
  collapsed?: boolean;
}

/** Internal resolved column used by the grid renderer. */
export interface ResolvedColumn<T = unknown> extends ColumnDef<T> {
  id: string;
  header: string;
  sortable: boolean;
  minWidth: number;
}
