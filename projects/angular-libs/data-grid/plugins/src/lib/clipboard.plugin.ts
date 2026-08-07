import {
  applyPasteMatrix,
  coerceCellEditValue,
  getCellValue,
  parseClipboardMatrix,
  writeCellValue,
  type PasteEvent,
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

function runPaste<T>(context: DataGridPluginContext<T>, text: string): boolean {
  const matrix = parseClipboardMatrix(text);
  if (!matrix.length) {
    return false;
  }

  const focus = context.api.getFocusedCell() ?? null;
  const displayRows = context.api.getPagedDisplayRows();
  const visible = context.api.getVisibleColumnIds();
  const cellRange = context.api.getCellRange?.() ?? null;

  let startRowIndex = 0;
  let columnIds = [...visible];

  if (cellRange) {
    const aCol = visible.indexOf(cellRange.anchor.columnId);
    const bCol = visible.indexOf(cellRange.active.columnId);
    const rowStart = Math.min(cellRange.anchor.rowIndex, cellRange.active.rowIndex);
    const rowEnd = Math.max(cellRange.anchor.rowIndex, cellRange.active.rowIndex);
    const colStart = Math.min(aCol, bCol);
    const colEnd = Math.max(aCol, bCol);
    if (aCol >= 0 && bCol >= 0) {
      columnIds = visible.slice(colStart, colEnd + 1);
      for (let i = rowStart; i <= rowEnd; i++) {
        const item = displayRows[i];
        if (item?.kind === 'data') {
          startRowIndex = item.dataIndex;
          break;
        }
      }
    }
  } else if (focus) {
    // Prefer focused data row; otherwise the next data row at/after focus.
    for (let i = focus.rowIndex; i < displayRows.length; i++) {
      const item = displayRows[i];
      if (item?.kind === 'data') {
        startRowIndex = item.dataIndex;
        break;
      }
    }
    if (focus.columnId) {
      const start = columnIds.indexOf(focus.columnId);
      if (start >= 0) {
        columnIds = columnIds.slice(start);
      }
    }
  }

  const columnsById = context.api.getColumnsById();
  const processed = context.api.getProcessedRows() as T[];
  const { rows: suggestedRows } = applyPasteMatrix(
    processed,
    matrix,
    startRowIndex,
    columnIds,
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
    columnIds,
    matrix,
    suggestedRows,
  };
  context.api.emitPaste(payload);
  return true;
}
