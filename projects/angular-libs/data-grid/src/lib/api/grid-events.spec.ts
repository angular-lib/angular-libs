import { describe, expect, it, vi } from 'vitest';
import { GridEventBus } from './grid-events';

describe('GridEventBus', () => {
  it('on delivers typed payloads and unsubscribes', () => {
    const bus = new GridEventBus<{ id: number }>();
    const seen: Array<string | number>[] = [];
    const off = bus.on('selectionChange', (ids) => seen.push(ids));

    bus.emit('selectionChange', [1, 2]);
    off();
    bus.emit('selectionChange', [3]);

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
