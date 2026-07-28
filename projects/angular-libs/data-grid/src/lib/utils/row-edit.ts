import type { FieldTree } from '@angular/forms/signals';
import type { ColumnDef } from '../components/data-grid/data-grid.types';

/** Shallow clone suitable as a signal-forms draft model (no null fields). */
export function cloneRowDraft<T>(row: T): T {
  if (row == null || typeof row !== 'object') {
    return row;
  }
  if (Array.isArray(row)) {
    return [...row] as T;
  }
  return { ...(row as object) } as T;
}

/** Resolve a dynamic column field on a FieldTree (runtime key access). */
export function formFieldForColumn<T>(
  tree: FieldTree<T> | null | undefined,
  column: ColumnDef<T>,
): FieldTree<unknown> | null {
  if (!tree) {
    return null;
  }
  const key = column.field ?? column.id;
  if (!key) {
    return null;
  }
  const node = (tree as Record<string, unknown>)[key];
  return (node as FieldTree<unknown> | undefined) ?? null;
}
