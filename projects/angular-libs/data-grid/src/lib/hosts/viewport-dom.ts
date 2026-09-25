/**
 * Viewport DOM geometry + focus recovery for ViewportHost (keeps the host under its LOC cap).
 * All lookups are scoped to this grid's own scroller so nested detail grids never match.
 */

import { afterNextRender, type Injector } from '@angular/core';
import { rowHeightAt, rowOffsetY, scrollOffsetToReveal } from '../controllers/virtual-window';
import type { DisplayRow } from '../utils/row-display';

/** Sticky bands inside the scroller that cover body cells. */
export interface ScrollInsets {
  /** Header block (`.al-data-grid__thead`) height. */
  top: number;
  /** Sticky aggregate footer height. */
  bottom: number;
  /** Selection / drag chrome + pinned-left columns. */
  left: number;
  /** Row-edit chrome + pinned-right columns. */
  right: number;
}

const LEFT_STICKY = ['al-data-grid__th--pinned-left', 'al-data-grid__th--select', 'al-data-grid__th--drag'];
const RIGHT_STICKY = ['al-data-grid__th--pinned-right', 'al-data-grid__th--row-edit'];

function childWithClass(parent: Element | null, cls: string): HTMLElement | null {
  if (!parent) {
    return null;
  }
  for (const child of Array.from(parent.children)) {
    if (child.classList.contains(cls)) {
      return child as HTMLElement;
    }
  }
  return null;
}

function hasAnyClass(el: Element, classes: readonly string[]): boolean {
  return classes.some((cls) => el.classList.contains(cls));
}

/** Own `thead` / `tbody` / `tfoot` (direct children of this scroller's table). */
export function gridSections(scroll: HTMLElement): {
  thead: HTMLElement | null;
  tbody: HTMLElement | null;
  tfoot: HTMLElement | null;
} {
  const table = childWithClass(scroll, 'al-data-grid__table');
  return {
    thead: childWithClass(table, 'al-data-grid__thead'),
    tbody: childWithClass(table, 'al-data-grid__tbody'),
    tfoot: childWithClass(table, 'al-data-grid__tfoot'),
  };
}

function leafHeaderRow(thead: HTMLElement | null): HTMLElement | null {
  for (const child of Array.from(thead?.children ?? [])) {
    if (
      child.classList.contains('al-data-grid__header-row') &&
      !child.classList.contains('al-data-grid__header-row--group')
    ) {
      return child as HTMLElement;
    }
  }
  return null;
}

export function measureScrollInsets(scroll: HTMLElement): ScrollInsets {
  const { thead, tfoot } = gridSections(scroll);
  let left = 0;
  let right = 0;
  for (const cell of Array.from(leafHeaderRow(thead)?.children ?? [])) {
    if (hasAnyClass(cell, LEFT_STICKY)) {
      left += cell.getBoundingClientRect().width;
    } else if (hasAnyClass(cell, RIGHT_STICKY)) {
      right += cell.getBoundingClientRect().width;
    }
  }
  return {
    top: thead?.getBoundingClientRect().height ?? 0,
    bottom: tfoot?.getBoundingClientRect().height ?? 0,
    left,
    right,
  };
}

/** Box of `el` in scroll-content coordinates (independent of current scroll). */
export function contentBox(
  el: HTMLElement,
  scroll: HTMLElement,
): { top: number; left: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  const s = scroll.getBoundingClientRect();
  return {
    top: r.top - s.top - scroll.clientTop + scroll.scrollTop,
    left: r.left - s.left - scroll.clientLeft + scroll.scrollLeft,
    width: r.width,
    height: r.height,
  };
}

/** First match whose nearest scroller is `scroll` (skips nested detail grids). */
export function ownElement(scroll: HTMLElement, selector: string): HTMLElement | null {
  for (const el of Array.from(scroll.querySelectorAll<HTMLElement>(selector))) {
    if (el.closest('.al-data-grid__scroll') === scroll) {
      return el;
    }
  }
  return null;
}

/** Rendered element for a display row inside this grid's own body. */
export function displayRowElementOf<T>(scroll: HTMLElement, item: DisplayRow<T>): HTMLElement | null {
  const tbody = gridSections(scroll).tbody ?? scroll;
  if (item.kind === 'data') {
    return ownElement(tbody, `[data-testid="al-dg-row-${cssEscape(String(item.rowId))}"]`);
  }
  if (item.kind === 'group') {
    return ownElement(tbody, `[data-testid="al-dg-group-${item.id}"]`);
  }
  return ownElement(tbody, `[data-testid="al-dg-plugin-row-${item.id}"]`);
}

export interface RevealCellInput {
  scroll: HTMLElement;
  rowIndex: number;
  /** Rendered row element, when present (exact geometry). */
  rowEl: HTMLElement | null;
  columnId: string | null;
  rowHeight: number;
  rowHeights: readonly number[];
  /** Fallbacks when the scroller reports 0 (not laid out yet). */
  viewportHeight: number;
  viewportWidth: number;
}

/**
 * Target scroll offsets that fully reveal a body cell below the sticky header
 * block and between the pinned column bands. `null` per axis = no scroll needed.
 * Unrendered (virtual) rows use the display-row height model.
 */
