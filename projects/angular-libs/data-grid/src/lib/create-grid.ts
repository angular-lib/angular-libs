/**
 * createGrid — held config + plugin adapters (schema/state wiring + UX flags).
 * The DataGrid component binds `[controller]`; host still owns row data by default.
 * Opt-in `rows` WritableSignal enables controller-owned transactions (§5a).
 * Viewport / chrome / multiSort / serverSide live here — not as binder inputs.
 */

import { signal, type Signal, type WritableSignal } from '@angular/core';
import type {
  DataGridApi,
  BoundCellRangeAdapter,
  BoundRowGroupAdapter,
  BoundTreeDataAdapter,
} from './api/grid-api';
import type {
  ColumnOrGroupDef,
  CreateRowFormFn,
  EditMode,
  RowEditSchema,
  SelectionMode,
} from './components/data-grid/data-grid.types';
import type { DataGridPlugin } from './plugins/types';
import type { GridCapabilities, RowModelContext } from './plugins/capabilities';
import {
  runGridRowModel,
  type GridRowModelInput,
  type GridRowModelResult,
} from './utils/grid-row-model';
import type { AfterSortHook } from './utils/row-pipeline';
import {
  applyRowTransaction,
  type RowTransaction,
  type RowTransactionResult,
} from './utils/apply-row-transaction';
import {
  resolveEditInteraction,
  type EditInteractionInput,
  type ResolvedEditInteraction,
} from './editing/edit-interaction';

export type IsRowSelectableFn<T> = (row: T, rowId: string | number) => boolean;

export interface GridViewportOptions {
  pagination?: boolean; // default false
  pageSize?: number; // default 25
  virtual?: boolean; // default true
  rowHeight?: number; // default 36
  overscan?: number; // default 8
}

export interface GridChromeOptions {
  showToolbar?: boolean; // default true
  floatingFilters?: boolean; // default true
  stripe?: boolean; // default true
  columnReorder?: boolean; // default true
  /** Enable context menu chrome (items still from binder). default false */
  contextMenu?: boolean;
}

export interface CreateGridOptions<T = unknown> {
  columns: readonly ColumnOrGroupDef<T>[];
  rowId?: (row: T, index: number) => string | number;
  plugins?: readonly DataGridPlugin<T>[];
  selection?: SelectionMode;
  /**
   * When false, the row cannot be selected via checkbox / Space / click-select.
   * Default: all rows selectable.
   */
  isRowSelectable?: IsRowSelectableFn<T>;
  /**
   * When true, clicking a data row (outside the checkbox) toggles selection.
   * Default false — checkbox / Space own row selection (§5d).
   */
  rowClickSelects?: boolean;
  /** Schema wiring for full-row Signal Forms (component still binds `[rowForm]`). */
  editMode?: EditMode;
  rowEditSchema?: RowEditSchema<T> | null;
  createRowForm?: CreateRowFormFn<T> | null;
  /**
   * Edit start/stop policy (§5b). Prefer `'default' | 'excel'`; sparse overrides OK.
   */
  editInteraction?: EditInteractionInput;
  /**
   * Opt-in controller-owned rows (§5a). Same signal the host binds as `[data]`.
   * Enables {@link GridController.applyTransaction} / {@link GridController.setRows}.
   */
  rows?: WritableSignal<readonly T[]>;
  /** Pagination / virtualization knobs (writable on the controller). */
  viewport?: GridViewportOptions;
  /** Toolbar / filters / stripe / reorder / context-menu chrome flags. */
  chrome?: GridChromeOptions;
  /** Allow Shift+click multi-column sort. Default true. */
  multiSort?: boolean;
  /** Skip client sort/filter; emit `queryChange` instead. Default false. */
  serverSide?: boolean;
}

/**
 * Host-facing controller produced by {@link createGrid}.
 * Prefer holding plugin instances yourself for adapter DX (`groups.setColumns`).
 */
