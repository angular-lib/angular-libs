import {
  applyPasteMatrix,
  cellParseContextFromLocale,
  collectPasteTargetRows,
  parseClipboardMatrix,
  tileMatrix,
  writeCellFromText,
  type PasteEvent,
  type PasteInvalidCell,
} from '@angular-libs/data-grid';
import type {
  DataGridPlugin,
  DataGridPluginContext,
} from '@angular-libs/data-grid/plugin';

export interface ClipboardPluginOptions {
  paste?: boolean;
  copy?: boolean;
}

/**
 * Owns clipboard listeners and paste matrix logic (capability interaction).
 */
export function clipboardPlugin<T = unknown>(
  options: ClipboardPluginOptions = {},
): DataGridPlugin<T> {
  const paste = options.paste !== false;
  const copy = options.copy !== false;

  return {
    id: 'clipboard',
    setup(context: DataGridPluginContext<T>): () => void {
      const cleanups: Array<() => void> = [];

      if (paste) {
        cleanups.push(context.slots.enablePaste());
        cleanups.push(
          context.capabilities.registerInteraction({
            id: 'clipboard-paste',
            setup: (element) => {
              const onPaste = (event: Event): void => {
                if (isEditableClipboardTarget(event.target)) {
                  return;
                }
                const clipboardEvent = event as ClipboardEvent;
                const text = clipboardEvent.clipboardData?.getData('text/plain');
                if (!text?.trim()) {
                  return;
                }
                if (runPaste(context, text)) {
                  clipboardEvent.preventDefault();
                }
              };
              element.addEventListener('paste', onPaste);
              return () => element.removeEventListener('paste', onPaste);
            },
          }),
        );
      }

      if (copy) {
        cleanups.push(context.slots.enableCopy());
        cleanups.push(
          context.capabilities.registerInteraction({
            id: 'clipboard-copy',
            setup: (element) => {
              const onCopy = (event: Event): void => {
                if (shouldDeferToNativeClipboard(event)) {
                  return;
                }
                const clipboardEvent = event as ClipboardEvent;
                const text = context.api.getSelectionClipboardText();
                if (text == null) {
                  return;
                }
                clipboardEvent.clipboardData?.setData('text/plain', text);
                clipboardEvent.preventDefault();
              };
              element.addEventListener('copy', onCopy);
              return () => element.removeEventListener('copy', onCopy);
            },
          }),
        );
      }

      return () => {
        for (const cleanup of [...cleanups].reverse()) {
          cleanup();
        }
      };
    },
  };
}

function isEditableClipboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** Let the browser copy selected text (sidebar, editors) instead of the focused cell. */
export function shouldDeferToNativeClipboard(event: Event): boolean {
  if (isEditableClipboardTarget(event.target)) {
    return true;
  }
  if (typeof window === 'undefined') {
    return false;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }
  return selection.toString().length > 0;
}

function runPaste<T>(context: DataGridPluginContext<T>, text: string): boolean {
  const matrix = parseClipboardMatrix(text);
  if (!matrix.length) {
    return false;
  }

  const focus = context.api.getFocusedCell() ?? null;
  const displayRows = context.api.getPagedDisplayRows();
  const visible = context.api.getVisibleColumnIds();
  const cellRange = context.capabilities.rangeSelection()?.range() ?? null;

  /** Display index the paste starts at; rows are walked forward in display order. */
  let startDisplayIndex = 0;
  let rowCount = matrix.length;
  let columnIds = [...visible];
  let matrixToApply = matrix;

  if (cellRange) {
    const aCol = visible.indexOf(cellRange.anchor.columnId);
    const bCol = visible.indexOf(cellRange.active.columnId);
    const rowStart = Math.min(cellRange.anchor.rowIndex, cellRange.active.rowIndex);
    const rowEnd = Math.max(cellRange.anchor.rowIndex, cellRange.active.rowIndex);
    const colStart = Math.min(aCol, bCol);
    const colEnd = Math.max(aCol, bCol);
    if (aCol >= 0 && bCol >= 0) {
      columnIds = visible.slice(colStart, colEnd + 1);
      startDisplayIndex = rowStart;
      let dataRowCount = 0;
      for (let i = rowStart; i <= rowEnd; i++) {
        if (displayRows[i]?.kind === 'data') {
          dataRowCount++;
        }
      }
      const srcCols = matrix.reduce((max, row) => Math.max(max, row.length), 0);
      if (srcCols > columnIds.length) {
        columnIds = visible.slice(colStart, colStart + srcCols);
      }
      rowCount = Math.max(matrix.length, dataRowCount);
      matrixToApply = tileMatrix(matrix, rowCount, columnIds.length);
    }
  } else if (focus) {
    startDisplayIndex = focus.rowIndex;
    if (displayRows[focus.rowIndex]?.kind === 'plugin') {
      // Detail shell — paste into the master immediately above.
      for (let i = focus.rowIndex - 1; i >= 0; i--) {
        if (displayRows[i]?.kind === 'data') {
          startDisplayIndex = i;
          break;
        }
      }
    }
    if (focus.columnId) {
      const start = columnIds.indexOf(focus.columnId);
      if (start >= 0) {
        columnIds = columnIds.slice(start);
      }
    }
  }

  const targets = collectPasteTargetRows(displayRows, startDisplayIndex, rowCount);
  const targetRowIds = targets.map((t) => t.rowId);
  matrixToApply = matrixToApply.slice(0, targets.length);

  const columnsById = context.api.getColumnsById();
  const parseCtx = {
    ...cellParseContextFromLocale(context.api.getLocale?.()),
    source: 'paste' as const,
  };
  const invalidCells: PasteInvalidCell[] = [];
  const processed = context.api.getProcessedRows() as T[];
  const { rows: suggestedRows, rowIds } = applyPasteMatrix(
    processed,
    matrixToApply,
    targetRowIds,
    columnIds,
    {
      rowId: (row, index) => context.api.resolveRowId(row, index),
      write: (row, columnId, value, rowIndex, rowId) => {
        // Read-only / computed columns are skipped, never overwritten.
        const out = writeCellFromText(row, columnsById.get(columnId), columnId, value, rowIndex, parseCtx);
        if (!out) {
          return row;
        }
        if ('error' in out) {
          invalidCells.push({ rowId, columnId, text: value, error: out.error });
          return row;
        }
        return out.row;
      },
    },
  );

  const payload: PasteEvent<T> = {
    startRowIndex: targets[0]?.dataIndex ?? 0,
    columnIds,
    matrix: matrixToApply,
    targetRowIds,
    suggestedRows,
    rowIds,
    invalidCells,
  };
  context.api.emitPaste(payload);
  return true;
}
