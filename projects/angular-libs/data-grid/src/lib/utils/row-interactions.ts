/**
 * Row drag helpers — template owns handles; this owns index math + pointer session.
 */

import type { RowReorderEvent } from '../components/data-grid/data-grid.types';
import { moveItem } from './cell-value';
import type { DisplayRow } from './row-display';

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

/**
 * Build the `(rowReorder)` payload. `fromIndex` / `toIndex` index `processedRows`
 * (the dragged list); `rows` / `rowIds` are the **full source** order with the
 * dragged row moved next to the drop target — safe to assign back to `[data]`
 * even when rows are hidden. Ids use source indices (`rowId(row, sourceIndex)`).
 */
export function buildRowReorderEvent<T>(
  processedRows: readonly T[],
  fromIndex: number,
  toIndex: number,
  rowId: (row: T, index: number) => string | number,
  sourceRows: readonly T[] = processedRows,
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
  const sourceFrom = sourceIndexOf(processedRows[fromIndex]!, fromIndex, sourceRows, rowId);
  const sourceTo = sourceIndexOf(processedRows[toIndex]!, toIndex, sourceRows, rowId);
  if (sourceFrom < 0 || sourceTo < 0 || sourceFrom === sourceTo) {
    return null;
  }
  const fromId = rowId(sourceRows[sourceFrom]!, sourceFrom);
  const toId = rowId(sourceRows[sourceTo]!, sourceTo);
  const rows = moveItem(sourceRows, sourceFrom, sourceTo);
  const rowIds = rows.map((row, index) => rowId(row, index));
  return { fromIndex, toIndex, fromId, toId, rowIds, rows };
}

/** Source index of a processed row: by reference, else by row id. */
function sourceIndexOf<T>(
  row: T,
  processedIndex: number,
  sourceRows: readonly T[],
  rowId: (row: T, index: number) => string | number,
): number {
  const byRef = sourceRows.indexOf(row);
  if (byRef >= 0) {
    return byRef;
  }
  const id = rowId(row, processedIndex);
  return sourceRows.findIndex((candidate, index) => rowId(candidate, index) === id);
}

/**
 * Map a pointer Y to a data-row index using scroll geometry (no DOM hit-testing).
 * `contentOffsetY` is the sticky header block height before body rows in the scrollport.
 * Returns `null` when the display row under the pointer is not a data row.
 */
export function resolveRowDropDataIndex(options: {
  clientY: number;
  scrollTop: number;
  scrollRectTop: number;
  rowHeight: number;
  contentOffsetY?: number;
  displayRows: readonly DisplayRow<unknown>[];
}): number | null {
  const { clientY, scrollTop, scrollRectTop, rowHeight, displayRows } = options;
  if (rowHeight <= 0 || displayRows.length === 0) {
    return null;
  }
  const header = options.contentOffsetY ?? 0;
  const y = clientY - scrollRectTop + scrollTop - header;
  if (y < 0) {
    return null;
  }
  const displayIndex = Math.min(displayRows.length - 1, Math.floor(y / rowHeight));
  const item = displayRows[displayIndex];
  return item?.kind === 'data' ? item.dataIndex : null;
}

/**
 * Attach window pointer listeners for a row-reorder drag. Returns cleanup.
 */
export function attachRowReorder(options: {
  pointerId: number;
  fromIndex: number;
  getDropIndex: (clientY: number) => number | null;
  onOver: (index: number | null) => void;
  onDrop: (fromIndex: number, toIndex: number) => void;
  onEnd?: () => void;
}): () => void {
  let lastOver: number | null = null;
  let ended = false;

  const onMove = (ev: PointerEvent): void => {
    if (ev.pointerId !== options.pointerId) {
      return;
    }
    lastOver = options.getDropIndex(ev.clientY);
    options.onOver(lastOver);
  };

  const finish = (dropped: boolean, clientY?: number): void => {
    if (ended) {
      return;
    }
    ended = true;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    const to =
      dropped && clientY != null
        ? (options.getDropIndex(clientY) ?? lastOver)
        : null;
    options.onEnd?.();
    if (to != null) {
      options.onDrop(options.fromIndex, to);
    }
  };

  const onUp = (ev: PointerEvent): void => {
    if (ev.pointerId !== options.pointerId) {
      return;
    }
    finish(true, ev.clientY);
  };

  const onCancel = (ev: PointerEvent): void => {
    if (ev.pointerId !== options.pointerId) {
      return;
    }
    finish(false);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  return () => finish(false);
}
