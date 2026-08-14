import {
  cellInNormalizedRange,
  moveFocusWithinGrid,
  normalizeCellRange,
  singleCellRange,
} from './cell-range';
import { buildLeanColumnMenuItems } from './column-menu';
import { computeCellRangeOverlayLayouts } from './cell-range-overlay';
import { defaultGridLocale } from '../locale/default-locale';

describe('cell-range utils', () => {
  const cols = ['name', 'age', 'city'];

  it('normalizes anchor/active independently of drag direction', () => {
    const norm = normalizeCellRange(
      {
        anchor: { rowIndex: 2, columnId: 'city' },
        active: { rowIndex: 0, columnId: 'name' },
      },
      cols,
    );
    expect(norm).toEqual({
      rowStart: 0,
      rowEnd: 2,
      colStart: 0,
      colEnd: 2,
      columnIds: ['name', 'age', 'city'],
    });
  });

  it('cellInNormalizedRange checks bounds', () => {
    const norm = normalizeCellRange(
      {
        anchor: { rowIndex: 1, columnId: 'age' },
        active: { rowIndex: 1, columnId: 'age' },
      },
      cols,
    )!;
    expect(cellInNormalizedRange(1, 'age', norm)).toBe(true);
    expect(cellInNormalizedRange(1, 'name', norm)).toBe(false);
    expect(cellInNormalizedRange(0, 'age', norm)).toBe(false);
  });

  it('moveFocusWithinGrid clamps to grid', () => {
    const next = moveFocusWithinGrid(
      { rowIndex: 0, columnId: 'name', realm: 'body' },
      -1,
      -1,
      cols,
      3,
    );
    expect(next).toEqual({ rowIndex: 0, columnId: 'name', realm: 'body' });
  });

  it('singleCellRange mirrors the cell', () => {
    expect(singleCellRange({ rowIndex: 4, columnId: 'city' })).toEqual({
      anchor: { rowIndex: 4, columnId: 'city' },
      active: { rowIndex: 4, columnId: 'city' },
    });
  });
});

describe('buildLeanColumnMenuItems', () => {
  it('includes sort, pin, autosize, hide', () => {
    const items = buildLeanColumnMenuItems({
      locale: defaultGridLocale,
      pinned: null,
      sortable: true,
      sortDirection: null,
      canHide: true,
      sortAsc: () => undefined,
      sortDesc: () => undefined,
      clearSort: () => undefined,
      pinLeft: () => undefined,
      pinRight: () => undefined,
      unpin: () => undefined,
      autosize: () => undefined,
      hide: () => undefined,
    });
    expect(items.map((i) => i.id)).toEqual([
      'sort-asc',
      'sort-desc',
      'sort-clear',
      'pin-left',
      'pin-right',
      'unpin',
      'autosize',
      'hide',
    ]);
  });

  it('omits sort when not sortable', () => {
    const items = buildLeanColumnMenuItems({
      locale: defaultGridLocale,
      pinned: 'left',
      sortable: false,
      sortDirection: null,
      canHide: false,
      sortAsc: () => undefined,
      sortDesc: () => undefined,
      clearSort: () => undefined,
      pinLeft: () => undefined,
      pinRight: () => undefined,
      unpin: () => undefined,
      autosize: () => undefined,
      hide: () => undefined,
    });
    expect(items.map((i) => i.id)).toEqual([
      'pin-left',
      'pin-right',
      'unpin',
      'autosize',
      'hide',
    ]);
    expect(items.find((i) => i.id === 'pin-left')?.disabled).toBe(true);
    expect(items.find((i) => i.id === 'hide')?.disabled).toBe(true);
  });
});

describe('cell-range overlay', () => {
  function fakeEl(box: { left: number; top: number; width: number; height: number }): HTMLElement {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        right: box.left + box.width,
        bottom: box.top + box.height,
        x: box.left,
        y: box.top,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    return el;
  }

  it('paints a ring from visible cells when a corner is missing', () => {
    const host = fakeEl({ left: 0, top: 0, width: 400, height: 400 });
    const mid = fakeEl({ left: 40, top: 80, width: 60, height: 24 });
    const layouts = computeCellRangeOverlayLayouts({
      range: {
        anchor: { rowIndex: 0, columnId: 'a' },
        active: { rowIndex: 2, columnId: 'a' },
      },
      visibleColumnIds: ['a'],
      displayRows: [
        { kind: 'data', row: {}, rowId: 0, id: '0', dataIndex: 0, level: 0 },
        { kind: 'data', row: {}, rowId: 1, id: '1', dataIndex: 1, level: 0 },
        { kind: 'data', row: {}, rowId: 2, id: '2', dataIndex: 2, level: 0 },
      ],
      getCellElement: (rowId) => (rowId === 1 ? mid : null),
      getScrollRoot: () => null,
      hostElement: host,
    });
    expect(layouts?.ring).toEqual({ left: 40, top: 80, width: 60, height: 24 });
    expect(layouts?.handle).toBeNull();
  });

  it('omits the fill handle when showFillHandle is false', () => {
    const host = fakeEl({ left: 0, top: 0, width: 400, height: 400 });
    const cell = fakeEl({ left: 10, top: 10, width: 50, height: 20 });
    const layouts = computeCellRangeOverlayLayouts({
      range: {
        anchor: { rowIndex: 0, columnId: 'a' },
        active: { rowIndex: 0, columnId: 'a' },
      },
      visibleColumnIds: ['a'],
      displayRows: [{ kind: 'data', row: {}, rowId: 0, id: '0', dataIndex: 0, level: 0 }],
      getCellElement: () => cell,
      getScrollRoot: () => null,
      hostElement: host,
      showFillHandle: false,
    });
    expect(layouts?.ring).toBeTruthy();
    expect(layouts?.handle).toBeNull();
  });
});

describe('defaultContextMenuItems', () => {
  it('uses locale labels', async () => {
    const { defaultContextMenuItems } = await import('./context-menu');
    const items = defaultContextMenuItems({
      copyCell: () => undefined,
      copyRow: () => undefined,
      exportCsv: () => undefined,
      autoSize: () => undefined,
      clearFilters: () => undefined,
      hasFilters: true,
      locale: {
        ...defaultGridLocale,
        copyCell: 'Copier la cellule',
        clearFilters: 'Effacer les filtres',
      },
    });
    expect(items.find((i) => i.id === 'copy-cell')?.label).toBe('Copier la cellule');
    expect(items.find((i) => i.id === 'clear-filters')?.label).toBe('Effacer les filtres');
  });
});
