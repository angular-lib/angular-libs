import { describe, expect, it, vi } from 'vitest';
import { GridEventBus } from './grid-events';

describe('GridEventBus', () => {
  it('on delivers typed payloads and unsubscribes', () => {
    const bus = new GridEventBus<{ id: number }>();
    const seen: Array<string | number>[] = [];
    const off = bus.on('selectionChange', (event) => seen.push(event.selectedIds));

    bus.emit('selectionChange', {
      selectedIds: [1, 2],
      selected: [
        { rowId: 1, row: { id: 1 }, rowIndex: 0 },
        { rowId: 2, row: { id: 2 }, rowIndex: 1 },
      ],
    });
    off();
    bus.emit('selectionChange', {
      selectedIds: [3],
      selected: [{ rowId: 3, row: { id: 3 }, rowIndex: 2 }],
    });

    expect(seen).toEqual([[1, 2]]);
  });

  it('onAny receives every event', () => {
    const bus = new GridEventBus();
    const log: string[] = [];
    bus.onAny((name) => log.push(name));

    bus.emit('nearEnd', undefined);
    bus.emit('sortChange', { sorts: [] });
    bus.emit('nearEnd', undefined);

    expect(log).toEqual(['nearEnd', 'sortChange', 'nearEnd']);
  });

  it('wraps sort, filter, column order, find, and row-edit-cancel as named objects', () => {
    const bus = new GridEventBus<{ id: number }>();
    const payloads: unknown[] = [];
    bus.on('sortChange', (event) => payloads.push(event));
    bus.on('filterChange', (event) => payloads.push(event));
    bus.on('columnOrderChange', (event) => payloads.push(event));
    bus.on('findMatchesChange', (event) => payloads.push(event));
    bus.on('rowEditCancel', (event) => payloads.push(event));

    bus.emit('sortChange', { sorts: [{ columnId: 'name', direction: 'asc' }] });
    bus.emit('filterChange', { filters: { name: { kind: 'text', conditions: [{ op: 'contains', value: 'Ada' }] } } });
    bus.emit('columnOrderChange', { columnOrder: ['name', 'age'] });
    bus.emit('findMatchesChange', {
      query: 'ada',
      matches: [{ rowId: 1, rowIndex: 0, columnId: 'name' }],
    });
    bus.emit('rowEditCancel', { rowId: 1, row: { id: 1 }, rowIndex: 0 });

    expect(payloads).toEqual([
      { sorts: [{ columnId: 'name', direction: 'asc' }] },
      { filters: { name: { kind: 'text', conditions: [{ op: 'contains', value: 'Ada' }] } } },
      { columnOrder: ['name', 'age'] },
      { query: 'ada', matches: [{ rowId: 1, rowIndex: 0, columnId: 'name' }] },
      { rowId: 1, row: { id: 1 }, rowIndex: 0 },
    ]);
  });

  it('isolates listener failures', () => {
    const bus = new GridEventBus();
    const ok = vi.fn();
    bus.on('nearEnd', () => {
      throw new Error('boom');
    });
    bus.on('nearEnd', ok);

    expect(() => bus.emit('nearEnd', undefined)).not.toThrow();
    expect(ok).toHaveBeenCalledOnce();
  });

  it('clear drops all listeners', () => {
    const bus = new GridEventBus();
    const fn = vi.fn();
    bus.on('paste', fn);
    bus.onAny(fn);
    bus.clear();
    bus.emit('paste', {
      matrix: [],
      columnIds: [],
      startRowIndex: 0,
      suggestedRows: [],
    } as never);
    expect(fn).not.toHaveBeenCalled();
  });
});
