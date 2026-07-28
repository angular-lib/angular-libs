/**
 * Row drag helpers — template owns handles; this owns index math + contracts.
 */

import type { RowReorderEvent } from '../components/data-grid/data-grid.types';
import { moveItem } from './cell-value';

export function parseDragIndex(
  stored: number | null,
  dataTransfer: DataTransfer | null | undefined,
): number {
  if (stored != null && Number.isFinite(stored)) {
    return stored;
  }
  const raw = dataTransfer?.getData('text/plain');
  if (raw == null || raw.trim() === '') {
    return Number.NaN;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isValidRowReorder(fromIndex: number, toIndex: number): boolean {
  return Number.isFinite(fromIndex) && Number.isFinite(toIndex) && fromIndex !== toIndex;
}

/**
 * Row drag is only safe on a flat client-side list with no active sort/filter.
 * Hosts should apply `event.rows` (or reorder by `fromId`/`toId`) to source data.
 */
export function isRowDragAllowed(options: {
  pluginEnabled: boolean;
  serverSide: boolean;
  hasActiveSort: boolean;
  hasActiveFilter: boolean;
  displayIsFlat: boolean;
}): boolean {
  return (
    options.pluginEnabled &&
    !options.serverSide &&
    !options.hasActiveSort &&
    !options.hasActiveFilter &&
    options.displayIsFlat
  );
}

export function buildRowReorderEvent<T>(
  processedRows: readonly T[],
  fromIndex: number,
  toIndex: number,
  rowId: (row: T, index: number) => string | number,
): RowReorderEvent<T> | null {
  if (!isValidRowReorder(fromIndex, toIndex)) {
    return null;
  }
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= processedRows.length ||
    toIndex >= processedRows.length
  ) {
    return null;
  }
  const fromRow = processedRows[fromIndex]!;
  const toRow = processedRows[toIndex]!;
  const fromId = rowId(fromRow, fromIndex);
  const toId = rowId(toRow, toIndex);
  const rows = moveItem(processedRows, fromIndex, toIndex);
  const rowIds = rows.map((row, index) => rowId(row, index));
  return { fromIndex, toIndex, fromId, toId, rowIds, rows };
}
