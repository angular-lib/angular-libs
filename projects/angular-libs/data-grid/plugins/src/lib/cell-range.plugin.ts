import { signal } from '@angular/core';
import {
  applyPasteMatrix,
  cellInNormalizedRange,
  coerceCellEditValue,
  formatCellValue,
  getCellValue,
  isDataDisplayRow,
  moveFocusWithinGrid,
  normalizeCellRange,
  singleCellRange,
  writeCellValue,
  type CellRange,
  type DataGridPlugin,
  type DataGridPluginContext,
  type DisplayRow,
  type FocusCell,
  type PasteEvent,
} from '@angular-libs/data-grid';
import { ensureCellRangeStyles } from './cell-range-styles';

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
 */
export function cellRangePlugin<T = unknown>(
  options: CellRangePluginOptions = {},
): CellRangePlugin<T> {
  const dragSelect = options.dragSelect !== false;
  const fillHandleEnabled = options.fillHandle !== false;

  const range = signal<CellRange | null>(null);
  let liveContext: DataGridPluginContext<T> | null = null;
  let fillHandleEl: HTMLDivElement | null = null;
  let rangeRingEl: HTMLDivElement | null = null;

  const getVisibleColumnIds = (): string[] =>
    liveContext?.api.getVisibleColumnIds() ?? [];

  const getDisplayRows = (): readonly DisplayRow<T>[] =>
    liveContext?.api.getPagedDisplayRows() ?? [];

  const displayIndexForRowId = (rowId: string | number): number => {
    const rows = getDisplayRows();
    return rows.findIndex((r) => isDataDisplayRow(r) && r.rowId === rowId);
  };

  const findCellTd = (rowIndex: number, columnId: string): HTMLElement | null => {
    if (!liveContext) {
      return null;
    }
    const item = getDisplayRows()[rowIndex];
    if (!item || !isDataDisplayRow(item)) {
      return null;
    }
    return liveContext.element.querySelector(
      `div[data-row-id="${cssEscape(String(item.rowId))}"][data-column-id="${cssEscape(columnId)}"]`,
    ) as HTMLElement | null;
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

  const ensureOverlayEls = (): void => {
    if (!rangeRingEl) {
      rangeRingEl = document.createElement('div');
      rangeRingEl.className = 'al-dg-range-ring';
      rangeRingEl.setAttribute('data-testid', 'al-dg-range-ring');
    }
    if (fillHandleEnabled && !fillHandleEl) {
      fillHandleEl = document.createElement('div');
      fillHandleEl.className = 'al-dg-fill-handle';
      fillHandleEl.setAttribute('data-testid', 'al-dg-fill-handle');
    }
  };

  const removeOverlays = (): void => {
    rangeRingEl?.remove();
    fillHandleEl?.remove();
  };

  /**
   * Fixed ring + fill handle, clipped to the scroll viewport so the scrollbar
   * gutter never slices the border (and overlays never inflate scrollWidth).
   */
  const syncOverlays = (): void => {
    if (!liveContext) {
      removeOverlays();
      return;
    }
    const current = range();
    if (!current) {
      removeOverlays();
      return;
    }
    const cols = getVisibleColumnIds();
    const norm = normalizeCellRange(current, cols);
    if (!norm) {
      removeOverlays();
      return;
    }

    const tl = findCellTd(norm.rowStart, norm.columnIds[0]!);
    const br = findCellTd(norm.rowEnd, norm.columnIds[norm.columnIds.length - 1]!);
    if (!tl || !br) {
      removeOverlays();
      return;
    }

    const scroll = liveContext.element.querySelector(
      '.al-data-grid__scroll',
    ) as HTMLElement | null;
    const clip = scroll?.getBoundingClientRect();
    const a = tl.getBoundingClientRect();
    const b = br.getBoundingClientRect();
    let left = Math.min(a.left, b.left);
    let top = Math.min(a.top, b.top);
    let right = Math.max(a.right, b.right);
    let bottom = Math.max(a.bottom, b.bottom);

    if (clip) {
      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }

    const width = right - left;
    const height = bottom - top;
    if (width < 2 || height < 2) {
      removeOverlays();
      return;
    }

    ensureOverlayEls();
    document.body.appendChild(rangeRingEl!);
    rangeRingEl!.style.left = `${left}px`;
    rangeRingEl!.style.top = `${top}px`;
    rangeRingEl!.style.width = `${width}px`;
    rangeRingEl!.style.height = `${height}px`;

    if (fillHandleEnabled && fillHandleEl) {
      const handleLeft = right - 8;
      const handleTop = bottom - 8;
      const outsideClip =
        !!clip &&
        (handleLeft + 7 > clip.right ||
          handleTop + 7 > clip.bottom ||
          handleLeft < clip.left ||
          handleTop < clip.top);
      if (outsideClip) {
        fillHandleEl.remove();
      } else {
        document.body.appendChild(fillHandleEl);
        fillHandleEl.style.left = `${handleLeft}px`;
        fillHandleEl.style.top = `${handleTop}px`;
      }
    }
  };

  const setRangeInternal = (next: CellRange | null): void => {
    range.set(next);
    queueMicrotask(() => syncOverlays());
  };

  const adapter: CellRangeAdapter = {
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

    setup(context: DataGridPluginContext<T>): () => void {
      ensureCellRangeStyles();
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

              const cellFromEvent = (event: Event): FocusCell | null => {
                const td = (event.target as HTMLElement | null)?.closest?.(
                  '[data-row-id][data-column-id]',
                ) as HTMLElement | null;
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

              const onPointerDown = (event: PointerEvent): void => {
                const target = event.target as HTMLElement | null;
                if (fillHandleEnabled && target?.closest?.('.al-dg-fill-handle')) {
                  const current = range();
                  if (!current) {
                    return;
                  }
                  filling = true;
                  fillSource = current;
                  dragging = false;
                  pointerId = event.pointerId;
                  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                if (!dragSelect) {
                  return;
                }
                if (
                  target?.closest?.(
                    'input, select, textarea, button, .al-data-grid__td--select, .al-data-grid__td--drag',
                  )
                ) {
                  return;
                }
                const cell = cellFromEvent(event);
                if (!cell) {
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
                syncOverlays();
              };

              element.addEventListener('pointerdown', onPointerDown);
              element.addEventListener('pointermove', onPointerMove);
              element.addEventListener('pointerup', onPointerUp);
              element.addEventListener('pointercancel', onPointerUp);

              const scrollEl = element.querySelector('.al-data-grid__scroll');
              const onScrollOrResize = (): void => syncOverlays();
              scrollEl?.addEventListener('scroll', onScrollOrResize, { passive: true });
              window.addEventListener('resize', onScrollOrResize, { passive: true });

              return () => {
                element.removeEventListener('pointerdown', onPointerDown);
                element.removeEventListener('pointermove', onPointerMove);
                element.removeEventListener('pointerup', onPointerUp);
                element.removeEventListener('pointercancel', onPointerUp);
                scrollEl?.removeEventListener('scroll', onScrollOrResize);
                window.removeEventListener('resize', onScrollOrResize);
                removeOverlays();
              };
            },
          }),
        );
      }

      return () => {
        for (const cleanup of [...cleanups].reverse()) {
          cleanup();
        }
        removeOverlays();
        fillHandleEl = null;
        rangeRingEl = null;
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
      row.push(String(formatCellValue(value, item.row, col, item.dataIndex) ?? ''));
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

  const tiled: string[][] = [];
  for (let i = 0; i < targetDataRows.length; i++) {
    const srcRow = matrix[i % matrix.length]!;
    const outRow: string[] = [];
    for (let c = 0; c < targetNorm.columnIds.length; c++) {
      outRow.push(srcRow[c % srcRow.length] ?? '');
    }
    tiled.push(outRow);
  }

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

  const payload: PasteEvent<T> = {
    startRowIndex,
    columnIds: targetNorm.columnIds,
    matrix: tiled,
    suggestedRows,
  };
  context.api.emitPaste(payload);
}

function escapeTsv(value: string): string {
  if (/[\t\n\r"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}
