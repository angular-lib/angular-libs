import type { ColumnPin, ResolvedColumn } from '../components/data-grid/data-grid.types';
import { moveItem } from './cell-value';

/** Built-in chrome column track sizes (px). */
export const CHROME_TRACK = {
  drag: 36,
  select: 40,
  rowEdit: 132,
} as const;

export interface ColumnTracksChrome {
  drag?: boolean;
  select?: boolean;
  rowEdit?: boolean;
}

export interface ColumnTrackLayout {
  /** CSS `grid-template-columns` value (chrome + data columns), all px tracks. */
  tracks: string;
  /** Rendered pixel width per data column id (flex + fill already resolved). */
  widthsPx: Record<string, number>;
}

function chromeWidth(chrome: ColumnTracksChrome): number {
  return (
    (chrome.drag ? CHROME_TRACK.drag : 0) +
    (chrome.select ? CHROME_TRACK.select : 0) +
    (chrome.rowEdit ? CHROME_TRACK.rowEdit : 0)
  );
}

/**
 * Build CSS Grid track list for chrome + visible columns.
 *
 * Every track is resolved to **px** against `containerWidth` (the scrollport's
 * inner width) so each row grid lays out identically regardless of which rows
 * are rendered — `fr` tracks inside `width: max-content` rows would size to
 * the longest rendered cell text. Flex columns share the space left after
 * fixed columns + chrome (never below `minWidth`).
 *
 * With no flex columns, the last unpinned column grows to fill leftover space
 * (so sticky right chrome sits at the edge) until the user resizes it — a
 * width override on that column opts it out, leaving a gap instead.
 * `rowEdit` appends a 132px actions track — callers may keep that flag on after
 * leaving full-row mode so flex columns do not reflow.
 */
export function resolveColumnTracks<T>(
  columns: readonly ResolvedColumn<T>[],
  overrides: Record<string, number> = {},
  chrome: ColumnTracksChrome = {},
  containerWidth = 0,
): ColumnTrackLayout {
  const reserved = chromeWidth(chrome);
  const widthsPx = resolveColumnWidths(columns, overrides, containerWidth, reserved);

  const hasFlex = columns.some(
    (col) => overrides[col.id] == null && col.width == null && (col.flex ?? 0) > 0,
  );
  if (!hasFlex) {
    let fill: ResolvedColumn<T> | undefined;
    for (let i = columns.length - 1; i >= 0; i--) {
      const col = columns[i]!;
      if (col.pinned !== 'left' && col.pinned !== 'right') {
        fill = col;
        break;
      }
    }
    if (fill && overrides[fill.id] == null) {
      const used = columns.reduce((sum, col) => sum + widthsPx[col.id]!, 0);
      const leftover = Math.floor(containerWidth - reserved - used);
      if (leftover > 0) {
        widthsPx[fill.id] = widthsPx[fill.id]! + leftover;
      }
    }
  }

  const parts: string[] = [];
  if (chrome.drag) {
    parts.push(`${CHROME_TRACK.drag}px`);
  }
  if (chrome.select) {
    parts.push(`${CHROME_TRACK.select}px`);
  }
  for (const col of columns) {
    parts.push(`${widthsPx[col.id]}px`);
  }
  if (chrome.rowEdit) {
    parts.push(`${CHROME_TRACK.rowEdit}px`);
  }

  return {
    tracks: parts.length ? parts.join(' ') : 'none',
    widthsPx,
  };
}

/**
 * Resolve pixel widths for visible columns against a container.
 * Overrides / `width` are fixed; columns with neither and no `flex` use
 * `minWidth`. Flex columns split what is left (`containerInnerWidth` minus
 * `reservedWidth` minus fixed), proportional to `flex`; a column whose share
 * would drop below `minWidth` is clamped and the rest is redistributed.
 */
export function resolveColumnWidths<T>(
  columns: readonly ResolvedColumn<T>[],
  overrides: Record<string, number>,
  containerInnerWidth: number,
  reservedWidth = 0,
): Record<string, number> {
  const result: Record<string, number> = {};
  let fixedTotal = 0;
  let flexCols: ResolvedColumn<T>[] = [];

  for (const col of columns) {
    const override = overrides[col.id];
    if (override != null) {
      result[col.id] = Math.max(col.minWidth, Math.round(override));
    } else if (col.width != null) {
      result[col.id] = Math.max(col.minWidth, col.width);
    } else if ((col.flex ?? 0) > 0) {
      flexCols.push(col);
      continue;
    } else {
      result[col.id] = col.minWidth;
    }
    fixedTotal += result[col.id]!;
  }

  let available = Math.max(0, Math.floor(containerInnerWidth - reservedWidth - fixedTotal));

  // Clamp flex columns whose proportional share is under minWidth, then retry.
  for (;;) {
    const flexTotal = flexCols.reduce((sum, col) => sum + col.flex!, 0);
    const clamped = flexCols.filter((col) => (available * col.flex!) / flexTotal < col.minWidth);
    if (!clamped.length) {
      break;
    }
    for (const col of clamped) {
      result[col.id] = col.minWidth;
      available = Math.max(0, available - col.minWidth);
    }
    flexCols = flexCols.filter((col) => !clamped.includes(col));
  }

  const flexTotal = flexCols.reduce((sum, col) => sum + col.flex!, 0);
  let used = 0;
  flexCols.forEach((col, index) => {
    const share =
      index === flexCols.length - 1
        ? available - used
        : Math.floor((available * col.flex!) / flexTotal);
    result[col.id] = share;
    used += share;
  });

  return result;
}

