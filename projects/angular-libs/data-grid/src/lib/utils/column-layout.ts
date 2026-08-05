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
  /** CSS `grid-template-columns` value (chrome + data columns). */
  tracks: string;
  /**
   * Known pixel width per data column id.
   * `null` = flex/`fr` track (not a fixed px; pin offsets should materialize first).
   */
  widthsPx: Record<string, number | null>;
}

function trackForColumn<T>(
  col: ResolvedColumn<T>,
  overrides: Record<string, number>,
): { track: string; widthPx: number | null } {
  const override = overrides[col.id];
  if (override != null) {
    const px = Math.max(col.minWidth, override);
    return { track: `${px}px`, widthPx: px };
  }
  if (col.width != null) {
    const px = Math.max(col.minWidth, col.width);
    return { track: `${px}px`, widthPx: px };
  }
  const flex = col.flex ?? 0;
  if (flex > 0) {
    return {
      track: `minmax(${col.minWidth}px, ${flex}fr)`,
      widthPx: null,
    };
  }
  return { track: `${col.minWidth}px`, widthPx: col.minWidth };
}

/**
 * Build CSS Grid track list for chrome + visible columns.
 * Flex columns become `minmax(min, Nfr)` — no viewport measurement.
 */
export function resolveColumnTracks<T>(
  columns: readonly ResolvedColumn<T>[],
  overrides: Record<string, number> = {},
  chrome: ColumnTracksChrome = {},
): ColumnTrackLayout {
  const parts: string[] = [];
  if (chrome.drag) {
    parts.push(`${CHROME_TRACK.drag}px`);
  }
  if (chrome.select) {
    parts.push(`${CHROME_TRACK.select}px`);
  }

  const widthsPx: Record<string, number | null> = {};
  for (const col of columns) {
    const { track, widthPx } = trackForColumn(col, overrides);
    parts.push(track);
    widthsPx[col.id] = widthPx;
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
 * Prefer {@link resolveColumnTracks} for layout; keep this for tests / legacy px math.
 */
export function resolveColumnWidths<T>(
  columns: readonly ResolvedColumn<T>[],
  overrides: Record<string, number>,
  containerInnerWidth: number,
  reservedWidth = 0,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!columns.length) {
    return result;
  }

  let fixedTotal = 0;
  let flexTotal = 0;
  const flexCols: ResolvedColumn<T>[] = [];

  for (const col of columns) {
    const override = overrides[col.id];
    if (override != null) {
      result[col.id] = Math.max(col.minWidth, override);
      fixedTotal += result[col.id]!;
      continue;
    }
    if (col.width != null) {
      result[col.id] = Math.max(col.minWidth, col.width);
      fixedTotal += result[col.id]!;
      continue;
    }
    const flex = col.flex ?? 0;
    if (flex > 0) {
      flexCols.push(col);
      flexTotal += flex;
    } else {
      result[col.id] = col.minWidth;
      fixedTotal += col.minWidth;
    }
  }

  const available = Math.max(0, containerInnerWidth - reservedWidth - fixedTotal);

  if (!flexCols.length) {
    return result;
  }

  if (flexTotal <= 0 || available <= 0) {
    for (const col of flexCols) {
      result[col.id] = col.minWidth;
    }
    return result;
  }

  let used = 0;
  flexCols.forEach((col, index) => {
    const flex = col.flex ?? 1;
    const share =
      index === flexCols.length - 1
        ? Math.max(col.minWidth, available - used)
        : Math.max(col.minWidth, Math.floor((available * flex) / flexTotal));
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
