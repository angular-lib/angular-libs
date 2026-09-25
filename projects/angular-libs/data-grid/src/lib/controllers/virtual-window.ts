/**
 * Virtual window math — extracted so the host stays a thin binder.
 */

export interface VirtualWindow {
  start: number;
  end: number;
  offsetY: number;
  bottomPad: number;
  totalHeight: number;
}

export interface VirtualWindowInput {
  rowCount: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
  enabled: boolean;
  /**
   * Per-row heights (same length as `rowCount`). When set, overrides uniform
   * `rowHeight` for offset / window math (master-detail, full-width rows).
   */
  rowHeights?: readonly number[];
}

export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const { rowCount, rowHeight, scrollTop, viewportHeight, overscan, enabled } = input;
  const heights = input.rowHeights;

  if (heights && heights.length === rowCount && rowCount > 0) {
    return computeVariableVirtualWindow({
      heights,
      scrollTop,
      viewportHeight,
      overscan,
      enabled,
    });
  }

  const totalHeight = rowCount * rowHeight;
  if (!enabled) {
    return { start: 0, end: rowCount, offsetY: 0, bottomPad: 0, totalHeight };
  }
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(rowCount, start + visible);
  const offsetY = start * rowHeight;
  const renderedHeight = Math.max(0, end - start) * rowHeight;
  const bottomPad = Math.max(0, totalHeight - offsetY - renderedHeight);
  return { start, end, offsetY, bottomPad, totalHeight };
}

interface VariableVirtualWindowInput {
  heights: readonly number[];
  scrollTop: number;
  viewportHeight: number;
  overscan: number;
  enabled: boolean;
}

function computeVariableVirtualWindow(input: VariableVirtualWindowInput): VirtualWindow {
  const { heights, scrollTop, viewportHeight, overscan, enabled } = input;
  const rowCount = heights.length;
  const offsets = cumulativeOffsets(heights);
  const totalHeight = offsets[rowCount] ?? 0;

  if (!enabled) {
    return { start: 0, end: rowCount, offsetY: 0, bottomPad: 0, totalHeight };
  }

  const start = Math.max(0, findRowAtOffset(offsets, scrollTop) - overscan);
  let end = start;
  const targetBottom = scrollTop + viewportHeight;
  while (end < rowCount && (offsets[end] ?? 0) < targetBottom) {
    end++;
  }
  end = Math.min(rowCount, end + overscan);

  const offsetY = offsets[start] ?? 0;
  const renderedBottom = offsets[end] ?? totalHeight;
  const bottomPad = Math.max(0, totalHeight - renderedBottom);
  return { start, end, offsetY, bottomPad, totalHeight };
}

/** Prefix sums: offsets[i] = sum(heights[0..i)). Length = heights.length + 1. */
export function cumulativeOffsets(heights: readonly number[]): number[] {
  const offsets = new Array<number>(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i++) {
    offsets[i + 1] = (offsets[i] ?? 0) + Math.max(0, heights[i] ?? 0);
  }
  return offsets;
}

/** Largest index i where offsets[i] <= y (clamped). */
export function findRowAtOffset(offsets: readonly number[], y: number): number {
  const rowCount = Math.max(0, offsets.length - 1);
  if (rowCount === 0) {
    return 0;
  }
  let lo = 0;
  let hi = rowCount;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((offsets[mid] ?? 0) <= y) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return Math.min(lo, rowCount - 1);
}

/** Top pixel of `rowIndex` given per-row heights (or uniform fallback). */
export function rowOffsetY(
  rowIndex: number,
  rowHeight: number,
  rowHeights?: readonly number[] | null,
): number {
  if (rowHeights && rowHeights.length > 0) {
    let y = 0;
    const n = Math.min(rowIndex, rowHeights.length);
    for (let i = 0; i < n; i++) {
      y += Math.max(0, rowHeights[i] ?? rowHeight);
    }
    return y;
  }
  return rowIndex * rowHeight;
}

export function rowHeightAt(
  rowIndex: number,
  rowHeight: number,
  rowHeights?: readonly number[] | null,
): number {
  if (rowHeights && rowIndex >= 0 && rowIndex < rowHeights.length) {
    return Math.max(0, rowHeights[rowIndex] ?? rowHeight);
  }
  return rowHeight;
}

/**
 * True when `el` intersects the scrollport *below* a sticky header (1px counts).
 * @deprecated Focus scrolling uses {@link scrollOffsetToReveal} (full visibility).
 */
export function isRowInScrollport(
  el: HTMLElement,
  scroll: HTMLElement,
  stickyHeader?: HTMLElement | null,
): boolean {
  const er = el.getBoundingClientRect();
  const sr = scroll.getBoundingClientRect();
  const topBound = stickyHeader?.getBoundingClientRect().bottom ?? sr.top;
  return (
    er.bottom > topBound + 1 &&
    er.top < sr.bottom &&
    er.right > sr.left &&
    er.left < sr.right
  );
}

export interface RevealAxisInput {
  /** Current scroll offset on this axis (`scrollTop` / `scrollLeft`). */
  scroll: number;
  /** Scrollport size on this axis (`clientHeight` / `clientWidth`). */
  viewport: number;
  /** Item start in scroll-content coordinates. */
  itemStart: number;
  itemSize: number;
  /** Sticky band covering the start edge (header block / pinned-left columns). */
  startInset?: number;
  /** Sticky band covering the end edge (aggregate footer / pinned-right columns). */
  endInset?: number;
}

/**
 * Scroll offset that makes `[itemStart, itemStart + itemSize)` fully visible in
 * the band between the sticky insets, or `null` when it already is.
 * Items larger than the band align to its start edge.
 */
export function scrollOffsetToReveal(input: RevealAxisInput): number | null {
  const startInset = Math.max(0, input.startInset ?? 0);
  const endInset = Math.max(0, input.endInset ?? 0);
  const size = Math.max(0, input.itemSize);
  const bandStart = input.scroll + startInset;
  const bandEnd = input.scroll + input.viewport - endInset;
  const itemEnd = input.itemStart + size;
  if (input.itemStart >= bandStart && itemEnd <= bandEnd) {
    return null;
  }
  const band = Math.max(0, input.viewport - startInset - endInset);
  const next =
    input.itemStart < bandStart || size > band
      ? input.itemStart - startInset
      : itemEnd - (input.viewport - endInset);
  const clamped = Math.max(0, Math.round(next));
  return clamped === Math.round(input.scroll) ? null : clamped;
}

/**
 * PageUp / PageDown step: how many rows fully fit in `bodyHeight` walking from
 * `start` (forward for `direction = 1`, backward for `-1`). Always ≥ 1.
 */
export function rowsFittingHeight(
  start: number,
  bodyHeight: number,
  rowHeight: number,
  rowHeights?: readonly number[] | null,
  direction: 1 | -1 = 1,
): number {
  const fallback = Math.max(1, rowHeight);
  const count = rowHeights?.length ?? 0;
  if (!rowHeights || count === 0) {
    return Math.max(1, Math.floor(bodyHeight / fallback));
  }
  let used = 0;
  let n = 0;
  for (let i = Math.min(Math.max(0, start), count - 1); i >= 0 && i < count; i += direction) {
    used += Math.max(0, rowHeights[i] ?? fallback);
    if (used > bodyHeight) {
      break;
    }
    n++;
  }
  return Math.max(1, n);
}
