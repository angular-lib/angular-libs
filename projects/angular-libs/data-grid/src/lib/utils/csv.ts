import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { formatCellValue, getCellValue } from './cell-value';

export interface CsvProcessCellParams<T = unknown> {
  /** Raw cell value (after `valueGetter`). */
  value: unknown;
  /** Display text (after `valueFormatter`), or raw text when `useFormatter: false`. */
  formatted: string;
  row: T;
  column: ColumnDef<T>;
  rowIndex: number;
}

/** Low-level {@link rowsToCsv} knobs (clipboard + export share it). */
export interface RowsToCsvOptions<T = unknown> {
  /** Emit a header line. Default true. */
  includeHeaders?: boolean;
  /** Default `,`. */
  columnSeparator?: string;
  /** Default `\n` (file export uses `\r\n`). */
  lineSeparator?: string;
  /**
   * Prefix text cells starting with `=`, `+`, `-`, `@`, tab or CR with `'` so
   * spreadsheets do not evaluate them as formulas (CSV injection). Plain
   * numbers such as `-12.5` are left alone. Default false here; file export: true.
   */
  escapeFormulas?: boolean;
  /** Write `valueFormatter` display text (default) instead of the raw value. */
  useFormatter?: boolean;
  /** Final say on a cell's text (before quoting / formula escaping). */
  processCell?: (params: CsvProcessCellParams<T>) => string;
}

/** Options for `api.exportCsv(…)` / `csvExportPlugin`. */
export interface CsvExportOptions<T = unknown> extends RowsToCsvOptions<T> {
  /** Download filename. Default `data-grid.csv`. */
  filename?: string;
  /**
   * Column ids to export, in this order (hidden columns allowed).
   * Default: visible columns without `suppressExport`.
   */
  columnKeys?: readonly string[];
  /** Only rows in the current selection (still filter/sort order). */
  onlySelected?: boolean;
  /** Prepend a UTF-8 BOM so Excel detects the encoding (æøå). Default true. */
  bom?: boolean;
  /**
   * Locale for the default {@link RowsToCsvOptions.columnSeparator}: `;` where
   * the decimal separator is `,` (e.g. `nb-NO`, `de-DE`), else `,`.
   * Default: runtime locale.
   */
  locale?: string;
}

const FORMULA_START = /^[=+\-@\t\r]/;
/** Digits with grouping / decimal marks, optional sign, exponent or percent. */
const PLAIN_NUMBER = /^[+-]?[\d.,\s  ]*\d[\d.,\s  ]*(e[+-]?\d+)?%?$/i;

function escapeCsv(value: string, separator: string, escapeFormulas: boolean): string {
  if (escapeFormulas && FORMULA_START.test(value) && !PLAIN_NUMBER.test(value)) {
    value = `'${value}`;
  }
  if (value.includes(separator) || /["\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rawText(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  return String(value);
}

/** `;` when the locale writes decimals with `,` (Excel's list separator there), else `,`. */
export function defaultCsvColumnSeparator(locale?: string): ',' | ';' {
  try {
    const decimal = new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find((part) => part.type === 'decimal')?.value;
    return decimal === ',' ? ';' : ',';
  } catch {
    return ',';
  }
}

/** Build a CSV string from columns + rows. */
export function rowsToCsv<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  options?: RowsToCsvOptions<T>,
): string {
  const includeHeaders = options?.includeHeaders !== false;
  const separator = options?.columnSeparator ?? ',';
  const escapeFormulas = options?.escapeFormulas ?? false;
  const useFormatter = options?.useFormatter !== false;
  const processCell = options?.processCell;
  const esc = (text: string) => escapeCsv(text, separator, escapeFormulas);
  const lines: string[] = [];

  if (includeHeaders) {
    lines.push(columns.map((c) => esc(c.header ?? c.field ?? c.id ?? '')).join(separator));
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    lines.push(
      columns
        .map((column) => {
          const value = getCellValue(row, column, i);
          const formatted = useFormatter ? formatCellValue(value, row, column, i) : rawText(value);
          const text = processCell
            ? processCell({ value, formatted, row, column, rowIndex: i })
            : formatted;
          return esc(text ?? '');
        })
        .join(separator),
    );
  }

  return lines.join(options?.lineSeparator ?? '\n');
}

/**
 * CSV text for a file export: {@link rowsToCsv} with export defaults —
 * locale list separator, CRLF line endings, formula escaping on.
 * Column / row picking (`columnKeys`, `onlySelected`) is the caller's job.
 */
export function rowsToCsvExport<T>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
  options: CsvExportOptions<T> = {},
): string {
  return rowsToCsv(rows, columns, {
    ...options,
    columnSeparator: options.columnSeparator ?? defaultCsvColumnSeparator(options.locale),
    lineSeparator: options.lineSeparator ?? '\r\n',
    escapeFormulas: options.escapeFormulas ?? true,
  });
}

/**
 * Trigger a browser download for CSV content (no-op when `document` is missing).
 * Prepends a UTF-8 BOM unless `bom: false`.
 */
export function downloadCsv(filename: string, csv: string, options?: { bom?: boolean }): void {
  if (typeof document === 'undefined') {
    return;
  }
  const content = options?.bom === false ? csv : `﻿${csv}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  // Firefox ignores clicks on detached anchors; revoking synchronously can cancel the download.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
