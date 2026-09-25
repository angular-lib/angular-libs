import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { rowDragPlugin } from '@angular-libs/data-grid/plugins';
import { infiniteScrollPlugin } from '@angular-libs/data-grid/plugins';
import { DataGrid } from '../components/data-grid/data-grid';
import type { ColumnDef, DataGridQuery } from '../components/data-grid/data-grid.types';
import { createGrid } from '../create-grid';
import { rowsFittingHeight, scrollOffsetToReveal } from '../controllers/virtual-window';
import { buildRowReorderEvent } from '../utils/row-interactions';
import { ariaBodyRowIndexOf } from './binder-template.helpers';
import { nextPageIndex, revealCellOffsets, type PageIndexSource } from './viewport-dom';

interface Item {
  id: number;
  name: string;
  qty: number;
}

const items = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, qty: i }));

const columns: ColumnDef<Item>[] = [{ field: 'name' }, { field: 'qty', type: 'number' }];

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    bottom: top + height,
    right: left + width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function gridOf<T>(fixture: ComponentFixture<unknown>): DataGrid<T> {
  return fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<T>;
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await Promise.resolve();
  await fixture.whenStable();
  await Promise.resolve();
  await fixture.whenStable();
}

describe('scrollOffsetToReveal (V1)', () => {
  it('returns null when the item is fully inside the unobstructed band', () => {
    expect(
      scrollOffsetToReveal({ scroll: 0, viewport: 400, itemStart: 80, itemSize: 36, startInset: 80 }),
    ).toBeNull();
  });

  it('scrolls a row below the fold fully into view above the fold, not header-height short', () => {
    // clientHeight 400 includes an 80px sticky header; row 10 starts at 80 + 360.
    const next = scrollOffsetToReveal({
      scroll: 0,
      viewport: 400,
      itemStart: 440,
      itemSize: 36,
      startInset: 80,
    });
    expect(next).toBe(76);
    // Row bottom (476) sits exactly at the scrollport bottom (76 + 400).
    expect(440 + 36).toBe(next! + 400);
  });

  it('scrolls a row hidden under the sticky header down below it', () => {
    const next = scrollOffsetToReveal({
      scroll: 200,
      viewport: 400,
      itemStart: 260,
      itemSize: 36,
      startInset: 80,
    });
    expect(next).toBe(180);
  });

  it('treats a 1px sliver as not visible', () => {
    expect(
      scrollOffsetToReveal({ scroll: 0, viewport: 400, itemStart: 399, itemSize: 36 }),
    ).toBe(35);
  });

  it('respects pinned-left / pinned-right bands horizontally', () => {
    // Cell under the pinned-left band (150px) → align to its right edge.
    expect(
      scrollOffsetToReveal({ scroll: 300, viewport: 600, itemStart: 350, itemSize: 120, startInset: 150 }),
    ).toBe(200);
    // Cell under the pinned-right band (100px).
    expect(
      scrollOffsetToReveal({ scroll: 0, viewport: 600, itemStart: 420, itemSize: 120, endInset: 100 }),
    ).toBe(40);
  });

  it('aligns items larger than the band to its start', () => {
    expect(
      scrollOffsetToReveal({ scroll: 0, viewport: 200, itemStart: 500, itemSize: 400, startInset: 40 }),
    ).toBe(460);
  });
});

describe('rowsFittingHeight (PageUp/PageDown)', () => {
  it('counts whole uniform rows in the body height', () => {
    expect(rowsFittingHeight(0, 400 - 80, 36, [])).toBe(8);
    expect(rowsFittingHeight(0, 10, 36, [])).toBe(1);
  });

  it('walks variable display-row heights from the focused row', () => {
    const heights = [36, 200, 36, 36, 36];
    expect(rowsFittingHeight(0, 300, 36, heights)).toBe(3);
    expect(rowsFittingHeight(2, 300, 36, heights)).toBe(3);
    expect(rowsFittingHeight(4, 300, 36, heights, -1)).toBe(3);
  });
});

