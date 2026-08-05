import {
  cellInNormalizedRange,
  moveFocusWithinGrid,
  normalizeCellRange,
  singleCellRange,
} from './cell-range';
import { buildLeanColumnMenuItems } from './column-menu';
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
