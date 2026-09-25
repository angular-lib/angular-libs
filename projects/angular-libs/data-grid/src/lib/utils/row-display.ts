/**
 * Display-row model for grouped / tree / flat grids.
 * The viewport virtualizes `DisplayRow[]`, not raw `T[]`.
 */

import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { bucketByGroupField, groupValueLabel, groupValueTag, rowGroupId, treeNodeId } from './group-key';

export interface DataDisplayRow<T> {
  kind: 'data';
  /** Stable track id for the view. */
  id: string;
  rowId: string | number;
  row: T;
  /** Index within the filtered+sorted data list. */
  dataIndex: number;
  level: number;
  /**
   * Tree data: this row's node id when it has child nodes — pass to
   * `toggleGroup` / collapse sets. Absent on leaves and in flat / grouped grids.
   */
  groupId?: string;
  /** Tree data: true when this row's node has children (shows an expand toggle). */
  hasChildren?: boolean;
  /** Tree data: children are shown (only meaningful with `hasChildren`). */
  expanded?: boolean;
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

function dataRow<T>(
  row: T,
  dataIndex: number,
  rowId: (row: T, index: number) => string | number,
  level: number,
): DataDisplayRow<T> {
  const id = rowId(row, dataIndex);
  return { kind: 'data', id: `d:${String(id)}`, rowId: id, row, dataIndex, level };
}

/** Flat 1:1 wrap when no group/tree config. */
export function wrapDataRows<T>(
  rows: readonly T[],
  rowId: (row: T, index: number) => string | number,
): DisplayRow<T>[] {
  const out: DisplayRow<T>[] = new Array(rows.length);
  for (let dataIndex = 0; dataIndex < rows.length; dataIndex++) {
    out[dataIndex] = dataRow(rows[dataIndex]!, dataIndex, rowId, 0);
  }
  return out;
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
    path: readonly (readonly [string, string])[],
  ): void => {
    const field = groupColumns[depth];
    if (!field) {
      for (const item of subset) {
        out.push(dataRow(item.row, item.dataIndex, rowId, depth));
      }
      return;
    }

    for (const bucket of bucketByGroupField(subset, field, columnsById.get(field))) {
      const groupPath = [...path, [field, bucket.tag] as const];
      const groupId = rowGroupId(groupPath);
      const expanded = !collapsedGroupIds.has(groupId);
      out.push({
        kind: 'group',
        id: groupId,
        field,
        key: bucket.label,
        level: depth,
        expanded,
        childCount: bucket.items.length,
      });
      if (expanded) {
        walk(bucket.items, depth + 1, groupPath);
      }
    }
  };

  walk(
    rows.map((row, dataIndex) => ({ row, dataIndex })),
    0,
    [],
  );
  return out;
}

interface TreeNode<T> {
  id: string;
  label: string;
  children: Map<string, TreeNode<T>>;
  /** Data rows whose path is exactly this node (usually 0 or 1). */
  rows: { row: T; dataIndex: number }[];
  /** Data rows at or below this node. */
  size: number;
}

/**
 * Tree model (AG-like): the row at a path **is** that node. Group rows are
 * synthesized only for missing ancestors ("filler" nodes); a data row whose
 * node has children carries `hasChildren` / `expanded` / `groupId`.
 */
function buildTreeDisplayRows<T>(
  rows: readonly T[],
  rowId: (row: T, index: number) => string | number,
  treeData: TreeDataConfig<T>,
  collapsedGroupIds: ReadonlySet<string>,
): DisplayRow<T>[] {
  const root: TreeNode<T> = { id: '', label: '', children: new Map(), rows: [], size: 0 };
  const rootRows: { row: T; dataIndex: number }[] = [];

  rows.forEach((row, dataIndex) => {
    const path = treeData.getDataPath(row);
    if (!path.length) {
      rootRows.push({ row, dataIndex });
      return;
    }
    let node = root;
    const tags: string[] = [];
    for (const segment of path) {
      const tag = groupValueTag(segment);
      tags.push(tag);
      let next = node.children.get(tag);
      if (!next) {
        next = {
          id: treeNodeId(tags),
          label: groupValueLabel(segment),
          children: new Map(),
          rows: [],
          size: 0,
        };
        node.children.set(tag, next);
      }
      next.size++;
      node = next;
    }
    node.rows.push({ row, dataIndex });
  });

  const out: DisplayRow<T>[] = [];

  const walk = (node: TreeNode<T>, depth: number): void => {
    for (const child of node.children.values()) {
      const hasChildren = child.children.size > 0;
      const expanded = !hasChildren || !collapsedGroupIds.has(child.id);
      if (!child.rows.length) {
        // Filler: no row at this path — synthesize a group header.
        out.push({
          kind: 'group',
          id: child.id,
          field: 'path',
          key: child.label,
          level: depth,
          expanded,
          childCount: child.size,
        });
      } else {
        child.rows.forEach((item, i) => {
          const display = dataRow(item.row, item.dataIndex, rowId, depth);
          // Duplicate paths: only the first row owns the node's toggle.
          if (hasChildren && i === 0) {
            display.groupId = child.id;
            display.hasChildren = true;
            display.expanded = expanded;
          }
          out.push(display);
        });
      }
      if (hasChildren && expanded) {
        walk(child, depth + 1);
      }
    }
  };

  walk(root, 0);
  // Root-only rows (empty path) after path nodes.
  for (const item of rootRows) {
    out.push(dataRow(item.row, item.dataIndex, rowId, 0));
  }
  return out;
}

/** All collapsible tree node ids for Collapse-all (every proper path prefix). */
export function collectTreeGroupIds<T>(
  rows: readonly T[],
  getDataPath: (row: T) => readonly string[],
): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    const path = getDataPath(row);
    const tags: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      tags.push(groupValueTag(path[i]));
      ids.add(treeNodeId(tags));
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