export interface GridController<T = unknown> {
  readonly columns: readonly ColumnOrGroupDef<T>[];
  readonly rowId: (row: T, index: number) => string | number;
  /** Plugin list — prefer adapter toggles; use {@link setPlugins} only for rare full recomposition. */
  readonly plugins: Signal<readonly DataGridPlugin<T>[]>;
  readonly selection: SelectionMode;
  readonly isRowSelectable: IsRowSelectableFn<T> | null;
  readonly rowClickSelects: boolean;
  /** Writable — toggle cell vs full-row edit at runtime (`grid.editMode.set('fullRow')`). */
  readonly editMode: WritableSignal<EditMode>;
  readonly editInteraction: ResolvedEditInteraction;
  readonly rowEditSchema: RowEditSchema<T> | null;
  readonly createRowForm: CreateRowFormFn<T> | null;
  /**
   * Controller-owned rows when `createGrid({ rows })` was used; otherwise `null`.
   * Prefer binding `[data]="grid.rows()!"` (or the same host signal).
   */
  readonly rows: Signal<readonly T[]> | null;
  /**
   * Typed adapter when `rowGroupPlugin` is in `plugins`.
   * Prefer holding the plugin instance; this is for discovery.
   */
  readonly rowGroup: BoundRowGroupAdapter | null;
  /**
   * Typed adapter when `treeDataPlugin` is in `plugins`.
   * Prefer holding the plugin instance; this is for discovery.
   */
  readonly treeData: BoundTreeDataAdapter | null;
  /**
   * Typed adapter when `cellRangePlugin` is in `plugins`.
   * Prefer holding the plugin instance; this is for discovery.
   */
  readonly cellRange: BoundCellRangeAdapter | null;
  /** Populated when a DataGrid binds via `[controller]`. */
  readonly api: Signal<DataGridApi<T> | null>;
  /** Viewport UX flags — toggle at runtime from demos / hosts. */
  readonly viewport: {
    pagination: WritableSignal<boolean>;
    pageSize: WritableSignal<number>;
    virtual: WritableSignal<boolean>;
    rowHeight: WritableSignal<number>;
    overscan: WritableSignal<number>;
  };
  /** Chrome UX flags — toggle at runtime from demos / hosts. */
  readonly chrome: {
    showToolbar: WritableSignal<boolean>;
    floatingFilters: WritableSignal<boolean>;
    stripe: WritableSignal<boolean>;
    columnReorder: WritableSignal<boolean>;
    contextMenu: WritableSignal<boolean>;
  };
  readonly multiSort: WritableSignal<boolean>;
  readonly serverSide: WritableSignal<boolean>;
  /** Typed adapter lookup — prefer holding the plugin instance; this is for discovery. */
  getAdapter<A>(id: string, guard: (value: unknown) => value is A): A | null;
  /** Replace the plugin list (reactivates on the bound grid). */
  setPlugins(plugins: readonly DataGridPlugin<T>[]): void;
  bindApi(api: DataGridApi<T> | null): void;
  /**
   * Immutable batch update on controller-owned `rows`. Throws if `rows` was not provided.
   */
  applyTransaction(tx: RowTransaction<T>): RowTransactionResult<T>;
  /** Full replace of controller-owned `rows`. Throws if `rows` was not provided. */
  setRows(next: readonly T[]): void;
  /**
   * Run the client row model (filter → sort → stages → display) for tests /
   * tooling. Pass live `capabilities` from a mounted grid when plugins matter.
   */
  computeRowModel(
    input: Omit<GridRowModelInput<T>, 'rowModelContext'> & {
      rowModelContext?: RowModelContext<T>;
      capabilities?: GridCapabilities<T> | null;
    },
    afterSort?: AfterSortHook<T> | null,
  ): GridRowModelResult<T>;
}

/**
 * Bootstrap a grid without a god `gridOptions` bag.
 *
 * @example
 * ```ts
 * const groups = rowGroupPlugin({ columns: ['department'] });
 * const rows = signal(initial);
 * const grid = createGrid({
 *   columns,
 *   rowId: (r) => r.id,
 *   rows,
 *   selection: 'multi',
 *   editInteraction: 'default',
 *   viewport: { pagination: false, virtual: true, pageSize: 25 },
 *   chrome: { contextMenu: true, showToolbar: true },
 *   plugins: [...defaultGridPlugins(), groups],
 * });
 * groups.setColumns(['role']);
 * grid.viewport.pagination.set(true);
 * grid.viewport.virtual.set(false);
 * grid.editMode.set('fullRow');
 * grid.applyTransaction({ add: [{ id: 'x', name: 'New' }] });
 * ```
 *
 * ```html
 * <al-data-grid [controller]="grid" [data]="grid.rows()!" />
 * ```
 *
 * Schema (`columns`, `rowId`, `selection`, `editMode`) lives only on `createGrid` —
 * not as binder input overrides.
 */
