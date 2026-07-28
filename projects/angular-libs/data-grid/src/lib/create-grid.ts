/**
 * createGrid — held config + plugin adapters (schema/state wiring only).
 * The DataGrid component binds `[controller]`; host still owns row data.
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

export interface CreateGridOptions<T = unknown> {
  columns: readonly ColumnOrGroupDef<T>[];
  rowId?: (row: T, index: number) => string | number;
  plugins?: readonly DataGridPlugin<T>[];
  selection?: SelectionMode;
  /** Schema wiring for full-row Signal Forms (component still binds `[rowForm]`). */
  editMode?: EditMode;
  rowEditSchema?: RowEditSchema<T> | null;
  createRowForm?: CreateRowFormFn<T> | null;
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
  readonly editMode: EditMode;
  readonly rowEditSchema: RowEditSchema<T> | null;
  readonly createRowForm: CreateRowFormFn<T> | null;
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
 * const grid = createGrid({
 *   columns,
 *   rowId: (r) => r.id,
 *   selection: 'multi',
 *   plugins: [...defaultGridPlugins(), groups],
 * });
 * groups.setColumns(['role']);
 * // Toggle chrome without a second plugin list:
 * sideBar.setEnabled(false); // prefer over setPlugins for chrome toggles
 * ```
 *
 * ```html
 * <al-data-grid [controller]="grid" [data]="rows()" />
 * ```
 */
export function createGrid<T = unknown>(options: CreateGridOptions<T>): GridController<T> {
  const plugins: WritableSignal<readonly DataGridPlugin<T>[]> = signal(options.plugins ?? []);
  const api = signal<DataGridApi<T> | null>(null);
  const rowId = options.rowId ?? ((_row: T, index: number) => index);

  return {
    columns: options.columns,
    rowId,
    plugins: plugins.asReadonly(),
    selection: options.selection ?? 'none',
    editMode: options.editMode ?? 'cell',
    rowEditSchema: options.rowEditSchema ?? null,
    createRowForm: options.createRowForm ?? null,
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
