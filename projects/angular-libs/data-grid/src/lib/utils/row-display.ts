/**
 * Display-row model for grouped / tree / flat grids.
 * The viewport virtualizes `DisplayRow[]`, not raw `T[]`.
 */

import { getCellValue } from './cell-value';
import type { ColumnDef } from '../components/data-grid/data-grid.types';

export interface DataDisplayRow<T> {
  kind: 'data';
  /** Stable track id for the view (may include path prefix for trees). */
  id: string;
  rowId: string | number;
  row: T;
  /** Index within the filtered+sorted data list. */
  dataIndex: number;
  level: number;
}

export interface GroupDisplayRow {
  kind: 'group';
  id: string;
  field: string;
  key: string;
  level: number;
  expanded: boolean;
  childCount: number;
}

/**
 * Plugin-defined display row. Use `pluginKind` with `registerDisplayView({ kind })`.
 * Keeps the `kind` discriminant closed so built-in `@switch` narrows correctly.
 */
export interface CustomDisplayRow {
  kind: 'plugin';
  pluginKind: string;
  id: string;
  payload?: unknown;
  /**
   * Optional row height in px (e.g. master-detail panels).
   * Falls back to the grid `rowHeight` when omitted.
   */
  height?: number;
}

export type DisplayRow<T> = DataDisplayRow<T> | GroupDisplayRow | CustomDisplayRow;

export interface RowGroupConfig {
  /** Column ids / fields to group by (outer → inner). */
  columns: readonly string[];
}

export interface TreeDataConfig<T = unknown> {
  /** Hierarchical path for each row, e.g. `['Europe', 'UK', 'London']`. */
  getDataPath: (row: T) => readonly string[];
}

export interface BuildDisplayRowsOptions<T> {
  rows: readonly T[];
  rowId: (row: T, index: number) => string | number;
  columnsById: Map<string, ColumnDef<T>>;
  /** Group ids that are collapsed (default: all expanded). */
  collapsedGroupIds: ReadonlySet<string>;
  rowGroup?: RowGroupConfig | null;
  treeData?: TreeDataConfig<T> | null;
}

/** Flat 1:1 wrap when no group/tree config. */
export function wrapDataRows<T>(
  rows: readonly T[],
  rowId: (row: T, index: number) => string | number,
): DisplayRow<T>[] {
  return rows.map((row, dataIndex) => ({
    kind: 'data' as const,
    id: `d:${String(rowId(row, dataIndex))}`,
    rowId: rowId(row, dataIndex),
    row,
    dataIndex,
    level: 0,
  }));
}

export function buildDisplayRows<T>(options: BuildDisplayRowsOptions<T>): DisplayRow<T>[] {
  const { rows, rowId, columnsById, collapsedGroupIds, rowGroup, treeData } = options;

  if (treeData) {
    return buildTreeDisplayRows(rows, rowId, treeData, collapsedGroupIds);
  }
  if (rowGroup?.columns.length) {
    return buildGroupedDisplayRows(rows, rowId, columnsById, rowGroup.columns, collapsedGroupIds);
  }
  return wrapDataRows(rows, rowId);
}

function buildGroupedDisplayRows<T>(
  rows: readonly T[],
  rowId: (row: T, index: number) => string | number,
  columnsById: Map<string, ColumnDef<T>>,
  groupColumns: readonly string[],
  collapsedGroupIds: ReadonlySet<string>,
): DisplayRow<T>[] {
  const out: DisplayRow<T>[] = [];

  const walk = (
    subset: readonly { row: T; dataIndex: number }[],
    depth: number,
    pathPrefix: string,
  ): void => {
    const field = groupColumns[depth];
    if (!field) {
      for (const item of subset) {
        out.push({
          kind: 'data',
          id: `d:${String(rowId(item.row, item.dataIndex))}`,
          rowId: rowId(item.row, item.dataIndex),
          row: item.row,
          dataIndex: item.dataIndex,
          level: depth,
        });
      }
      return;
    }

    const column = columnsById.get(field);
    const buckets = new Map<string, { row: T; dataIndex: number }[]>();
    for (const item of subset) {
      const raw = column ? getCellValue(item.row, column, item.dataIndex) : (item.row as Record<string, unknown>)[field];
      const key = raw == null || raw === '' ? '(blank)' : String(raw);
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    }

    for (const [key, children] of buckets) {
      const groupId = `${pathPrefix}/${field}=${key}`;
      const expanded = !collapsedGroupIds.has(groupId);
      out.push({
        kind: 'group',
        id: groupId,
        field,
        key,
        level: depth,
        expanded,
        childCount: children.length,
      });
      if (expanded) {
        walk(children, depth + 1, groupId);
      }
    }
  };

  walk(
    rows.map((row, dataIndex) => ({ row, dataIndex })),
    0,
    'g',
  );
  return out;
}

interface TreeNode<T> {
  name: string;
  children: Map<string, TreeNode<T>>;
  rows: { row: T; dataIndex: number }[];
}

