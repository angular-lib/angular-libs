import type { ColumnDef, ResolvedColumn } from '../components/data-grid/data-grid.types';

export function resolveColumnId<T>(column: ColumnDef<T>, index: number): string {
  return column.id ?? column.field ?? `col-${index}`;
}

export function resolveColumns<T>(columns: readonly ColumnDef<T>[]): ResolvedColumn<T>[] {
  return columns.map((column, index) => {
    const id = resolveColumnId(column, index);
    return {
      ...column,
      id,
      header: column.header ?? column.field ?? id,
      sortable: column.sortable !== false,
      minWidth: column.minWidth ?? 72,
    };
  });
}

export function orderColumns<T>(
  columns: readonly ResolvedColumn<T>[],
  order: readonly string[],
): ResolvedColumn<T>[] {
  if (!order.length) {
    return [...columns];
  }
  const byId = new Map(columns.map((c) => [c.id, c]));
  const ordered: ResolvedColumn<T>[] = [];
  for (const id of order) {
    const col = byId.get(id);
    if (col) {
      ordered.push(col);
      byId.delete(id);
    }
  }
  for (const col of columns) {
    if (byId.has(col.id)) {
      ordered.push(col);
    }
  }
  return ordered;
}

export function getCellValue<T>(
  row: T,
  column: ColumnDef<T>,
  rowIndex: number,
): unknown {
  if (column.valueGetter) {
    return column.valueGetter(row, rowIndex);
  }
  if (column.field) {
    return (row as Record<string, unknown>)[column.field];
  }
  return undefined;
}

export function formatCellValue<T>(
  value: unknown,
  row: T,
  column: ColumnDef<T>,
  rowIndex: number,
): string {
  if (column.valueFormatter) {
    return column.valueFormatter(value, row, rowIndex);
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

export function resolveCellClass<T>(
  value: unknown,
  row: T,
  column: ColumnDef<T>,
  rowIndex: number,
): string {
  const raw = column.cellClass;
  if (!raw) {
    return '';
  }
  if (typeof raw === 'function') {
    const result = raw(value, row, rowIndex);
    if (!result) {
      return '';
    }
    return Array.isArray(result) ? result.filter(Boolean).join(' ') : result;
  }
  return raw;
}

export function isBooleanColumn<T>(column: ColumnDef<T>, value?: unknown): boolean {
  if (column.type === 'boolean' || column.filter === 'boolean') {
    return true;
  }
  return typeof value === 'boolean';
}

export function isDateColumn<T>(column: ColumnDef<T>): boolean {
  return column.type === 'date' || column.filter === 'date';
}

export function resolveRowClass<T>(
  row: T,
  rowIndex: number,
  rowClass:
    | string
    | string[]
    | ((row: T, rowIndex: number) => string | string[] | null | undefined)
    | null
    | undefined,
): string {
  if (!rowClass) {
    return '';
  }
  if (typeof rowClass === 'function') {
    const result = rowClass(row, rowIndex);
    if (!result) {
      return '';
    }
    return Array.isArray(result) ? result.filter(Boolean).join(' ') : result;
  }
  return Array.isArray(rowClass) ? rowClass.filter(Boolean).join(' ') : rowClass;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
