/**
 * Binder-owned cell-range overlay geometry (relative to the range layer).
 * Plugins must not query `.al-data-grid__range-layer` for paint.
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
}): { ring: OverlayLayout; handle: OverlayLayout | null } | null {
  const { range, visibleColumnIds, displayRows } = opts;
  if (!range) {
    return null;
  }
  const norm = normalizeCellRange(range, visibleColumnIds);
  if (!norm) {
    return null;
  }
  const tlItem = displayRows[norm.rowStart];
  const brItem = displayRows[norm.rowEnd];
  if (!tlItem || !isDataDisplayRow(tlItem) || !brItem || !isDataDisplayRow(brItem)) {
    return null;
  }
  const tl = opts.getCellElement(tlItem.rowId, norm.columnIds[0]!);
  const br = opts.getCellElement(brItem.rowId, norm.columnIds[norm.columnIds.length - 1]!);
  if (!tl || !br) {
    return null;
  }

  const host =
    (opts.hostElement.querySelector('.al-data-grid__range-layer') as HTMLElement | null) ??
    opts.hostElement;
  const scroll = opts.getScrollRoot();
  const clip = scroll?.getBoundingClientRect();
  const origin = host.getBoundingClientRect();
  const a = tl.getBoundingClientRect();
  const b = br.getBoundingClientRect();
  let left = Math.min(a.left, b.left);
  let top = Math.min(a.top, b.top);
  let right = Math.max(a.right, b.right);
  let bottom = Math.max(a.bottom, b.bottom);

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

  const handleLeft = right - 10;
  const handleTop = bottom - 10;
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