function buildTreeDisplayRows<T>(
  rows: readonly T[],
  rowId: (row: T, index: number) => string | number,
  treeData: TreeDataConfig<T>,
  collapsedGroupIds: ReadonlySet<string>,
): DisplayRow<T>[] {
  const root: TreeNode<T> = { name: '', children: new Map(), rows: [] };

  rows.forEach((row, dataIndex) => {
    const path = treeData.getDataPath(row);
    if (!path.length) {
      root.rows.push({ row, dataIndex });
      return;
    }
    let node = root;
    for (let i = 0; i < path.length; i++) {
      const segment = path[i] ?? '';
      let next = node.children.get(segment);
      if (!next) {
        next = { name: segment, children: new Map(), rows: [] };
        node.children.set(segment, next);
      }
      node = next;
      if (i === path.length - 1) {
        node.rows.push({ row, dataIndex });
      }
    }
  });

  const out: DisplayRow<T>[] = [];

  const walk = (node: TreeNode<T>, depth: number, pathPrefix: string): void => {
    for (const [name, child] of node.children) {
      const groupId = `${pathPrefix}/${name}`;
      const expanded = !collapsedGroupIds.has(groupId);
      const childCount = countLeaves(child);
      out.push({
        kind: 'group',
        id: groupId,
        field: 'path',
        key: name,
        level: depth,
        expanded,
        childCount,
      });
      if (expanded) {
        // Emit this node's own leaves before descendants (parent before children).
        for (const item of child.rows) {
          out.push({
            kind: 'data',
            id: `d:${groupId}:${String(rowId(item.row, item.dataIndex))}`,
            rowId: rowId(item.row, item.dataIndex),
            row: item.row,
            dataIndex: item.dataIndex,
            level: depth + 1,
          });
        }
        walk(child, depth + 1, groupId);
      }
    }
    // Root-only rows (empty path) after path groups at this level.
    if (node === root) {
      for (const item of node.rows) {
        out.push({
          kind: 'data',
          id: `d:${String(rowId(item.row, item.dataIndex))}`,
          rowId: rowId(item.row, item.dataIndex),
          row: item.row,
          dataIndex: item.dataIndex,
          level: depth,
        });
      }
    }
  };

  walk(root, 0, 't');
  return out;
}

function countLeaves<T>(node: TreeNode<T>): number {
  let n = node.rows.length;
  for (const child of node.children.values()) {
    n += countLeaves(child);
  }
  return n;
}

/** All tree group header ids for Collapse-all (path prefixes). */
export function collectTreeGroupIds<T>(
  rows: readonly T[],
  getDataPath: (row: T) => readonly string[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const path = getDataPath(row);
    let prefix = 't';
    for (const segment of path) {
      prefix = `${prefix}/${segment ?? ''}`;
      ids.add(prefix);
    }
  }
  return [...ids];
}

export function isGroupDisplayRow<T>(row: DisplayRow<T>): row is GroupDisplayRow {
  return row.kind === 'group';
}

export function isDataDisplayRow<T>(row: DisplayRow<T>): row is DataDisplayRow<T> {
  return row.kind === 'data';
}

export function isPluginDisplayRow<T>(row: DisplayRow<T>): row is CustomDisplayRow {
  return row.kind === 'plugin';
}

/**
 * Rows that consume one pagination slot (`data` / `group`).
 * Master-detail plugin rows trail the master and must not eat a page slot.
 */
export function isPaginationSlotRow<T>(row: DisplayRow<T>): boolean {
  return row.kind !== 'plugin';
}

export function countPaginationSlots<T>(rows: readonly DisplayRow<T>[]): number {
  let n = 0;
  for (const row of rows) {
    if (isPaginationSlotRow(row)) {
      n++;
    }
  }
  return n;
}

/** Data rows only — honest `getDisplayedRowCount()` (excludes group / plugin). */
export function countDisplayedDataRows<T>(rows: readonly DisplayRow<T>[]): number {
  let n = 0;
  for (const row of rows) {
    if (row.kind === 'data') {
      n++;
    }
  }
  return n;
}

/**
 * Slot index for a display index. Plugin rows share the preceding slot row.
 */
export function paginationSlotIndex<T>(
  rows: readonly DisplayRow<T>[],
  displayIndex: number,
): number {
  let slot = -1;
  const last = Math.min(Math.max(displayIndex, 0), rows.length - 1);
  for (let i = 0; i <= last; i++) {
    if (isPaginationSlotRow(rows[i]!)) {
      slot++;
    }
  }
  return Math.max(0, slot);
}

export function pageIndexForDisplayIndex<T>(
  rows: readonly DisplayRow<T>[],
  displayIndex: number,
  pageSize: number,
): number {
  if (pageSize <= 0) {
    return 0;
  }
  return Math.floor(paginationSlotIndex(rows, displayIndex) / pageSize);
}

/**
 * Page by slot rows; keep plugin rows immediately following an included master.
 */
export function paginateDisplayRows<T>(
  rows: readonly DisplayRow<T>[],
  pageIndex: number,
  pageSize: number,
): DisplayRow<T>[] {
  if (pageSize <= 0) {
    return [];
  }
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const out: DisplayRow<T>[] = [];
  let slot = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!isPaginationSlotRow(row)) {
      continue;
    }
    if (slot >= start && slot < end) {
      out.push(row);
      for (let j = i + 1; j < rows.length && rows[j]!.kind === 'plugin'; j++) {
        out.push(rows[j]!);
      }
    }
    slot++;
  }
  return out;
}

/**
 * Step a display index, skipping plugin (detail) rows.
 * Returns `from` when no non-plugin landing row exists in that direction.
 */
export function stepDisplayIndexSkippingPlugins<T>(
  rows: readonly DisplayRow<T>[],
  from: number,
  dRow: number,
): number {
  if (dRow === 0 || !rows.length) {
    return from;
  }
  const step = dRow > 0 ? 1 : -1;
  let i = from + dRow;
  while (i >= 0 && i < rows.length && rows[i]!.kind === 'plugin') {
    i += step;
  }
  if (i < 0 || i >= rows.length || rows[i]!.kind === 'plugin') {
    return from;
  }
  return i;
}

/** Resolve paint/virtual height for a display row. */
export function resolveDisplayRowHeight<T>(
  row: DisplayRow<T>,
  defaultHeight: number,
): number {
  if (row.kind === 'plugin' && row.height != null && row.height > 0) {
    return row.height;
  }
  return defaultHeight;
}