export function revealCellOffsets(input: RevealCellInput): {
  top: number | null;
  left: number | null;
} {
  const { scroll } = input;
  const insets = measureScrollInsets(scroll);
  const { thead, tbody } = gridSections(scroll);
  let rowTop: number;
  let rowSize: number;
  if (input.rowEl) {
    const box = contentBox(input.rowEl, scroll);
    rowTop = box.top;
    rowSize = box.height;
  } else {
    const bodyTop = tbody ? contentBox(tbody, scroll).top : insets.top;
    rowTop = bodyTop + rowOffsetY(input.rowIndex, input.rowHeight, input.rowHeights);
    rowSize = rowHeightAt(input.rowIndex, input.rowHeight, input.rowHeights);
  }
  const top = scrollOffsetToReveal({
    scroll: scroll.scrollTop,
    viewport: scroll.clientHeight || input.viewportHeight,
    itemStart: rowTop,
    itemSize: rowSize,
    startInset: insets.top,
    endInset: insets.bottom,
  });

  let left: number | null = null;
  const th = input.columnId
    ? (thead?.querySelector(`[data-testid="al-dg-col-${cssEscape(input.columnId)}"]`) as HTMLElement | null)
    : null;
  // Pinned cells are sticky — never hidden horizontally.
  if (th && !hasAnyClass(th, [...LEFT_STICKY, ...RIGHT_STICKY])) {
    const box = contentBox(th, scroll);
    left = scrollOffsetToReveal({
      scroll: scroll.scrollLeft,
      viewport: scroll.clientWidth || input.viewportWidth,
      itemStart: box.left,
      itemSize: box.width,
      startInset: insets.left,
      endInset: insets.right,
    });
  }
  return { top, left };
}

const EDITOR_IN_CELL =
  '.al-data-grid__edit-input, .al-data-grid__edit-check, .al-data-grid__editor-host input, .al-data-grid__editor-host textarea, .al-data-grid__editor-host select';

/**
 * After a scroll re-render: keep DOM focus attached to the grid when virtualization
 * recycles the focused row, and restore it when the row renders again.
 *
 * - focused element gone (activeElement = body / host) → park on the grid frame
 * - focused cell rendered again while parked (or focus was lost) → focus it, no scroll
 *
 * Returns the new parked state.
 */
export function reconcileScrolledFocus(options: {
  host: HTMLElement;
  frame: HTMLElement | null;
  /** Focused model cell element (null when not rendered). */
  cellEl: HTMLElement | null;
  /** DOM focus was inside this grid (or parked) when the scroll happened. */
  hadFocus: boolean;
  parked: boolean;
  parkOnFrame: (frame: HTMLElement) => void;
}): boolean {
  if (typeof document === 'undefined') {
    return options.parked;
  }
  const active = document.activeElement;
  const lost = !active || active === document.body || active === options.host;
  const onFrame = !!options.frame && active === options.frame;
  if (options.cellEl) {
    if ((lost && options.hadFocus) || (onFrame && options.parked)) {
      const editor = options.cellEl.querySelector(EDITOR_IN_CELL) as HTMLElement | null;
      (editor ?? options.cellEl).focus({ preventScroll: true });
      return false;
    }
    return options.parked && onFrame;
  }
  if (lost && options.hadFocus && options.frame) {
    options.parkOnFrame(options.frame);
    return true;
  }
  return options.parked && onFrame;
}

/**
 * Owns the post-scroll focus reconcile for one grid: snapshot whether DOM focus was
 * in the grid at scroll time, then {@link reconcileScrolledFocus} after the re-render.
 */
export class ScrollFocusKeeper {
  /** True while focus is moved to the frame programmatically (skip focusin restore). */
  parking = false;
  private parked = false;
  private pending = false;

  constructor(
    private readonly o: {
      host(): HTMLElement;
      injector(): Injector;
      enabled(): boolean;
      focusedCellElement(): HTMLElement | null;
    },
  ) {}

  onScroll(): void {
    if (this.pending || !this.o.enabled() || typeof document === 'undefined') {
      return;
    }
    const host = this.o.host();
    const active = document.activeElement;
    const hadFocus = this.parked || (!!active && active !== document.body && host.contains(active));
    if (!hadFocus) {
      return;
    }
    this.pending = true;
    afterNextRender(
      () => {
        this.pending = false;
        this.parked = reconcileScrolledFocus({
          host,
          frame: host.querySelector('.al-data-grid__frame') as HTMLElement | null,
          cellEl: this.o.focusedCellElement(),
          hadFocus,
          parked: this.parked,
          parkOnFrame: (frame) => {
            this.parking = true;
            try {
              frame.focus({ preventScroll: true });
            } finally {
              this.parking = false;
            }
          },
        });
      },
      { injector: this.o.injector() },
    );
  }
}

/**
 * Page index after a paging-source change: reset to 0 when the row set changes
 * meaning (filters / quick filter / external filter / page size); otherwise keep
 * the page (data edits, transactions, sorts) clamped to the last page.
 */
export function nextPageIndex(
  src: PageIndexSource,
  previous: { source: PageIndexSource; value: number } | undefined,
): number {
  const prev = previous?.source;
  if (
    !previous ||
    !prev ||
    prev.filters !== src.filters ||
    prev.quickFilter !== src.quickFilter ||
    prev.pageSize !== src.pageSize ||
    prev.externalFilter !== src.externalFilter
  ) {
    return 0;
  }
  return Math.max(0, Math.min(previous.value, src.totalPages - 1));
}

export interface PageIndexSource {
  filters: unknown;
  quickFilter: string;
  pageSize: number;
  externalFilter: unknown;
  totalPages: number;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
