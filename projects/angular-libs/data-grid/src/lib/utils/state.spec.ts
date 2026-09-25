import { signal } from '@angular/core';
import { GridCapabilities } from '../plugins/capabilities';
import {
  createEmptyGridState,
  jsonEqual,
  migrateGridState,
  parseGridState,
  sanitizeGridState,
  serializeGridState,
} from './state';

describe('grid state schema (S2)', () => {
  it('drops invalid filter values instead of crashing the filter pipeline', () => {
    const parsed = parseGridState('{"filters":{"age":5,"name":"Ada","city":""}}');
    expect(parsed?.filters).toEqual({ name: 'Ada' });
  });

  it('validates sort entries (direction, shape, duplicates)', () => {
    const parsed = parseGridState(
      JSON.stringify({
        sorts: [
          { columnId: 'age', direction: 'up' },
          { columnId: 'name', direction: 'desc' },
          { columnId: 'name', direction: 'asc' },
          'age',
          { columnId: 3, direction: 'asc' },
        ],
      }),
    );
    expect(parsed?.sorts).toEqual([{ columnId: 'name', direction: 'desc' }]);
  });

  it('keeps only well-formed fields and omits invalid ones', () => {
    const state = sanitizeGridState({
      quickFilter: 42,
      hiddenColumnIds: ['a', 1, 'a'],
      widthOverrides: { a: 120, b: -1, c: 'wide', d: Number.NaN },
      columnPins: { a: 'left', b: 'top', c: null },
      pageIndex: -1,
      pageSize: 2.5,
      selectedIds: [1, 'x', null, 1, Number.POSITIVE_INFINITY],
      activeSidePanel: 7,
      slices: { rowGroup: { columns: ['dept'] } },
    });
    expect(state).toEqual({
      hiddenColumnIds: ['a'],
      widthOverrides: { a: 120 },
      columnPins: { a: 'left', c: null },
      selectedIds: [1, 'x'],
      slices: { rowGroup: { columns: ['dept'] } },
    });
  });

  it('drops unknown column ids against the live columns', () => {
    const state = sanitizeGridState(
      {
        sorts: [
          { columnId: 'gone', direction: 'asc' },
          { columnId: 'name', direction: 'asc' },
        ],
        filters: { gone: 'x', name: 'Ada' },
        hiddenColumnIds: ['gone', 'age'],
        columnOrder: ['gone', 'age', 'name'],
        widthOverrides: { gone: 10, name: 100 },
        columnPins: { gone: 'left', age: 'right' },
      },
      new Set(['name', 'age']),
    );
    expect(state).toEqual({
      sorts: [{ columnId: 'name', direction: 'asc' }],
      filters: { name: 'Ada' },
      hiddenColumnIds: ['age'],
      columnOrder: ['age', 'name'],
      widthOverrides: { name: 100 },
      columnPins: { age: 'right' },
    });
  });

  it('migrates unversioned (v0) snapshots and rejects unknown versions / non-objects', () => {
    expect(migrateGridState({ quickFilter: 'x', pageIndex: 2 })).toEqual({
      quickFilter: 'x',
      pageIndex: 2,
      version: 1,
    });
    expect(migrateGridState({ version: 99, quickFilter: 'x' })).toBeNull();
    expect(parseGridState('[1,2]')).toBeNull();
    expect(parseGridState('not json')).toBeNull();
  });

  it('round-trips a full snapshot', () => {
    const state = {
      ...createEmptyGridState(),
      sorts: [{ columnId: 'age', direction: 'desc' as const }],
      selectedIds: [1, 'b'],
      pageSize: 50,
      slices: { rowGroup: { columns: ['dept'], collapsedIds: ['dept:A'] } },
    };
    expect(parseGridState(serializeGridState(state))).toEqual(state);
  });

  it('compares snapshots structurally (key order, undefined keys)', () => {
    expect(jsonEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1, x: undefined }, { a: 1 })).toBe(true);
    expect(jsonEqual({ a: [1] }, { a: { 0: 1 } })).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('GridCapabilities.registerStateSlice (S2)', () => {
  it('collects slices reactively and applies values restored before registration', () => {
    const caps = new GridCapabilities();
    const columns = signal<string[]>([]);
    caps.applyStateSlices({ rowGroup: { columns: ['dept'] } });
    // Pending values stay in the snapshot until the plugin registers.
    expect(caps.collectStateSlices()).toEqual({ rowGroup: { columns: ['dept'] } });

    const cleanup = caps.registerStateSlice({
      key: 'rowGroup',
      get: () => ({ columns: columns() }),
      apply: (value) => columns.set((value as { columns: string[] }).columns),
    });
    expect(columns()).toEqual(['dept']);

    caps.applyStateSlices({ rowGroup: { columns: ['role'] } });
    expect(caps.collectStateSlices()).toEqual({ rowGroup: { columns: ['role'] } });

    cleanup();
    expect(caps.collectStateSlices()).toEqual({});
  });
});
