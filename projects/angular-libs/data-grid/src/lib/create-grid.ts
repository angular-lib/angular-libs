/**
 * createGrid — held config + plugin adapters (schema/state wiring only).
 * The DataGrid component binds `[controller]`; host still owns row data by default.
 * Opt-in `rows` WritableSignal enables controller-owned transactions (§5a).
 * Feature flags belong on plugins, never here.
 */

import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { DataGridApi, BoundRowGroupAdapter, BoundTreeDataAdapter } from './api/grid-api';
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
  readonly editMode: EditMode;
  readonly editInteraction: ResolvedEditInteraction;
  readonly rowEditSchema: RowEditSchema<T> | null;
  readonly createRowForm: CreateRowFormFn<T> | null;
  /**
   * Controller-owned rows when `createGrid({ rows })` was used; otherwise `null`.
   * Prefer binding `[data]="grid.rows()!"` (or the same host signal).
   */
  readonly rows: Signal<readonly T[]> | null;
  /** Duck-typed when `rowGroupPlugin` is in `plugins` — prefer {@link pickAdapter}. */
  readonly rowGroup: BoundRowGroupAdapter | null;
  /** Duck-typed when `treeDataPlugin` is in `plugins`. */
  readonly treeData: BoundTreeDataAdapter | null;
  /** Populated when a DataGrid binds via `[controller]`. */
  readonly api: Signal<DataGridApi<T> | null>;
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
 *   plugins: [...defaultGridPlugins(), groups],
 * });
 * groups.setColumns(['role']);
 * grid.applyTransaction({ add: [{ id: 'x', name: 'New' }] });
 * ```
 *
 * ```html
 * <al-data-grid [controller]="grid" [data]="grid.rows()!" />
 * ```
 */
export function createGrid<T = unknown>(options: CreateGridOptions<T>): GridController<T> {
  const plugins: WritableSignal<readonly DataGridPlugin<T>[]> = signal(options.plugins ?? []);
  const api = signal<DataGridApi<T> | null>(null);
  const rowId = options.rowId ?? ((_row: T, index: number) => index);
  const ownedRows = options.rows ?? null;
  const editInteraction = resolveEditInteraction(options.editInteraction);

  const requireOwnedRows = (): WritableSignal<readonly T[]> => {
    if (!ownedRows) {
      throw new Error(
        'createGrid: applyTransaction/setRows require createGrid({ rows: WritableSignal }).',
      );
    }
    return ownedRows;
  };

  return {
    columns: options.columns,
    rowId,
    plugins: plugins.asReadonly(),
    selection: options.selection ?? 'none',
    isRowSelectable: options.isRowSelectable ?? null,
    rowClickSelects: options.rowClickSelects ?? false,
    editMode: options.editMode ?? 'cell',
    editInteraction,
    rowEditSchema: options.rowEditSchema ?? null,
    createRowForm: options.createRowForm ?? null,
    rows: ownedRows?.asReadonly() ?? null,
    get rowGroup() {
      return pickAdapter(plugins(), 'rowGroup', isBoundRowGroupAdapter);
    },
    get treeData() {
      return pickAdapter(plugins(), 'treeData', isBoundTreeDataAdapter);
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

function isBoundRowGroupAdapter(value: unknown): value is BoundRowGroupAdapter {
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

function isBoundTreeDataAdapter(value: unknown): value is BoundTreeDataAdapter {
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