describe('revealCellOffsets (V1 DOM geometry)', () => {
  function buildScroller(opts: { scrollTop?: number; scrollLeft?: number }) {
    const scroll = document.createElement('div');
    scroll.className = 'al-data-grid__scroll';
    scroll.innerHTML = `
      <div class="al-data-grid__table">
        <div class="al-data-grid__thead">
          <div class="al-data-grid__header-row">
            <div class="al-data-grid__th al-data-grid__th--select"></div>
            <div class="al-data-grid__th al-data-grid__th--pinned-left" data-testid="al-dg-col-pin"></div>
            <div class="al-data-grid__th" data-testid="al-dg-col-far"></div>
          </div>
        </div>
        <div class="al-data-grid__tbody"></div>
      </div>`;
    document.body.appendChild(scroll);
    Object.defineProperty(scroll, 'clientHeight', { value: 400 });
    Object.defineProperty(scroll, 'clientWidth', { value: 600 });
    scroll.scrollTop = opts.scrollTop ?? 0;
    scroll.scrollLeft = opts.scrollLeft ?? 0;
    const q = (sel: string) => scroll.querySelector(sel) as HTMLElement;
    vi.spyOn(scroll, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 600, 400));
    // Sticky header block: 80px tall (group + leaf + filter rows collapse to one block).
    vi.spyOn(q('.al-data-grid__thead'), 'getBoundingClientRect').mockReturnValue(rect(0, 0, 1200, 80));
    vi.spyOn(q('.al-data-grid__th--select'), 'getBoundingClientRect').mockReturnValue(rect(0, 0, 40, 80));
    vi.spyOn(q('[data-testid="al-dg-col-pin"]'), 'getBoundingClientRect').mockReturnValue(rect(0, 40, 110, 80));
    const st = scroll.scrollTop;
    const sl = scroll.scrollLeft;
    // Body starts right below the header in content coordinates.
    vi.spyOn(q('.al-data-grid__tbody'), 'getBoundingClientRect').mockReturnValue(rect(80 - st, -sl, 1200, 36000));
    // Far column at content x = 700..850.
    vi.spyOn(q('[data-testid="al-dg-col-far"]'), 'getBoundingClientRect').mockReturnValue(rect(0, 700 - sl, 150, 80));
    return scroll;
  }

  afterEach(() => {
    document.querySelectorAll('.al-data-grid__scroll').forEach((el) => el.remove());
  });

  it('reveals an unrendered virtual row below the sticky header block', () => {
    const scroll = buildScroller({});
    const next = revealCellOffsets({
      scroll,
      rowIndex: 20,
      rowEl: null,
      columnId: null,
      rowHeight: 36,
      rowHeights: [],
      viewportHeight: 400,
      viewportWidth: 600,
    });
    // Row top = 80 + 720 = 800, bottom 836 → scrollTop 436 puts it at the bottom edge.
    expect(next.top).toBe(436);
    expect(next.left).toBeNull();
  });

  it('scrolls horizontally to an offscreen column and past the pinned-left band', () => {
    const scroll = buildScroller({});
    const right = revealCellOffsets({
      scroll,
      rowIndex: 0,
      rowEl: null,
      columnId: 'far',
      rowHeight: 36,
      rowHeights: [],
      viewportHeight: 400,
      viewportWidth: 600,
    });
    expect(right.left).toBe(850 - 600);

    const scrolled = buildScroller({ scrollLeft: 600 });
    const left = revealCellOffsets({
      scroll: scrolled,
      rowIndex: 0,
      rowEl: null,
      columnId: 'far',
      rowHeight: 36,
      rowHeights: [],
      viewportHeight: 400,
      viewportWidth: 600,
    });
    // Column starts at 700 but pinned band (40 + 110) covers [600, 750) → 700 - 150.
    expect(left.left).toBe(550);
  });

  it('never scrolls horizontally for pinned columns', () => {
    const scroll = buildScroller({ scrollLeft: 400 });
    const next = revealCellOffsets({
      scroll,
      rowIndex: 0,
      rowEl: null,
      columnId: 'pin',
      rowHeight: 36,
      rowHeights: [],
      viewportHeight: 400,
      viewportWidth: 600,
    });
    expect(next.left).toBeNull();
  });
});

describe('nextPageIndex (V3)', () => {
  const base: PageIndexSource = {
    filters: {},
    quickFilter: '',
    pageSize: 10,
    externalFilter: null,
    totalPages: 5,
  };

  it('keeps the page on data / sort changes and clamps to the last page', () => {
    expect(nextPageIndex({ ...base, totalPages: 6 }, { source: base, value: 3 })).toBe(3);
    expect(nextPageIndex({ ...base, totalPages: 2 }, { source: base, value: 3 })).toBe(1);
  });

  it('resets on filter / quick filter / external filter / page size changes', () => {
    expect(nextPageIndex({ ...base, filters: { a: 'x' } }, { source: base, value: 3 })).toBe(0);
    expect(nextPageIndex({ ...base, quickFilter: 'q' }, { source: base, value: 3 })).toBe(0);
    expect(nextPageIndex({ ...base, externalFilter: () => true }, { source: base, value: 3 })).toBe(0);
    expect(nextPageIndex({ ...base, pageSize: 20 }, { source: base, value: 3 })).toBe(0);
    expect(nextPageIndex(base, undefined)).toBe(0);
  });
});

