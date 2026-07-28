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
}

export function computeVirtualWindow(input: VirtualWindowInput): VirtualWindow {
  const { rowCount, rowHeight, scrollTop, viewportHeight, overscan, enabled } = input;
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
