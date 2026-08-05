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
