/**
 * Collision-free ids for row-group and tree nodes.
 *
 * Each value is type-tagged (`s:` string, `n:` number, `d:` Date, …) and every
 * segment is percent-encoded (so it never contains the `/` / `=` separators, nor
 * quotes — ids stay safe inside `[data-testid="…"]` selectors). Hence
 * `{ a: 'x/b=y' }` vs `{ a: 'x', b: 'y' }`,
 * `['a/b']` vs `['a', 'b']`, `1` vs `'1'`, and a literal `'(blank)'` vs blank
 * never share an id. Shared by `row-display.ts` and `collect-group-ids.ts`.
 */

import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { getCellValue } from './cell-value';

/** Tag for `null` / `undefined` / `''` / invalid Date — no typed tag can equal it. */
export const BLANK_GROUP_TAG = 'blank';

/** Label shown for a blank group value. */
export const BLANK_GROUP_LABEL = '(blank)';

/** Type-tagged bucket key for one group value. */
export function groupValueTag(raw: unknown): string {
  if (raw == null || raw === '') {
    return BLANK_GROUP_TAG;
  }
  switch (typeof raw) {
    case 'string':
      return `s:${raw}`;
    case 'number':
      return `n:${String(raw)}`;
    case 'bigint':
      return `i:${String(raw)}`;
    case 'boolean':
      return `b:${String(raw)}`;
  }
  if (raw instanceof Date) {
    const time = raw.getTime();
    return Number.isNaN(time) ? BLANK_GROUP_TAG : `d:${time}`;
  }
  try {
    return `o:${JSON.stringify(raw)}`;
  } catch {
    return `o:${String(raw)}`;
  }
}

/** Human label for a group value (blank → `(blank)`, Date → ISO). */
export function groupValueLabel(raw: unknown): string {
  if (raw == null || raw === '') {
    return BLANK_GROUP_LABEL;
  }
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? BLANK_GROUP_LABEL : raw.toISOString();
  }
  return String(raw);
}

/** Row-group id from `[field, tag]` pairs (outer → inner): `g/<field>=<tag>/…`. */
export function rowGroupId(path: readonly (readonly [string, string])[]): string {
  let id = 'g';
  for (const [field, tag] of path) {
    id += `/${encodeURIComponent(field)}=${encodeURIComponent(tag)}`;
  }
  return id;
}

/** Tree node id from type-tagged path segments (root → node): `t/<tag>/…`. */
export function treeNodeId(tags: readonly string[]): string {
  let id = 't';
  for (const tag of tags) {
    id += `/${encodeURIComponent(tag)}`;
  }
  return id;
}

export interface GroupBucket<I> {
  tag: string;
  label: string;
  items: I[];
}

/** Bucket items by one group field (first-seen order), keyed by {@link groupValueTag}. */
export function bucketByGroupField<T, I extends { row: T; dataIndex: number }>(
  items: readonly I[],
  field: string,
  column: ColumnDef<T> | undefined,
): GroupBucket<I>[] {
  const buckets = new Map<string, GroupBucket<I>>();
  for (const item of items) {
    const raw = column
      ? getCellValue(item.row, column, item.dataIndex)
      : (item.row as Record<string, unknown>)[field];
    const tag = groupValueTag(raw);
    let bucket = buckets.get(tag);
    if (!bucket) {
      bucket = { tag, label: groupValueLabel(raw), items: [] };
      buckets.set(tag, bucket);
    }
    bucket.items.push(item);
  }
  return [...buckets.values()];
}
