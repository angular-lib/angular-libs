import { resolveColumns } from './cell-value';
import { resolveColumnTracks, resolveColumnWidths } from './column-layout';
import { pinnedLeftOffsetOf, pinnedRightOffsetOf } from '../hosts/binder-template.helpers';
import type { ColumnDef } from '../components/data-grid/data-grid.types';

interface Row {
  a: string;
  b: string;
  c: string;
  d: string;
}

describe('column tracks (px, viewport-resolved)', () => {
  it('emits only px tracks — flex never depends on rendered content', () => {
    const cols = resolveColumns<Row>([
      { field: 'a', flex: 1, minWidth: 72 },
      { field: 'b', width: 200 },
    ]);
    const { tracks, widthsPx } = resolveColumnTracks(cols, {}, {}, 500);
    expect(tracks).toBe('300px 200px');
    expect(tracks).not.toContain('fr');
    expect(widthsPx).toEqual({ a: 300, b: 200 });
  });

  it('splits flex by weight and subtracts chrome', () => {
    const cols = resolveColumns<Row>([
      { field: 'a', flex: 1 },
      { field: 'b', flex: 2 },
    ]);
    const { tracks, widthsPx } = resolveColumnTracks(
      cols,
      {},
      { select: true, drag: true, rowEdit: true },
      36 + 40 + 132 + 300,
    );
    expect(widthsPx).toEqual({ a: 100, b: 200 });
    expect(tracks).toBe('36px 40px 100px 200px 132px');
  });

  it('clamps flex at minWidth and redistributes the rest', () => {
    const cols = resolveColumns<Row>([
      { field: 'a', flex: 1, minWidth: 150 },
      { field: 'b', flex: 3, minWidth: 50 },
    ]);
    // Proportional share of 400 would be a=100 < 150 → clamp, b gets 250.
    expect(resolveColumnWidths(cols, {}, 400)).toEqual({ a: 150, b: 250 });
    // No room: flex columns fall back to minWidth (table scrolls).
    expect(resolveColumnWidths(cols, {}, 100)).toEqual({ a: 150, b: 50 });
  });

  it('fills leftover into the last unpinned column until it is resized', () => {
    const cols = resolveColumns<Row>([
      { field: 'a', width: 100 },
      { field: 'b', width: 100 },
      { field: 'c', width: 100, pinned: 'right' },
    ]);
    expect(resolveColumnTracks(cols, {}, {}, 500).widthsPx).toEqual({ a: 100, b: 300, c: 100 });
    // User resized the fill column → it keeps the dragged width (gap instead of fill).
    expect(resolveColumnTracks(cols, { b: 80 }, {}, 500).widthsPx).toEqual({ a: 100, b: 80, c: 100 });
    // All pinned → nothing fills (pinned widths never stretch).
    const pinned = resolveColumns<Row>([
      { field: 'a', width: 100, pinned: 'left' },
      { field: 'b', width: 100, pinned: 'right' },
    ]);
    expect(resolveColumnTracks(pinned, {}, {}, 500).tracks).toBe('100px 100px');
  });

  it('a resize override on one column leaves flex columns flexing', () => {
    const cols = resolveColumns<Row>([
      { field: 'a', width: 100 },
      { field: 'b', flex: 1 },
      { field: 'c', flex: 1 },
    ]);
    expect(resolveColumnTracks(cols, { a: 200 }, {}, 600).widthsPx).toEqual({ a: 200, b: 200, c: 200 });
  });

  it('pinned offsets use the resolved flex width (no overlap)', () => {
    const defs: ColumnDef<Row>[] = [
      { field: 'a', flex: 1, minWidth: 72, pinned: 'left' },
      { field: 'b', width: 120, pinned: 'left' },
      { field: 'c', width: 200 },
      { field: 'd', flex: 1, minWidth: 60, pinned: 'right' },
      { field: 'd', id: 'e', width: 90, pinned: 'right' },
    ];
    const cols = resolveColumns<Row>(defs);
    const { widthsPx } = resolveColumnTracks(cols, {}, { select: true }, 40 + 120 + 200 + 90 + 150);
    expect(widthsPx['a']).toBe(75);
    expect(pinnedLeftOffsetOf('b', cols, widthsPx, true, false)).toBe(40 + 75);
    expect(pinnedRightOffsetOf('d', cols, widthsPx, false)).toBe(90);
  });
});
