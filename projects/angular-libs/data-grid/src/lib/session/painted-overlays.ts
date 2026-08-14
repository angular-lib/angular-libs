/**
 * Overlay paint: capability overlays + cell-range ring/handle layouts.
 * Owned by session (F3); plugins must not query the range layer for geometry.
 */

import { computed, type Signal } from '@angular/core';
import type { CellRange } from '../components/data-grid/data-grid.types';
import type { OverlayLayout } from '../plugins/capabilities';
import type { GridKernel } from '../kernel/grid-kernel';
import { computeCellRangeOverlayLayouts } from '../utils/cell-range-overlay';
import type { DisplayRow } from '../utils/row-display';
import type { ResolvedColumn } from '../components/data-grid/data-grid.types';

export interface PaintedOverlay {
  id: string;
  kind: string;
  className: string;
  layout: { left: number; top: number; width: number; height: number };
  testId: string | null;
}

export function createPaintedOverlays<T>(opts: {
  kernel: () => GridKernel<T>;
  getCellRange: () => CellRange | null;
  visibleColumns: () => readonly ResolvedColumn<T>[];
  displayRows: () => readonly DisplayRow<T>[];
  getCellElement: (rowId: string | number, columnId: string) => HTMLElement | null;
  getScrollRoot: () => HTMLElement | null;
  hostElement: () => HTMLElement;
  showFillHandle?: () => boolean;
}): Signal<PaintedOverlay[]> {
  return computed(() => {
    const epoch = opts.kernel().capabilities.overlayPaintEpoch();
    const contributions = opts.kernel().capabilities.overlays();
    void epoch;
    const painted: PaintedOverlay[] = [];

    const pushPainted = (
      id: string,
      kind: string,
      layout: OverlayLayout,
      className?: string | null,
    ): void => {
      const kindClass =
        kind === 'range-ring'
          ? 'al-dg-range-ring'
          : kind === 'fill-handle'
            ? 'al-dg-fill-handle'
            : `al-dg-overlay--${kind}`;
      const classes = ['al-dg-overlay', kindClass, className].filter(Boolean).join(' ');
      painted.push({
        id,
        kind,
        className: classes,
        layout,
        testId:
          kind === 'range-ring'
            ? 'al-dg-range-ring'
            : kind === 'fill-handle'
              ? 'al-dg-fill-handle'
              : null,
      });
    };

    for (const contribution of contributions) {
      const layout = contribution.layout();
      if (!layout) {
        continue;
      }
      const rawClass =
        typeof contribution.className === 'function'
          ? contribution.className()
          : (contribution.className ?? null);
      pushPainted(contribution.id, contribution.kind, layout, rawClass);
    }

    const rangeLayouts = computeCellRangeOverlayLayouts({
      range: opts.getCellRange(),
      visibleColumnIds: opts.visibleColumns().map((c) => c.id),
      displayRows: opts.displayRows(),
      getCellElement: opts.getCellElement,
      getScrollRoot: opts.getScrollRoot,
      hostElement: opts.hostElement(),
      showFillHandle: opts.showFillHandle?.() ?? true,
    });
    if (rangeLayouts?.ring) {
      pushPainted('cell-range-ring', 'range-ring', rangeLayouts.ring);
    }
    if (rangeLayouts?.handle) {
      pushPainted('cell-range-fill-handle', 'fill-handle', rangeLayouts.handle);
    }

    return painted;
  });
}
