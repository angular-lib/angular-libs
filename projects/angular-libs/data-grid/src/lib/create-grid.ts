/**
 * createGrid — held config + plugin adapters (schema/state wiring + UX flags).
 * The DataGrid component binds `[controller]`; host still owns row data by default.
 * Opt-in `rows` WritableSignal enables controller-owned transactions (§5a).
 * Viewport / chrome / multiSort / serverSide live here — not as binder inputs.
 */

import { computed, isDevMode, signal, type Signal, type WritableSignal } from '@angular/core';
import type { DataGridApi } from './api/grid-api';
import type { AdapterKey } from './plugins/adapter-registry';
import type {
  ColumnOrGroupDef,
  CreateRowFormFn,
  DataGridQuery,
  DataGridState,
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
import { DEFAULT_FILTER_DEBOUNCE_MS } from './utils/debounce';
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
import { sanitizeGridState } from './utils/state';

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
  /**
   * Debounce (ms) for typed filter / quick-filter / find inputs; `0` = per keystroke.
   * API / state writes are always immediate. default 200
   */
  filterDebounceMs?: number;
}

/** Scope of header select-all — see {@link CreateGridOptions.selectAll}. */
export type SelectAllScope = 'filtered' | 'page' | 'all';

/**
 * `T` is inferred from `rows`, typed `columns` (`ColumnDef<Person>[]`) or an
 * annotated `rowId`; plugins / other callbacks never drive inference (`NoInfer`),
 * so `rowId: (r) => r.id` and `plugins: [...defaultGridPlugins()]` are typed.
 * Inline column literals alone only infer `{ [field]: any }` — pass `rows` or `<T>`.
 */
export interface CreateGridOptions<T = unknown> {
  /** Initial column defs — replace at runtime with `grid.columns.set(next)`. */
  columns: readonly ColumnOrGroupDef<T>[];
  /**
   * Stable row identity (selection, edits, find, paste write-back, transactions).
   * `index` is always the row's index in the **source** `[data]` array (never a
   * filtered / sorted / paged position). Default: that source index — only safe
   * for static data; pass a field-based id (`(r) => r.id`) whenever rows change.
   * Required for {@link GridController.applyTransaction}.
   */
  rowId?: (row: T, index: number) => string | number;
  /**
   * Row-agnostic factories (`sideBarPlugin()`, `...defaultGridPlugins()`, held
   * `rowGroupPlugin()`) default to `DataGridPlugin<any>` — valid for every `T`;
   * row-typed ones (`treeDataPlugin`) are checked against `T` (inline ones need
   * an explicit `createGrid<T>` or `treeDataPlugin<T>` to type their callbacks).
   */
  plugins?: NoInfer<readonly DataGridPlugin<T>[]>;
  selection?: SelectionMode;
  /**
   * When false, the row cannot be selected via checkbox / Space / click-select.
   * Default: all rows selectable.
   */
  isRowSelectable?: IsRowSelectableFn<NoInfer<T>>;
  /**
   * When true, clicking a data row (outside the checkbox) toggles selection.
   * Default false — checkbox / Space own row selection (§5d).
   */
  rowClickSelects?: boolean;
  /**
   * Rows the header select-all checkbox (and Ctrl+A) adds / removes:
   * `'filtered'` (default) = every row passing filters, across pages;
   * `'page'` = data rows on the current page; `'all'` = every bound row.
   * Non-selectable rows are skipped; selection outside the scope is kept.
   */
  selectAll?: SelectAllScope;
  /** Schema wiring for full-row Signal Forms (component still binds `[rowForm]`). */
  editMode?: EditMode;
  rowEditSchema?: RowEditSchema<NoInfer<T>> | null;
  createRowForm?: CreateRowFormFn<NoInfer<T>> | null;
  /**
   * Edit start/stop policy (§5b). Prefer `'default' | 'excel'`; sparse overrides OK.
   */
  editInteraction?: EditInteractionInput;
  /**
   * Opt-in controller-owned rows (§5a). Same signal the host binds as `[data]`.
   * Enables {@link GridController.applyTransaction} / {@link GridController.setRows}.
   */
  rows?: WritableSignal<readonly T[]>;
  /**
   * When `rows` is set, apply paste / cellEdit / rowEdit onto that signal.
   * Default true if `rows` is provided. Hosts that intercept `(paste)` / `(cellEdit)`
   * can set `false` and write themselves.
   */
  autoApplyWrites?: boolean;
  /** Pagination / virtualization knobs (writable on the controller). */
  viewport?: GridViewportOptions;
  /** Toolbar / filters / stripe / reorder / context-menu chrome flags. */
  chrome?: GridChromeOptions;
  /** Allow Shift+click multi-column sort. Default true. */
  multiSort?: boolean;
  /** Skip client sort/filter; emit `queryChange` instead. Default false. */
  serverSide?: boolean;
  /**
   * Server total row count (with `serverSide` + pagination). When set, `[data]` is
   * the current page only: the grid pages by this count and emits `queryChange`
   * on page change. Writable later via {@link GridController.serverRowCount}.
   */
  serverRowCount?: number | null;
  /**
   * Grid state applied when the grid mounts, before its first render and before
   * the first `queryChange` (no flash of default state / extra server fetch).
   * Untrusted input is fine (e.g. `parseGridState(localStorage…)`): invalid
   * fields and unknown column ids are dropped. Plugin `slices` apply when the
   * plugin registers.
   */
  initialState?: Partial<DataGridState> | null;
}

