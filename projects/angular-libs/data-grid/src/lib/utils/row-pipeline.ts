/**
 * Client-side row pipeline: filter → quick filter → external → sort.
 * Grouping / tree mapping happens in `row-display.ts` after this stage.
 *
 * The live session runs the same stage functions as separate memoized
 * computeds (so e.g. a column reorder or group collapse does not re-filter or
 * re-sort); this composed helper is for tests / tooling. No-op stages return
 * their input unchanged (no copies) — treat results as read-only.
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
  /** BCP-47 locale for string sort collation (default: runtime locale). */
  collatorLocale?: string;
}

/**
 * Optional post-sort hook plugins can register (e.g. custom ordering).
 * Keep this small — prefer display builders for structural transforms.
 */
export type AfterSortHook<T> = (rows: readonly T[]) => readonly T[];

export function runClientRowPipeline<T>(
  input: ClientRowPipelineInput<T>,
  afterSort?: AfterSortHook<T> | null,
): readonly T[] {
  if (input.serverSide) {
    return afterSort ? afterSort(input.data) : input.data;
  }

  let rows: readonly T[] = filterRows(input.data, input.filters, input.columnsById);
  rows = quickFilterRows(rows, input.quickFilter, input.visibleColumns);
  rows = applyExternalFilter(rows, input.externalFilter);
  rows = sortRows(rows, input.sorts, input.columnsById, { locale: input.collatorLocale });
  return afterSort ? afterSort(rows) : rows;
}
