/**
 * Client-side row pipeline: filter → quick filter → external → sort.
 * Grouping / tree mapping happens in `row-display.ts` after this stage.
 */

import type {
  ColumnDef,
  DataGridFilterState,
  SortState,
} from '../components/data-grid/data-grid.types';
import {
  applyExternalFilter,
  filterRows,
  quickFilterRows,
} from '../utils/filter-rows';
import { sortRows } from '../utils/sort-rows';

export interface ClientRowPipelineInput<T> {
  data: readonly T[];
  filters: DataGridFilterState;
  quickFilter: string;
  externalFilter: ((row: T) => boolean) | null;
  sorts: readonly SortState[];
  columnsById: Map<string, ColumnDef<T>>;
  visibleColumns: readonly ColumnDef<T>[];
  /** When true, skip client filter/sort (host/server owns ordering). */
  serverSide?: boolean;
}

/**
 * Optional post-sort hook plugins can register (e.g. custom ordering).
 * Keep this small — prefer display builders for structural transforms.
 */
export type AfterSortHook<T> = (rows: readonly T[]) => readonly T[];

export function runClientRowPipeline<T>(
  input: ClientRowPipelineInput<T>,
  afterSort?: AfterSortHook<T> | null,
): T[] {
  if (input.serverSide) {
    const rows = [...input.data];
    return afterSort ? [...afterSort(rows)] : rows;
  }

  let rows = filterRows(input.data, input.filters, input.columnsById);
  rows = quickFilterRows(rows, input.quickFilter, input.visibleColumns);
  rows = applyExternalFilter(rows, input.externalFilter);
  rows = sortRows(rows, input.sorts, input.columnsById);
  return afterSort ? [...afterSort(rows)] : rows;
}
