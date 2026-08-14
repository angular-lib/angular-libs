import { signal } from '@angular/core';
import {
  applyPasteMatrix,
  coerceCellEditValue,
  formatCellValue,
  getCellValue,
  serializeCellValue,
  tileMatrix,
  writeCellValue,
  type CellRange,
  type FillEvent,
} from '@angular-libs/data-grid';
import {
  cellInNormalizedRange,
  moveFocusWithinGrid,
  normalizeCellRange,
  singleCellRange,
  type DataGridPlugin,
  type DataGridPluginContext,
  type FocusCell,
} from '@angular-libs/data-grid/plugin';
import {
  isDataDisplayRow,
  type DisplayRow,
} from '@angular-libs/data-grid/internals';

/** Held adapter — single contiguous cell range (OVERVIEW §5). */
export interface CellRangeAdapter {
  getRange(): CellRange | null;
  setRange(range: CellRange | null): void;
  clearRange(): void;
  /** TSV for the active range, or `null` when empty. */
  getClipboardText(): string | null;
  /**
   * Shift+arrow extend. Returns `true` when handled.
   * Moves focus to the new `active` corner.
   */
  extendRange(dRow: number, dCol: number): boolean;
  /** False when constructed with `fillHandle: false`. */
  readonly fillHandleEnabled: boolean;
}

export type CellRangePlugin<T = unknown> = DataGridPlugin<T> & CellRangeAdapter;

export interface CellRangePluginOptions {
  /** Enable pointer drag-select (default true). */
  dragSelect?: boolean;
  /** Enable fill-handle copy-fill (default true). */
  fillHandle?: boolean;
}

/**
 * Opt-in single-rectangle cell range selection.
 *
 * Hold the return value for `getRange` / `clearRange`. Wire Shift+arrows via
 * the grid's focus continuum (bound automatically on setup).
 *
 * Not included in `defaultGridPlugins()` — add explicitly.
 *
 * Overlay paint is binder-owned (from `api.getCellRange()`); this plugin owns
 * range state, drag-select, fill, and cell decorator only.
 */
