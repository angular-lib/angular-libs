/**
 * Collect all row-group ids without mutating expand/collapse state.
 * Walks every nesting level even when parents would be collapsed in the view.
 */

import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { bucketByGroupField, rowGroupId } from './group-key';

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
    path: readonly (readonly [string, string])[],
  ): void => {
    const field = groupColumns[depth];
    if (!field) {
      return;
    }

    for (const bucket of bucketByGroupField(subset, field, columnsById.get(field))) {
      const groupPath = [...path, [field, bucket.tag] as const];
      ids.push(rowGroupId(groupPath));
      if (depth + 1 < groupColumns.length) {
        walk(bucket.items, depth + 1, groupPath);
      }
    }
  };

  walk(
    rows.map((row, dataIndex) => ({ row, dataIndex })),
    0,
    [],
  );
  return ids;
}
