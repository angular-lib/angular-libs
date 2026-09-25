import { isDevMode, signal } from '@angular/core';
import {
  adapterKey,
  applyPasteMatrix,
  cellParseContextFromLocale,
  escapeClipboardCell,
  formatCellValue,
  getCellValue,
  isCellWritable,
  serializeCellValue,
  writeCellFromText,
  writeCellValue,
  type CellRange,
  type FillEvent,
  type PasteInvalidCell,
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
  stepDisplayIndexSkippingPlugins,
  type DataDisplayRow,
  type DisplayRow,
} from '@angular-libs/data-grid/plugin';

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

/** Discovery key for the per-grid range adapter — `api.getAdapter(CELL_RANGE_ADAPTER)`. */
export const CELL_RANGE_ADAPTER = adapterKey<CellRangeAdapter>('cellRange');

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
 * Overlay paint is binder-owned (from the registered range source); this plugin
 * owns range state, drag-select, fill, and cell decorator only.
 *
 * Range state is per grid. The held adapter methods drive the **first** grid the
 * instance is attached to (dev warning on a second); for other grids use
 * `api.getAdapter(CELL_RANGE_ADAPTER)`.
 */
export function cellRangePlugin<T = any>(
  options: CellRangePluginOptions = {},
): CellRangePlugin<T> {
  const dragSelect = options.dragSelect !== false;
  const fillHandleEnabled = options.fillHandle !== false;

  /** Per attached grid (range state is per grid). The held adapter drives the first one. */
  const grids = new Map<DataGridPluginContext<T>, CellRangeAdapter>();
  const primary = (): CellRangeAdapter | null => grids.values().next().value ?? null;

  const plugin: CellRangePlugin<T> = {
    id: 'cellRange',
    getRange: () => primary()?.getRange() ?? null,
    setRange: (next) => primary()?.setRange(next),
    clearRange: () => primary()?.clearRange(),
    getClipboardText: () => primary()?.getClipboardText() ?? null,
    extendRange: (dRow, dCol) => primary()?.extendRange(dRow, dCol) ?? false,
    fillHandleEnabled,

    setup(context: DataGridPluginContext<T>): () => void {
      if (grids.size > 0 && isDevMode()) {
        console.warn(
          '[data-grid] cellRangePlugin instance attached to a second grid — each grid keeps its own range, ' +
            'but the held adapter (getRange / clearRange / …) only drives the first. ' +
            'Use one cellRangePlugin() per grid, or api.getAdapter(CELL_RANGE_ADAPTER).',
        );
      }
      const range = signal<CellRange | null>(null);
      const liveContext = context;

      const getVisibleColumnIds = (): string[] =>
        liveContext?.api.getVisibleColumnIds() ?? [];

      const getDisplayRows = (): readonly DisplayRow<T>[] =>
        liveContext?.api.getPagedDisplayRows() ?? [];

      const displayIndexForRowId = (rowId: string | number): number => {
        const rows = getDisplayRows();
        return rows.findIndex((r) => isDataDisplayRow(r) && r.rowId === rowId);
      };

      /** `data-row-id` is a string — match by string form (ids like `"12"` / `"000123"` stay strings). */
      const displayIndexForRowAttr = (attr: string): number => {
        const rows = getDisplayRows();
        return rows.findIndex((r) => isDataDisplayRow(r) && String(r.rowId) === attr);
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
            cells.push(escapeClipboardCell(text));
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
          const displayRows = getDisplayRows();
          const skippedRow = stepDisplayIndexSkippingPlugins(
            displayRows,
            current.active.rowIndex,
            nextActive.rowIndex - current.active.rowIndex,
          );
          if (displayRows[skippedRow]?.kind === 'plugin') {
            return false;
          }
          nextActive.rowIndex = skippedRow;
          setRangeInternal({
            anchor: current.anchor,
            active: { rowIndex: nextActive.rowIndex, columnId: nextActive.columnId },
          });
          liveContext.api.focusCell(nextActive.rowIndex, nextActive.columnId);
          return true;
        },
      };

      grids.set(context, adapter);
      const cleanAdapter = context.adapters.register(CELL_RANGE_ADAPTER, adapter);
      const cleanRangeSource = context.capabilities.registerRangeSelection({
        id: 'cellRange',
        range: () => range(),
        clear: () => adapter.clearRange(),
        extend: (dRow, dCol) => adapter.extendRange(dRow, dCol),
        clipboardText: () => adapter.getClipboardText(),
        fillHandle: fillHandleEnabled,
      });

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

      const cleanups: Array<() => void> = [cleanAdapter, cleanRangeSource, cleanDecorator];

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
                const rowIndex = displayIndexForRowAttr(rowId);
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
                  const next = resolveFillTarget(fillSource, cell, getVisibleColumnIds());
                  if (next) {
                    setRangeInternal(next);
                  }
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
        range.set(null);
        grids.delete(context);
      };
    },
  };

  return plugin;
}

/**
 * Excel fill target: the source rectangle extended toward `pointer` along the
 * dominant axis only (rows win ties). Pointer inside the source → the source.
 */