export function createGrid<T = unknown>(options: CreateGridOptions<T>): GridController<T> {
  const plugins: WritableSignal<readonly DataGridPlugin<T>[]> = signal(options.plugins ?? []);
  const api = signal<DataGridApi<T> | null>(null);
  const rowId = options.rowId ?? ((_row: T, index: number) => index);
  const ownedRows = options.rows ?? null;
  const editInteraction = resolveEditInteraction(options.editInteraction);

  const viewport = {
    pagination: signal(options.viewport?.pagination ?? false),
    pageSize: signal(options.viewport?.pageSize ?? 25),
    virtual: signal(options.viewport?.virtual ?? true),
    rowHeight: signal(options.viewport?.rowHeight ?? 36),
    overscan: signal(options.viewport?.overscan ?? 8),
  };
  const chrome = {
    showToolbar: signal(options.chrome?.showToolbar ?? true),
    floatingFilters: signal(options.chrome?.floatingFilters ?? true),
    stripe: signal(options.chrome?.stripe ?? true),
    columnReorder: signal(options.chrome?.columnReorder ?? true),
    contextMenu: signal(options.chrome?.contextMenu ?? false),
  };
  const multiSort = signal(options.multiSort ?? true);
  const serverSide = signal(options.serverSide ?? false);

  const requireOwnedRows = (): WritableSignal<readonly T[]> => {
    if (!ownedRows) {
      throw new Error(
        'createGrid: applyTransaction/setRows require createGrid({ rows: WritableSignal }).',
      );
    }
    return ownedRows;
  };

  const getAdapter = <A>(id: string, guard: (value: unknown) => value is A): A | null =>
    pickAdapter(plugins(), id, guard);

  return {
    columns: options.columns,
    rowId,
    plugins: plugins.asReadonly(),
    selection: options.selection ?? 'none',
    isRowSelectable: options.isRowSelectable ?? null,
    rowClickSelects: options.rowClickSelects ?? false,
    editMode: signal(options.editMode ?? 'cell'),
    editInteraction,
    rowEditSchema: options.rowEditSchema ?? null,
    createRowForm: options.createRowForm ?? null,
    rows: ownedRows?.asReadonly() ?? null,
    viewport,
    chrome,
    multiSort,
    serverSide,
    getAdapter,
    get rowGroup() {
      return getAdapter('rowGroup', isRowGroupAdapter);
    },
    get treeData() {
      return getAdapter('treeData', isTreeDataAdapter);
    },
    get cellRange() {
      return getAdapter('cellRange', isCellRangeAdapter);
    },
    api: api.asReadonly(),
    setPlugins(next) {
      plugins.set([...next]);
      // Kernel-owned recomposition (no-ops until the grid has mounted).
      api()?.recomposePlugins(next);
    },
    bindApi(next) {
      api.set(next);
    },
    applyTransaction(tx) {
      const rowsSig = requireOwnedRows();
      const result = applyRowTransaction(rowsSig(), tx, rowId);
      rowsSig.set(result.rows);
      return result;
    },
    setRows(next) {
      requireOwnedRows().set([...next]);
    },
    computeRowModel(input, afterSort) {
      const rowModelContext: RowModelContext<T> = input.rowModelContext ?? {
        columnsById: input.columnsById,
        rowId,
        collapsedGroupIds: new Set(),
      };
      return runGridRowModel({ ...input, rowModelContext }, afterSort);
    },
  };
}

/**
 * Resolve a typed plugin∩adapter from a plugin list by stable `id`.
 * Prefer {@link GridController.getAdapter} when you already hold a controller.
 */
export function pickAdapter<T, A>(
  plugins: readonly DataGridPlugin<T>[],
  id: string,
  guard: (value: unknown) => value is A,
): A | null {
  for (const plugin of plugins) {
    if (plugin.id === id && guard(plugin)) {
      return plugin;
    }
  }
  return null;
}

/** Type guard for {@link BoundRowGroupAdapter} (and `rowGroupPlugin` instances). */
export function isRowGroupAdapter(value: unknown): value is BoundRowGroupAdapter {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as BoundRowGroupAdapter;
  return (
    typeof v.setColumns === 'function' &&
    typeof v.clear === 'function' &&
    typeof v.columns === 'function' &&
    typeof v.active === 'function'
  );
}

/** Type guard for {@link BoundTreeDataAdapter} (and `treeDataPlugin` instances). */
export function isTreeDataAdapter(value: unknown): value is BoundTreeDataAdapter {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as BoundTreeDataAdapter;
  return (
    typeof v.toggleCollapsed === 'function' &&
    typeof v.expandAll === 'function' &&
    typeof v.collapseAll === 'function' &&
    typeof v.collapsedIds === 'function' &&
    typeof v.collectAllGroupIds === 'function'
  );
}

/** Type guard for {@link BoundCellRangeAdapter} (and `cellRangePlugin` instances). */
export function isCellRangeAdapter(value: unknown): value is BoundCellRangeAdapter {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as BoundCellRangeAdapter;
  return (
    typeof v.getRange === 'function' &&
    typeof v.setRange === 'function' &&
    typeof v.clearRange === 'function' &&
    typeof v.getClipboardText === 'function' &&
    typeof v.extendRange === 'function'
  );
}