describe('buildRowReorderEvent (V4)', () => {
  it('emits the full source order when the dragged list is filtered', () => {
    const source = items(5);
    const processed = [source[0]!, source[2]!, source[4]!];
    const event = buildRowReorderEvent(processed, 0, 2, (_row, index) => index, source);
    expect(event?.rows.map((r) => r.id)).toEqual([2, 3, 4, 5, 1]);
    expect(event?.rows).toHaveLength(5);
    // Ids come from source indices.
    expect(event).toMatchObject({ fromIndex: 0, toIndex: 2, fromId: 0, toId: 4 });
    expect(event?.rowIds).toEqual([0, 1, 2, 3, 4]);
  });

  it('moves up before the drop target in source order', () => {
    const source = items(4);
    const event = buildRowReorderEvent(source, 3, 1, (row) => row.id, source);
    expect(event?.rows.map((r) => r.id)).toEqual([1, 4, 2, 3]);
    expect(event).toMatchObject({ fromId: 4, toId: 2 });
  });
});

describe('ariaBodyRowIndexOf (V5)', () => {
  it('offsets body rows by the rows before the current page', () => {
    expect(ariaBodyRowIndexOf(1, 0)).toBe(2);
    expect(ariaBodyRowIndexOf(1, 0, 30)).toBe(32);
  });
});

describe('infiniteScrollPlugin', () => {
  it('ignores scroll events from nested detail-grid scrollers', () => {
    const host = document.createElement('div');
    host.innerHTML = `<div class="al-data-grid__scroll" id="own"><div class="al-data-grid__scroll" id="nested"></div></div>`;
    document.body.appendChild(host);
    const notifyNearEnd = vi.fn();
    let setup: ((el: HTMLElement) => () => void) | null = null;
    const plugin = infiniteScrollPlugin({ threshold: 10 });
    plugin.setup?.({
      api: { notifyNearEnd },
      capabilities: {
        registerInteraction: (i: { setup: (el: HTMLElement) => () => void }) => {
          setup = i.setup;
          return () => {};
        },
      },
    } as never);
    const cleanup = setup!(host);
    host.querySelector('#nested')!.dispatchEvent(new Event('scroll'));
    expect(notifyNearEnd).not.toHaveBeenCalled();
    host.querySelector('#own')!.dispatchEvent(new Event('scroll'));
    expect(notifyNearEnd).toHaveBeenCalledTimes(1);
    cleanup();
    host.remove();
  });
});

@Component({
  imports: [DataGrid],
  template: `<al-data-grid [controller]="grid" [data]="rows()" [externalFilter]="external()" (queryChange)="queries.push($event)" />`,
})
class PagedHost {
  readonly rows = signal<readonly Item[]>(items(50));
  readonly external = signal<((row: Item) => boolean) | null>(null);
  readonly queries: DataGridQuery[] = [];
  readonly grid = createGrid<Item>({
    columns,
    rowId: (row) => row.id,
    rows: this.rows,
    viewport: { pagination: true, pageSize: 10, virtual: false },
    chrome: { floatingFilters: false },
    plugins: [rowDragPlugin<Item>()],
  });
}