/**
 * Keep prior order for surviving column ids; append new ids; drop removed ones.
 */
export function reconcileColumnOrder(
  currentOrder: readonly string[],
  columnIds: readonly string[],
): string[] {
  const idSet = new Set(columnIds);
  const kept = currentOrder.filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  const appended = columnIds.filter((id) => !keptSet.has(id));
  return [...kept, ...appended];
}

export function reconcileHiddenColumnIds(
  currentHidden: readonly string[],
  columnIds: readonly string[],
  newlyHiddenIds: readonly string[] = [],
): string[] {
  const idSet = new Set(columnIds);
  const kept = currentHidden.filter((id) => idSet.has(id));
  const keptSet = new Set(kept);
  for (const id of newlyHiddenIds) {
    if (idSet.has(id) && !keptSet.has(id)) {
      kept.push(id);
      keptSet.add(id);
    }
  }
  return kept;
}

/** Explicit pin per column. `null` = unpinned. */
export type ColumnPinSide = ColumnPin | null;

/**
 * Single source of truth for column order + pinning.
 * Init from col defs once via {@link reconcileColumnLayout}; runtime changes
 * go through {@link moveColumn} / {@link setColumnPin} only.
 */
export interface ColumnLayout {
  order: string[];
  pin: Record<string, ColumnPinSide>;
}

export function emptyColumnLayout(): ColumnLayout {
  return { order: [], pin: {} };
}

function defPin(pinned: ColumnPin | undefined): ColumnPinSide {
  return pinned === 'left' || pinned === 'right' ? pinned : null;
}

/** Seed pin map from column definitions. */
export function pinsFromColumnDefs(
  columns: readonly { id: string; pinned?: ColumnPin }[],
): Record<string, ColumnPinSide> {
  const pin: Record<string, ColumnPinSide> = {};
  for (const col of columns) {
    pin[col.id] = defPin(col.pinned);
  }
  return pin;
}

/**
 * Reconcile layout when column defs change:
 * - keep order for surviving ids, append new ones
 * - keep existing pin for known ids; new ids take col-def default
 */
export function reconcileColumnLayout(
  layout: ColumnLayout,
  columns: readonly { id: string; pinned?: ColumnPin }[],
): ColumnLayout {
  const ids = columns.map((c) => c.id);
  const order = reconcileColumnOrder(layout.order.length ? layout.order : ids, ids);
  const defaults = pinsFromColumnDefs(columns);
  const pin: Record<string, ColumnPinSide> = {};
  for (const id of ids) {
    pin[id] = Object.prototype.hasOwnProperty.call(layout.pin, id)
      ? (layout.pin[id] ?? null)
      : (defaults[id] ?? null);
  }
  return { order, pin };
}

/** Left → center → right, stable within each section. */
export function partitionColumnsByPin<T>(
  columns: readonly ResolvedColumn<T>[],
): ResolvedColumn<T>[] {
  const left: ResolvedColumn<T>[] = [];
  const center: ResolvedColumn<T>[] = [];
  const right: ResolvedColumn<T>[] = [];
  for (const col of columns) {
    if (col.pinned === 'left') {
      left.push(col);
    } else if (col.pinned === 'right') {
      right.push(col);
    } else {
      center.push(col);
    }
  }
  return [...left, ...center, ...right];
}

/** Apply layout order + explicit pins, then partition for display. */
export function materializeColumnLayout<T>(
  columns: readonly ResolvedColumn<T>[],
  layout: ColumnLayout,
): ResolvedColumn<T>[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const ordered: ResolvedColumn<T>[] = [];
  for (const id of layout.order) {
    const col = byId.get(id);
    if (!col) {
      continue;
    }
    const p = layout.pin[id] ?? null;
    ordered.push({ ...col, pinned: p ?? undefined });
    byId.delete(id);
  }
  for (const col of columns) {
    if (!byId.has(col.id)) {
      continue;
    }
    const p = layout.pin[col.id] ?? null;
    ordered.push({ ...col, pinned: p ?? undefined });
  }
  return partitionColumnsByPin(ordered);
}

/**
 * Drag column onto another: adopt target pin side, reorder next to it.
 * Same-pin moves can optionally stay within a column group.
 */
export function moveColumn(
  layout: ColumnLayout,
  fromId: string,
  toId: string,
  options?: {
    constrainSameGroup?: (a: string, b: string) => boolean;
  },
): ColumnLayout | null {
  if (fromId === toId) {
    return null;
  }
  const fromOrder = layout.order.indexOf(fromId);
  const toOrder = layout.order.indexOf(toId);
  if (fromOrder < 0 || toOrder < 0) {
    return null;
  }

  const fromPin = layout.pin[fromId] ?? null;
  const toPin = layout.pin[toId] ?? null;
  const pinChanges = fromPin !== toPin;

  if (!pinChanges && options?.constrainSameGroup && !options.constrainSameGroup(fromId, toId)) {
    return null;
  }

  return {
    order: moveItem([...layout.order], fromOrder, toOrder),
    pin: { ...layout.pin, [fromId]: toPin },
  };
}

/** Pin / unpin and move the column to the matching edge of `order`. */
export function setColumnPin(
  layout: ColumnLayout,
  columnId: string,
  pinned: ColumnPinSide,
): ColumnLayout {
  const pin = { ...layout.pin, [columnId]: pinned };
  const without = layout.order.filter((id) => id !== columnId);
  const order =
    pinned === 'left'
      ? [columnId, ...without]
      : pinned === 'right'
        ? [...without, columnId]
        : layout.order.includes(columnId)
          ? [...layout.order]
          : [...without, columnId];
  return { order, pin };
}
