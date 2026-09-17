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
    bus.emit('sortChange', []);
    bus.emit('nearEnd', undefined);

    expect(log).toEqual(['nearEnd', 'sortChange', 'nearEnd']);
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