describe('ViewportHost pagination (V3/V4)', () => {
  let fixture: ComponentFixture<PagedHost>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(PagedHost);
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it('keeps the page on data edits and resets on quick filter', async () => {
    const vp = gridOf<Item>(fixture).viewportHost;
    vp.goToPage(3);
    await fixture.whenStable();
    expect(vp.pageIndex()).toBe(3);

    fixture.componentInstance.grid.applyTransaction({ update: [{ id: 35, name: 'Edited', qty: 0 }] });
    await fixture.whenStable();
    expect(vp.pageIndex()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Edited');

    fixture.componentInstance.grid.setRows(items(25));
    await fixture.whenStable();
    expect(vp.pageIndex()).toBe(2);

    fixture.componentInstance.grid.api()!.setQuickFilter('Item');
    await fixture.whenStable();
    expect(vp.pageIndex()).toBe(0);
  });

  it('scrolls back to the top on page change', async () => {
    const vp = gridOf<Item>(fixture).viewportHost;
    const scroll = vp.getScrollRoot()!;
    scroll.scrollTop = 200;
    vp.scrollTop.set(200);
    vp.goToPage(1);
    expect(scroll.scrollTop).toBe(0);
    expect(vp.scrollTop()).toBe(0);
  });

  it('disables row drag while an externalFilter is active', async () => {
    const vp = gridOf<Item>(fixture).viewportHost;
    await fixture.whenStable();
    expect(vp.rowDragEnabled()).toBe(true);
    fixture.componentInstance.external.set((row) => row.qty % 2 === 0);
    await fixture.whenStable();
    expect(vp.rowDragEnabled()).toBe(false);
  });

  it('offsets aria-rowindex by the current page', async () => {
    const vp = gridOf<Item>(fixture).viewportHost;
    vp.goToPage(2);
    await fixture.whenStable();
    const first = fixture.nativeElement.querySelector('.al-data-grid__tbody [role="row"]') as HTMLElement;
    // 1 header row + 20 rows before this page + 1.
    expect(first.getAttribute('aria-rowindex')).toBe('22');
  });
});

@Component({
  imports: [DataGrid],
  template: `<al-data-grid [controller]="grid" [data]="rows()" (queryChange)="queries.push($event)" />`,
})
class ServerHost {
  readonly rows = signal<readonly Item[]>(items(10));
  readonly queries: DataGridQuery[] = [];
  readonly grid = createGrid<Item>({
    columns,
    rowId: (row) => row.id,
    serverSide: true,
    serverRowCount: 95,
    viewport: { pagination: true, pageSize: 10, virtual: false },
    chrome: { floatingFilters: false },
  });
}

describe('ViewportHost server pagination (V5)', () => {
  it('pages by serverRowCount without client slicing and emits queryChange', async () => {
    const fixture = TestBed.createComponent(ServerHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const vp = gridOf<Item>(fixture).viewportHost;
    expect(vp.totalPages()).toBe(10);

    vp.goToPage(4);
    expect(vp.pageIndex()).toBe(4);
    expect(host.queries.at(-1)).toMatchObject({ pageIndex: 4, pageSize: 10 });

    host.rows.set(items(50).slice(40, 50));
    await fixture.whenStable();
    expect(vp.pageIndex()).toBe(4);
    expect(vp.pagedDisplayRows()).toHaveLength(10);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Item 41');
    const first = el.querySelector('.al-data-grid__tbody [role="row"]') as HTMLElement;
    expect(first.getAttribute('aria-rowindex')).toBe('42');
    expect(el.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe('96');

    host.grid.serverRowCount.set(20);
    await fixture.whenStable();
    expect(vp.totalPages()).toBe(2);
    expect(vp.pageIndex()).toBe(1);
    fixture.destroy();
  });
});

@Component({
  imports: [DataGrid],
  template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
})
class VirtualHost {
  readonly rows = signal<readonly Item[]>(items(1000));
  readonly grid = createGrid<Item>({
    columns,
    rowId: (row) => row.id,
    viewport: { virtual: true, overscan: 2 },
    chrome: { floatingFilters: false },
  });
}

describe('ViewportHost virtual focus (V2)', () => {
  let fixture: ComponentFixture<VirtualHost>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(VirtualHost);
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  const cell = (id: number) =>
    fixture.nativeElement.querySelector(`[data-testid="al-dg-cell-${id}-name"]`) as HTMLElement | null;

  it('focuses a far row after the virtual window re-renders (Ctrl+End / PageDown)', async () => {
    const api = fixture.componentInstance.grid.api()!;
    api.focusCell(0, 'name');
    await settle(fixture);
    expect(document.activeElement).toBe(cell(1));

    api.focusCell(900, 'name');
    await settle(fixture);
    expect(cell(901)).toBeTruthy();
    expect(document.activeElement).toBe(cell(901));
    expect(gridOf<Item>(fixture).viewportHost.scrollTop()).toBeGreaterThan(0);
  });

  it('parks DOM focus on the frame when the focused row is recycled, and restores it', async () => {
    const api = fixture.componentInstance.grid.api()!;
    api.focusCell(0, 'name');
    await settle(fixture);
    expect(document.activeElement).toBe(cell(1));

    const vp = gridOf<Item>(fixture).viewportHost;
    const scroll = vp.getScrollRoot()!;
    const frame = fixture.nativeElement.querySelector('[data-testid="al-dg-frame"]') as HTMLElement;
    scroll.scrollTop = 20000;
    scroll.dispatchEvent(new Event('scroll'));
    await settle(fixture);
    expect(cell(1)).toBeNull();
    expect(document.activeElement).toBe(frame);
    // Focus model untouched — parking must not trigger restore-and-scroll-back.
    expect(vp.focusedCell()?.rowIndex).toBe(0);
    expect(vp.scrollTop()).toBe(20000);

    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll'));
    await settle(fixture);
    expect(document.activeElement).toBe(cell(1));
  });

  it('uses body height (not header) for the PageDown step', () => {
    const vp = gridOf<Item>(fixture).viewportHost;
    // jsdom: no layout → fallback viewport 480px, 36px rows.
    expect(vp.pageRowCount()).toBe(13);
  });
});
