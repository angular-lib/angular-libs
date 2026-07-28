/**
 * Parse clipboard TSV / CSV text into a matrix of cell strings.
 */
export function parseClipboardMatrix(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line, i, arr) => !(i === arr.length - 1 && line === ''));
  return lines.map((line) => splitDelimitedLine(line));
}

function splitDelimitedLine(line: string): string[] {
  // Prefer tab (spreadsheet copy); fall back to comma.
  if (line.includes('\t')) {
    return line.split('\t');
  }
  return parseCsvLine(line);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export interface PasteApplyResult<T> {
  rows: T[];
  changed: number;
}

/**
 * Apply a pasted matrix starting at `startRowIndex` across `columnIds`.
 * Uses shallow field writes; hosts should prefer listening to `paste` and updating themselves.
 */
export function applyPasteMatrix<T>(
  rows: readonly T[],
  matrix: string[][],
  startRowIndex: number,
  columnIds: string[],
  options: {
    rowId: (row: T, index: number) => string | number;
    write: (row: T, columnId: string, value: string, rowIndex: number) => T;
  },
): PasteApplyResult<T> {
  if (!matrix.length || !columnIds.length) {
    return { rows: [...rows], changed: 0 };
  }
  const next = [...rows] as T[];
  let changed = 0;
  for (let r = 0; r < matrix.length; r++) {
    const rowIndex = startRowIndex + r;
    if (rowIndex < 0 || rowIndex >= next.length) {
      break;
    }
    let row: T = next[rowIndex] as T;
    const cells = matrix[r]!;
    for (let c = 0; c < columnIds.length && c < cells.length; c++) {
      const columnId = columnIds[c]!;
      const value = cells[c] ?? '';
      const updated = options.write(row, columnId, value, rowIndex);
      if (updated !== row) {
        row = updated;
        changed++;
      }
    }
    next[rowIndex] = row;
  }
  return { rows: next, changed };
}
