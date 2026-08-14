/**
 * Binder-owned cell-range overlay geometry (relative to the range layer).
 * Plugins must not query `.al-data-grid__range-layer` for paint.
 *
 * Uses **visible** cells in the range so a virtualized window still paints a
 * ring when a corner has scrolled out of the DOM (AG/Excel clip the selection
 * to the viewport rather than dropping it).
 */

import type { CellRange } from '../components/data-grid/data-grid.types';
import type { OverlayLayout } from '../plugins/capabilities';
import { normalizeCellRange } from './cell-range';
import { isDataDisplayRow, type DisplayRow } from './row-display';

export function computeCellRangeOverlayLayouts<T>(opts: {
  range: CellRange | null;
  visibleColumnIds: readonly string[];
  displayRows: readonly DisplayRow<T>[];
  getCellElement: (rowId: string | number, columnId: string) => HTMLElement | null;
  getScrollRoot: () => HTMLElement | null;
  hostElement: HTMLElement;
  showFillHandle?: boolean;
}): { ring: OverlayLayout; handle: OverlayLayout | null } | null {
  const { range, visibleColumnIds, displayRows } = opts;
  if (!range) {
    return null;
  }
  const norm = normalizeCellRange(range, visibleColumnIds);
  if (!norm) {
    return null;
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let found = false;
  let brRect: DOMRect | null = null;
  const lastCol = norm.columnIds[norm.columnIds.length - 1]!;

  for (let ri = norm.rowStart; ri <= norm.rowEnd; ri++) {
    const item = displayRows[ri];
    if (!item || !isDataDisplayRow(item)) {
      continue;
    }
    for (const columnId of norm.columnIds) {
      const el = opts.getCellElement(item.rowId, columnId);
      if (!el) {
        continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) {
        continue;
      }
      found = true;
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      if (ri === norm.rowEnd && columnId === lastCol) {
        brRect = r;
      }
    }
  }
  if (!found) {
    return null;
  }

  const host =
    (opts.hostElement.querySelector('.al-data-grid__range-layer') as HTMLElement | null) ??
    opts.hostElement;
  const scroll = opts.getScrollRoot();
  const clip = scroll?.getBoundingClientRect();
  const origin = host.getBoundingClientRect();

  if (clip) {
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }

  const width = right - left;
  const height = bottom - top;
  if (width < 2 || height < 2) {
    return null;
  }

  const ring: OverlayLayout = {
    left: left - origin.left,
    top: top - origin.top,
    width,
    height,
  };

  if (opts.showFillHandle === false || !brRect) {
    return { ring, handle: null };
  }

  const handleLeft = brRect.right - 10;
  const handleTop = brRect.bottom - 10;
  const outsideClip =
    !!clip &&
    (handleLeft + 11 > clip.right ||
      handleTop + 11 > clip.bottom ||
      handleLeft < clip.left ||
      handleTop < clip.top);
  if (outsideClip) {
    return { ring, handle: null };
  }

  return {
    ring,
    handle: {
      left: handleLeft - origin.left,
      top: handleTop - origin.top,
      width: 11,
      height: 11,
    },
  };
}
