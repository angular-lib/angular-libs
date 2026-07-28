import type {
  ColumnDef,
  ColumnGroupDef,
  ColumnOrGroupDef,
  ColumnPin,
  ResolvedColumn,
} from '../components/data-grid/data-grid.types';
import { resolveColumnId, resolveColumns } from './cell-value';

export interface HeaderGroupCell {
  label: string;
  colspan: number;
  rowspan: number;
  /** Present for leaf headers / spacers that align to a column. */
  columnId?: string;
  /** Top-level group id when this cell is a group header. */
  groupId?: string;
  /**
   * Pin side for this header cell. Group cells split when children
   * straddle different pin sides (so sticky can apply independently).
   */
  pinned?: ColumnPin | null;
  /** First leaf column id covered — used for sticky `left` offset. */
  startColumnId?: string;
  /** Last leaf column id covered — used for sticky `right` offset. */
  endColumnId?: string;
}

export interface ColumnGroupMeta {
  groupId: string;
  groupLabel: string;
}

export function isColumnGroupDef<T>(def: ColumnOrGroupDef<T>): def is ColumnGroupDef<T> {
  return !!def && typeof def === 'object' && 'children' in def && Array.isArray(def.children);
}

/** Flatten nested column/group defs into leaf ColumnDefs (depth-first). */
export function flattenColumnDefs<T>(defs: readonly ColumnOrGroupDef<T>[]): ColumnDef<T>[] {
  const leaves: ColumnDef<T>[] = [];
  const walk = (items: readonly ColumnOrGroupDef<T>[]) => {
    for (const item of items) {
      if (isColumnGroupDef(item)) {
        walk(item.children);
      } else {
        leaves.push(item);
      }
    }
  };
  walk(defs);
  return leaves;
}

export function maxGroupDepth<T>(defs: readonly ColumnOrGroupDef<T>[]): number {
  let max = 1;
  for (const item of defs) {
    if (isColumnGroupDef(item)) {
      max = Math.max(max, 1 + maxGroupDepth(item.children));
    }
  }
  return max;
}

/**
 * Map each leaf column id → its top-level group.
 * Ids match `resolveColumns(flattenColumnDefs(defs))` (same depth-first index).
 */
export function buildLeafGroupMap<T>(
  defs: readonly ColumnOrGroupDef<T>[],
): Map<string, ColumnGroupMeta> {
  const map = new Map<string, ColumnGroupMeta>();
  let leafIndex = 0;

  const assignGroupLeaves = (
    children: readonly ColumnOrGroupDef<T>[],
    meta: ColumnGroupMeta,
  ) => {
    for (const child of children) {
      if (isColumnGroupDef(child)) {
        assignGroupLeaves(child.children, meta);
      } else {
        const id = resolveColumnId(child, leafIndex++);
        map.set(id, meta);
      }
    }
  };

  defs.forEach((item, topIndex) => {
    if (isColumnGroupDef(item)) {
      const meta: ColumnGroupMeta = {
        groupId: item.id ?? `group-${topIndex}-${item.headerName}`,
        groupLabel: item.headerName,
      };
      assignGroupLeaves(item.children, meta);
      return;
    }
    const id = resolveColumnId(item, leafIndex++);
    map.set(id, { groupId: `leaf-${id}`, groupLabel: item.header ?? id });
  });

  return map;
}

function pinKey(pinned: ColumnPin | null | undefined): ColumnPin | null {
  return pinned === 'left' || pinned === 'right' ? pinned : null;
}

/**
 * Build the top group header from the *current visible leaf order*.
 * Contiguous leaves that share a groupId **and pin side** collapse into one
 * colspan cell. Pin-side splits keep sticky headers aligned when scrolling.
 */
export function buildVisibleGroupHeaderRow<T>(
  visibleLeaves: readonly ResolvedColumn<T>[],
  leafGroups: Map<string, ColumnGroupMeta>,
): HeaderGroupCell[] {
  if (!visibleLeaves.length) {
    return [];
  }

  const cells: HeaderGroupCell[] = [];
  let current: HeaderGroupCell | null = null;

  for (const leaf of visibleLeaves) {
    const meta = leafGroups.get(leaf.id);
    const groupId = meta?.groupId ?? `leaf-${leaf.id}`;
    const isRealGroup = !!meta && !meta.groupId.startsWith('leaf-');
    const pinned = pinKey(leaf.pinned);

    if (!isRealGroup) {
      if (current) {
        cells.push(current);
        current = null;
      }
      // Spacer under the group row for ungrouped columns.
      cells.push({
        label: '',
        colspan: 1,
        rowspan: 1,
        columnId: leaf.id,
        groupId,
        pinned,
        startColumnId: leaf.id,
        endColumnId: leaf.id,
      });
      continue;
    }

    if (current && current.groupId === groupId && (current.pinned ?? null) === pinned) {
      current.colspan += 1;
      current.endColumnId = leaf.id;
    } else {
      if (current) {
        cells.push(current);
      }
      current = {
        label: meta!.groupLabel,
        colspan: 1,
        rowspan: 1,
        groupId,
        pinned,
        startColumnId: leaf.id,
        endColumnId: leaf.id,
      };
    }
  }
  if (current) {
    cells.push(current);
  }
  return cells;
}

/** True when defs contain at least one real ColumnGroupDef. */
export function hasColumnGroups<T>(defs: readonly ColumnOrGroupDef<T>[]): boolean {
  return defs.some((d) => isColumnGroupDef(d));
}

/** @deprecated Prefer buildVisibleGroupHeaderRow */
export function buildHeaderRows<T>(
  defs: readonly ColumnOrGroupDef<T>[],
  resolvedLeaves: readonly ResolvedColumn<T>[],
): HeaderGroupCell[][] {
  if (!hasColumnGroups(defs)) {
    return [
      resolvedLeaves.map((col) => ({
        label: col.header,
        colspan: 1,
        rowspan: 1,
        columnId: col.id,
        pinned: pinKey(col.pinned),
        startColumnId: col.id,
        endColumnId: col.id,
      })),
    ];
  }
  return [buildVisibleGroupHeaderRow(resolvedLeaves, buildLeafGroupMap(defs))];
}

export function resolveColumnOrGroupDefs<T>(
  defs: readonly ColumnOrGroupDef<T>[],
): ResolvedColumn<T>[] {
  return resolveColumns(flattenColumnDefs(defs));
}

/** Same top-level group? Used to constrain column reorder. */
export function sameColumnGroup(
  leafGroups: Map<string, ColumnGroupMeta>,
  columnIdA: string,
  columnIdB: string,
): boolean {
  const a = leafGroups.get(columnIdA)?.groupId;
  const b = leafGroups.get(columnIdB)?.groupId;
  return !!a && !!b && a === b;
}