/**
 * Host-facing controller produced by {@link createGrid}.
 * Prefer holding plugin instances yourself for adapter DX (`groups.setColumns`).
 */
export interface GridController<T = unknown> {
  /**
   * Writable column defs (AG `setGridOption('columnDefs')`): `grid.columns.set(next)`.
   * Order / pin / width / hidden state is kept for surviving column ids.
   */
  readonly columns: WritableSignal<readonly ColumnOrGroupDef<T>[]>;
  readonly rowId: (row: T, index: number) => string | number;
  /** Plugin list — prefer adapter toggles; use {@link setPlugins} only for rare full recomposition. */
  readonly plugins: Signal<readonly DataGridPlugin<T>[]>;
  /** Writable selection mode (`grid.selection.set('single')`). */
  readonly selection: WritableSignal<SelectionMode>;
  readonly isRowSelectable: WritableSignal<IsRowSelectableFn<T> | null>;
  readonly rowClickSelects: WritableSignal<boolean>;
  readonly selectAll: WritableSignal<SelectAllScope>;
  /** Writable — toggle cell vs full-row edit at runtime (`grid.editMode.set('fullRow')`). */
  readonly editMode: WritableSignal<EditMode>;
  /** Resolved edit policy — change with {@link setEditInteraction}. */
  readonly editInteraction: Signal<ResolvedEditInteraction>;
  /** Replace the edit start/stop policy (preset or sparse overrides, like `createGrid`). */
  setEditInteraction(input: EditInteractionInput): void;
  readonly rowEditSchema: RowEditSchema<T> | null;
  readonly createRowForm: CreateRowFormFn<T> | null;
  /**
   * Controller-owned rows when `createGrid({ rows })` was used; otherwise `null`.
   * Prefer binding `[data]="grid.rows()!"` (or the same host signal).
   */
  readonly rows: Signal<readonly T[]> | null;
  /**
   * True when paste / cell / row edits write `rows` automatically (§5a).
   * Always false when `rows` was omitted.
   */
  readonly autoApplyWrites: boolean;
  /** Populated when a DataGrid binds via `[controller]`. */
  readonly api: Signal<DataGridApi<T> | null>;
  /** Sanitized `createGrid({ initialState })` (applied on each mount); `null` when omitted. */
  readonly initialState: Partial<DataGridState> | null;
  /** Live grid state of the bound grid (`api.state`); `null` until bound. */
  readonly state: Signal<DataGridState | null>;
  /** Live sort / filter / page query of the bound grid (`api.query`); `null` until bound. */
  readonly query: Signal<DataGridQuery | null>;
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
    filterDebounceMs: WritableSignal<number>;
  };
  readonly multiSort: WritableSignal<boolean>;
  readonly serverSide: WritableSignal<boolean>;
  /**
   * Server total row count; `null` = unknown (client pages the returned rows).
   * Set after each fetch: `grid.serverRowCount.set(res.total)`.
   */
  readonly serverRowCount: WritableSignal<number | null>;
  /**
   * Adapter a plugin registered under `key` on the bound grid (`null` until
   * mounted). Reactive. Prefer holding the plugin instance; this is for discovery.
   * Keys come from the plugin package, e.g. `grid.getAdapter(ROW_GROUP_ADAPTER)`.
   */
  getAdapter<A>(key: AdapterKey<A>): A | null;
  /**
   * Replace the plugin list. The bound grid reconciles once, by instance
   * identity: removed plugins torn down, added ones set up, unchanged ones kept.
   */
  setPlugins(plugins: readonly DataGridPlugin<T>[]): void;
  /** @internal Bind plumbing — called by `<al-data-grid>` on mount / destroy. */
  bindApi(api: DataGridApi<T> | null): void;
  /**
   * Immutable batch update on controller-owned `rows`. Throws if `rows` or an
   * explicit `rowId` was not provided (index ids cannot match update/remove payloads).
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
  if (ownedRows && !options.rowId) {
    warnIndexRowIdOnce();
  }
  const editInteraction = signal(resolveEditInteraction(options.editInteraction));
  const initialState = options.initialState ? sanitizeGridState(options.initialState) : null;

  const viewport = {
    pagination: signal(options.viewport?.pagination ?? false),
    pageSize: signal(initialState?.pageSize ?? options.viewport?.pageSize ?? 25),
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
    filterDebounceMs: signal(options.chrome?.filterDebounceMs ?? DEFAULT_FILTER_DEBOUNCE_MS),
  };
  const multiSort = signal(options.multiSort ?? true);
  const serverSide = signal(options.serverSide ?? false);
  const serverRowCount = signal<number | null>(options.serverRowCount ?? null);

  const requireOwnedRows = (): WritableSignal<readonly T[]> => {
    if (!ownedRows) {
      throw new Error(
        'createGrid: applyTransaction/setRows require createGrid({ rows: WritableSignal }).',
      );
    }
    return ownedRows;
  };

  return {
    columns: signal(options.columns),
    rowId,
    plugins: plugins.asReadonly(),
    selection: signal(options.selection ?? 'none'),
    isRowSelectable: signal(options.isRowSelectable ?? null),
    rowClickSelects: signal(options.rowClickSelects ?? false),
    selectAll: signal(options.selectAll ?? 'filtered'),
    editMode: signal(options.editMode ?? 'cell'),
    editInteraction: editInteraction.asReadonly(),
    setEditInteraction(input) {
      editInteraction.set(resolveEditInteraction(input));
    },
    rowEditSchema: options.rowEditSchema ?? null,
    createRowForm: options.createRowForm ?? null,
    rows: ownedRows?.asReadonly() ?? null,
    autoApplyWrites: ownedRows != null && (options.autoApplyWrites ?? true),
    viewport,
    chrome,
    multiSort,
    serverSide,
    serverRowCount,
    getAdapter: (key) => api()?.getAdapter(key) ?? null,
    api: api.asReadonly(),
    initialState,
    state: computed(() => api()?.state() ?? null),
    query: computed(() => api()?.query() ?? null),
    setPlugins(next) {
      // The bound grid reconciles from this signal (single owner: the kernel).
      plugins.set([...next]);
    },
    bindApi(next) {
      api.set(next);
    },
    applyTransaction(tx) {
      const rowsSig = requireOwnedRows();
      if (!options.rowId) {
        throw new Error(
          'createGrid: applyTransaction requires an explicit rowId (e.g. rowId: (r) => r.id) — ' +
            'index-based ids cannot match update/remove payloads and shift on add/remove.',
        );
      }
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

let warnedIndexRowId = false;

/** Dev-only, once per app: controller-owned rows with index-based ids. */
function warnIndexRowIdOnce(): void {
  if (warnedIndexRowId || !isDevMode()) {
    return;
  }
  warnedIndexRowId = true;
  console.warn(
    '[data-grid] createGrid({ rows }) without rowId: rows are identified by their index in ' +
      '`rows`, so ids shift whenever rows are added / removed / reordered. Pass a stable ' +
      'rowId, e.g. rowId: (r) => r.id.',
  );
}
