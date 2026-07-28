import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { formatCellValue, getCellValue } from './cell-value';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV string from visible columns + rows. */
export function rowsToCsv<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  options?: { includeHeaders?: boolean },
): string {
  const includeHeaders = options?.includeHeaders !== false;
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columns.map((c) => escapeCsv(c.header ?? c.field ?? c.id ?? '')).join(','));
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    lines.push(
      columns
        .map((column) => {
          const value = getCellValue(row, column, i);
          return escapeCsv(formatCellValue(value, row, column, i));
        })
        .join(','),
    );
  }

  return lines.join('\n');
}

/** Trigger a browser download for CSV content (no-op when `document` is missing). */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
