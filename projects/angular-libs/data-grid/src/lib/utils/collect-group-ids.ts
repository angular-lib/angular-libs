/**
 * Collect all row-group ids without mutating expand/collapse state.
 * Walks every nesting level even when parents would be collapsed in the view.
 */

import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';

export function collectAllGroupIds<T>(
  rows: readonly T[],
  groupColumns: readonly string[],
  columnsById: Map<string, ColumnDef<T>>,
): string[] {
  if (!groupColumns.length || !rows.length) {
    return [];
  }

  const ids: string[] = [];

  const walk = (
    subset: readonly { row: T; dataIndex: number }[],
    depth: number,
    pathPrefix: string,
  ): void => {
    const field = groupColumns[depth];
    if (!field) {
      return;
    }

    const column = columnsById.get(field);
    const buckets = new Map<string, { row: T; dataIndex: number }[]>();
    for (const item of subset) {
      const raw = column
        ? getCellValue(item.row, column, item.dataIndex)
        : (item.row as Record<string, unknown>)[field];
      const key = raw == null || raw === '' ? '(blank)' : String(raw);
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }

    for (const [key, children] of buckets) {
      const groupId = `${pathPrefix}/${field}=${key}`;
      ids.push(groupId);
      if (depth + 1 < groupColumns.length) {
        walk(children, depth + 1, groupId);
      }
    }
  };

  walk(
    rows.map((row, dataIndex) => ({ row, dataIndex })),
    0,
    'g',
  );
  return ids;
}