export function resolveFillTarget(
  source: CellRange,
  pointer: { rowIndex: number; columnId: string },
  columnIds: readonly string[],
): CellRange | null {
  const norm = normalizeCellRange(source, columnIds);
  if (!norm) {
    return null;
  }
  let { rowStart, rowEnd, colStart, colEnd } = norm;
  const pc = columnIds.indexOf(pointer.columnId);
  const pr = pointer.rowIndex;
  const dRow = pr < rowStart ? pr - rowStart : pr > rowEnd ? pr - rowEnd : 0;
  const dCol = pc < 0 ? 0 : pc < colStart ? pc - colStart : pc > colEnd ? pc - colEnd : 0;
  if (dRow !== 0 && Math.abs(dRow) >= Math.abs(dCol)) {
    if (dRow < 0) {
      rowStart = pr;
    } else {
      rowEnd = pr;
    }
  } else if (dCol !== 0) {
    if (dCol < 0) {
      colStart = pc;
    } else {
      colEnd = pc;
    }
  }
  return {
    anchor: { rowIndex: rowStart, columnId: columnIds[colStart]! },
    active: { rowIndex: rowEnd, columnId: columnIds[colEnd]! },
  };
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

interface FillCell {
  value: unknown;
  sourceColumnId: string;
}

/**
 * Fill the part of `target` outside `source`, tiling source values with the
 * phase aligned to the source (dragging up from [A,B,C] puts C just above A).
 * Source cells are never written. Values are copied raw within a column;
 * across columns they go through the target column's parser.
 */
/** @internal Exported for specs. */
export function runFill<T>(
  context: DataGridPluginContext<T>,
  source: CellRange,
  target: CellRange | null,
): void {
  if (!target) {
    return;
  }
  const cols = context.api.getVisibleColumnIds();
  const s = normalizeCellRange(source, cols);
  const t = normalizeCellRange(target, cols);
  if (!s || !t) {
    return;
  }
  const vertical = t.rowStart !== s.rowStart || t.rowEnd !== s.rowEnd;
  const horizontal = t.colStart !== s.colStart || t.colEnd !== s.colEnd;
  if (vertical === horizontal) {
    return;
  }

  const displayRows = context.api.getPagedDisplayRows();
  const columnsById = context.api.getColumnsById();
  const dataRowsIn = (from: number, to: number): DataDisplayRow<T>[] => {
    const out: DataDisplayRow<T>[] = [];
    for (let ri = Math.max(0, from); ri <= to && ri < displayRows.length; ri++) {
      const item = displayRows[ri];
      if (item && isDataDisplayRow(item)) {
        out.push(item);
      }
    }
    return out;
  };

  const srcRows = dataRowsIn(s.rowStart, s.rowEnd);
  if (!srcRows.length) {
    return;
  }
  const srcValues = srcRows.map((item) =>
    s.columnIds.map((columnId) => {
      const col = columnsById.get(columnId);
      return col ? getCellValue(item.row, col, item.dataIndex) : undefined;
    }),
  );

  let fillRows: DataDisplayRow<T>[];
  let fillCols: string[];
  let cellAt: (k: number, c: number) => FillCell;
  if (vertical) {
    const below = t.rowEnd > s.rowEnd;
    fillRows = below ? dataRowsIn(s.rowEnd + 1, t.rowEnd) : dataRowsIn(t.rowStart, s.rowStart - 1);
    fillCols = s.columnIds;
    const n = srcRows.length;
    const m = fillRows.length;
    cellAt = (k, c) => ({
      value: srcValues[mod(below ? n + k : k - m, n)]![c],
      sourceColumnId: s.columnIds[c]!,
    });
  } else {
    const right = t.colEnd > s.colEnd;
    fillRows = srcRows;
    fillCols = right ? cols.slice(s.colEnd + 1, t.colEnd + 1) : cols.slice(t.colStart, s.colStart);
    const n = s.columnIds.length;
    const m = fillCols.length;
    cellAt = (k, c) => {
      const idx = mod(right ? n + c : c - m, n);
      return { value: srcValues[k]![idx], sourceColumnId: s.columnIds[idx]! };
    };
  }
  if (!fillRows.length || !fillCols.length) {
    return;
  }

  const cells: FillCell[][] = fillRows.map((_, k) => fillCols.map((_c, c) => cellAt(k, c)));
  const targetRowIds = fillRows.map((item) => item.rowId);
  // Serialized values are canonical (`1.5`, `yyyy-mm-dd`) — parse with a neutral locale.
  const parseCtx = {
    ...cellParseContextFromLocale(context.api.getLocale?.()),
    numberLocale: 'en-US',
    source: 'fill' as const,
  };
  const invalidCells: PasteInvalidCell[] = [];
  const processed = context.api.getProcessedRows() as T[];
  const { rows: suggestedRows, rowIds } = applyPasteMatrix(
    processed,
    cells,
    targetRowIds,
    fillCols,
    {
      rowId: (row, index) => context.api.resolveRowId(row, index),
      write: (row, columnId, cell, rowIndex, rowId) => {
        const col = columnsById.get(columnId);
        if (!col || !isCellWritable(col)) {
          return row;
        }
        if (cell.sourceColumnId === columnId) {
          const previous = getCellValue(row, col, rowIndex);
          return Object.is(previous, cell.value)
            ? row
            : writeCellValue(row, col, columnId, previous, cell.value);
        }
        const text = serializeCellValue(cell.value);
        const out = writeCellFromText(row, col, columnId, text, rowIndex, parseCtx);
        if (out && 'error' in out) {
          invalidCells.push({ rowId, columnId, text, error: out.error });
          return row;
        }
        return out?.row ?? row;
      },
    },
  );

  const payload: FillEvent<T> = {
    startRowIndex: fillRows[0]!.dataIndex,
    columnIds: fillCols,
    matrix: cells.map((row) => row.map((cell) => serializeCellValue(cell.value))),
    targetRowIds,
    suggestedRows,
    rowIds,
    invalidCells,
    range: target,
    source,
  };
  context.api.emitPaste(payload);
}