export function cellRangePlugin<T = unknown>(
  options: CellRangePluginOptions = {},
): CellRangePlugin<T> {
  const dragSelect = options.dragSelect !== false;
  const fillHandleEnabled = options.fillHandle !== false;

  const range = signal<CellRange | null>(null);
  let liveContext: DataGridPluginContext<T> | null = null;

  const getVisibleColumnIds = (): string[] =>
    liveContext?.api.getVisibleColumnIds() ?? [];

  const getDisplayRows = (): readonly DisplayRow<T>[] =>
    liveContext?.api.getPagedDisplayRows() ?? [];

  const displayIndexForRowId = (rowId: string | number): number => {
    const rows = getDisplayRows();
    return rows.findIndex((r) => isDataDisplayRow(r) && r.rowId === rowId);
  };

  const buildClipboardText = (current: CellRange): string | null => {
    const cols = getVisibleColumnIds();
    const norm = normalizeCellRange(current, cols);
    if (!norm) {
      return null;
    }
    const displayRows = getDisplayRows();
    const columnsById = liveContext?.api.getColumnsById() ?? new Map();
    const lines: string[] = [];
    for (let ri = norm.rowStart; ri <= norm.rowEnd; ri++) {
      const item = displayRows[ri];
      if (!item || !isDataDisplayRow(item)) {
        continue;
      }
      const cells: string[] = [];
      for (const columnId of norm.columnIds) {
        const col = columnsById.get(columnId);
        if (!col) {
          cells.push('');
          continue;
        }
        const value = getCellValue(item.row, col, item.dataIndex);
        const text = formatCellValue(value, item.row, col, item.dataIndex);
        cells.push(escapeTsv(text));
      }
      lines.push(cells.join('\t'));
    }
    return lines.length ? lines.join('\n') : null;
  };

  const invalidatePaint = (): void => {
    liveContext?.capabilities.invalidateOverlays();
  };

  const setRangeInternal = (next: CellRange | null): void => {
    range.set(next);
    queueMicrotask(() => invalidatePaint());
  };

  const adapter: CellRangeAdapter = {
    fillHandleEnabled,
    getRange: () => range(),
    setRange: (next) => setRangeInternal(next),
    clearRange: () => setRangeInternal(null),
    getClipboardText: () => {
      const current = range();
      return current ? buildClipboardText(current) : null;
    },
    extendRange: (dRow, dCol) => {
      if (!liveContext) {
        return false;
      }
      const focus = liveContext.api.getFocusedCell();
      if (!focus || (focus.realm ?? 'body') !== 'body') {
        return false;
      }
      const cols = getVisibleColumnIds();
      const rowCount = getDisplayRows().length;
      let current = range();
      if (!current) {
        current = singleCellRange(focus);
      }
      const nextActive = moveFocusWithinGrid(
        { ...current.active, realm: 'body' },
        dRow,
        dCol,
        cols,
        rowCount,
      );
      if (!nextActive) {
        return false;
      }
      setRangeInternal({
        anchor: current.anchor,
        active: { rowIndex: nextActive.rowIndex, columnId: nextActive.columnId },
      });
      liveContext.api.focusCell(nextActive.rowIndex, nextActive.columnId);
      return true;
    },
  };

  const plugin: CellRangePlugin<T> = {
    id: 'cellRange',
    getRange: () => adapter.getRange(),
    setRange: (next) => adapter.setRange(next),
    clearRange: () => adapter.clearRange(),
    getClipboardText: () => adapter.getClipboardText(),
    extendRange: (dRow, dCol) => adapter.extendRange(dRow, dCol),
    fillHandleEnabled,

    setup(context: DataGridPluginContext<T>): () => void {
      liveContext = context;
      context.api.bindCellRangeAdapter(adapter);

      const cleanDecorator = context.capabilities.registerCellDecorator({
        id: 'cell-range',
        className: ({ rowId, columnId }) => {
          const current = range();
          if (!current) {
            return null;
          }
          range();
          const rowIndex = displayIndexForRowId(rowId);
          if (rowIndex < 0) {
            return null;
          }
          const cols = getVisibleColumnIds();
          const norm = normalizeCellRange(current, cols);
          if (!norm || !cellInNormalizedRange(rowIndex, columnId, norm)) {
            return null;
          }
          return 'al-dg-cell--range';
        },
      });

      const cleanups: Array<() => void> = [cleanDecorator];

      if (dragSelect || fillHandleEnabled) {
        cleanups.push(
          context.capabilities.registerInteraction({
            id: 'cell-range-pointer',
            setup: (element) => {
              let dragging = false;
              let filling = false;
              let fillSource: CellRange | null = null;
              let pointerId: number | null = null;

              const cellFromTd = (td: HTMLElement | null): FocusCell | null => {
                if (!td || !element.contains(td)) {
                  return null;
                }
                const rowId = td.getAttribute('data-row-id');
                const columnId = td.getAttribute('data-column-id');
                if (rowId == null || !columnId) {
                  return null;
                }
                const parsed = Number(rowId);
                const id: string | number =
                  rowId !== '' && !Number.isNaN(parsed) && String(parsed) === rowId
                    ? parsed
                    : rowId;
                const rowIndex = displayIndexForRowId(id);
                if (rowIndex < 0) {
                  return null;
                }
                return { rowIndex, columnId, realm: 'body' };
              };

              /** Coordinate hit-test — needed under pointer capture. */
              const cellFromEvent = (event: PointerEvent): FocusCell | null => {
                const handles = element.querySelectorAll('.al-dg-fill-handle');
                handles.forEach((h) => {
                  (h as HTMLElement).style.pointerEvents = 'none';
                });
                const hit = document.elementFromPoint(
                  event.clientX,
                  event.clientY,
                ) as HTMLElement | null;
                handles.forEach((h) => {
                  (h as HTMLElement).style.pointerEvents = '';
                });
                return (
                  cellFromTd(
                    hit?.closest?.('[data-row-id][data-column-id]') as HTMLElement | null,
                  ) ??
                  cellFromTd(
                    (event.target as HTMLElement | null)?.closest?.(
                      '[data-row-id][data-column-id]',
                    ) as HTMLElement | null,
                  )
                );
              };

              const onPointerDown = (event: PointerEvent): void => {
                // Primary button only — right/middle click must reach the cell
                // contextmenu handler (setPointerCapture suppresses it in Chromium).
                if (event.button !== 0) {
                  return;
                }
                const target = event.target as HTMLElement | null;
                // Event delegation on range-layer / grid for binder-painted fill handle.
                if (fillHandleEnabled && target?.closest?.('.al-dg-fill-handle')) {
                  const current = range();
                  if (!current) {
                    return;
                  }
                  filling = true;
                  fillSource = current;
                  dragging = false;
                  pointerId = event.pointerId;
                  event.preventDefault();
                  event.stopPropagation();
                  element.setPointerCapture(event.pointerId);
                  return;
                }
                if (!dragSelect) {
                  return;
                }
                // Whitelist: only start a range from a body data-cell click.
                // Do not use elementFromPoint here — filter/header popups can sit
                // over body cells and would otherwise steal the hit-test.
                const cell = cellFromTd(
                  target?.closest?.(
                    '.al-data-grid__td[data-row-id][data-column-id]',
                  ) as HTMLElement | null,
                );
                if (!cell) {
                  return;
                }
                if (target?.closest?.('input, select, textarea, button, a, .al-data-grid__editor-host')) {
                  return;
                }
                dragging = true;
                filling = false;
                fillSource = null;
                pointerId = event.pointerId;
                setRangeInternal(singleCellRange(cell));
                context.api.focusCell(cell.rowIndex, cell.columnId);
                element.setPointerCapture(event.pointerId);
              };

              const onPointerMove = (event: PointerEvent): void => {
                if (pointerId != null && event.pointerId !== pointerId) {
                  return;
                }
                if (!dragging && !filling) {
                  return;
                }
                const cell = cellFromEvent(event);
                if (!cell) {
                  return;
                }
                if (filling && fillSource) {
                  setRangeInternal({
                    anchor: fillSource.anchor,
                    active: cell,
                  });
                  return;
                }
                if (dragging) {
                  const current = range();
                  if (!current) {
                    return;
                  }
                  setRangeInternal({
                    anchor: current.anchor,
                    active: cell,
                  });
                }
              };

              const onPointerUp = (event: PointerEvent): void => {
                if (pointerId != null && event.pointerId !== pointerId) {
                  return;
                }
                if (filling && fillSource) {
                  runFill(context, fillSource, range());
                }
                dragging = false;
                filling = false;
                fillSource = null;
                pointerId = null;
                try {
                  element.releasePointerCapture(event.pointerId);
                } catch {
                  /* already released */
                }
                invalidatePaint();
              };

              element.addEventListener('pointerdown', onPointerDown);
              element.addEventListener('pointermove', onPointerMove);
              element.addEventListener('pointerup', onPointerUp);
              element.addEventListener('pointercancel', onPointerUp);

              const scrollEl = context.api.getScrollRoot();
              const onScrollOrResize = (): void => invalidatePaint();
              scrollEl?.addEventListener('scroll', onScrollOrResize, { passive: true });
              window.addEventListener('resize', onScrollOrResize, { passive: true });

              return () => {
                element.removeEventListener('pointerdown', onPointerDown);
                element.removeEventListener('pointermove', onPointerMove);
                element.removeEventListener('pointerup', onPointerUp);
                element.removeEventListener('pointercancel', onPointerUp);
                scrollEl?.removeEventListener('scroll', onScrollOrResize);
                window.removeEventListener('resize', onScrollOrResize);
              };
            },
          }),
        );
      }

      return () => {
        for (const cleanup of [...cleanups].reverse()) {
          cleanup();
        }
        context.api.bindCellRangeAdapter(null);
        range.set(null);
        liveContext = null;
      };
    },
  };

  return plugin;
}

function runFill<T>(
  context: DataGridPluginContext<T>,
  source: CellRange,
  target: CellRange | null,
): void {
  if (!target) {
    return;
  }
  const cols = context.api.getVisibleColumnIds();
  const sourceNorm = normalizeCellRange(source, cols);
  const targetNorm = normalizeCellRange(target, cols);
  if (!sourceNorm || !targetNorm) {
    return;
  }

  const displayRows = context.api.getPagedDisplayRows();
  const columnsById = context.api.getColumnsById();
  const matrix: string[][] = [];
  for (let ri = sourceNorm.rowStart; ri <= sourceNorm.rowEnd; ri++) {
    const item = displayRows[ri];
    if (!item || !isDataDisplayRow(item)) {
      continue;
    }
    const row: string[] = [];
    for (const columnId of sourceNorm.columnIds) {
      const col = columnsById.get(columnId);
      if (!col) {
        row.push('');
        continue;
      }
      const value = getCellValue(item.row, col, item.dataIndex);
      row.push(serializeCellValue(value));
    }
    matrix.push(row);
  }
  if (!matrix.length) {
    return;
  }

  const targetDataRows: { dataIndex: number }[] = [];
  for (let ri = targetNorm.rowStart; ri <= targetNorm.rowEnd; ri++) {
    const item = displayRows[ri];
    if (item && isDataDisplayRow(item)) {
      targetDataRows.push({ dataIndex: item.dataIndex });
    }
  }
  if (!targetDataRows.length) {
    return;
  }

  const tiled = tileMatrix(matrix, targetDataRows.length, targetNorm.columnIds.length);

  const startRowIndex = targetDataRows[0]!.dataIndex;
  const processed = context.api.getProcessedRows() as T[];
  const { rows: suggestedRows } = applyPasteMatrix(
    processed,
    tiled,
    startRowIndex,
    targetNorm.columnIds,
    {
      rowId: (row, index) => context.api.resolveRowId(row, index),
      write: (row, columnId, value, rowIndex) => {
        const col = columnsById.get(columnId);
        if (!col) {
          return row;
        }
        const previous = getCellValue(row, col, rowIndex);
        const nextValue = coerceCellEditValue(col, value, previous);
        return writeCellValue(row, col, columnId, previous, nextValue);
      },
    },
  );

  const payload: FillEvent<T> = {
    startRowIndex,
    columnIds: targetNorm.columnIds,
    matrix: tiled,
    suggestedRows,
    range: target,
    source,
  };
  context.api.emitPaste(payload);
}

function escapeTsv(value: string): string {
  if (/[\t\n\r"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
