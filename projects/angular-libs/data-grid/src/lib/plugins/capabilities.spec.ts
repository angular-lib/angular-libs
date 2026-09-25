import { GridCapabilities } from './capabilities';
import { GridAdapterRegistry, adapterKey } from './adapter-registry';
import { vi } from 'vitest';

describe('GridCapabilities display builders', () => {
  it('keeps a single builder and warns when a different id replaces it', () => {
    const caps = new GridCapabilities<{ id: number }>();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ctx = {
      columnsById: new Map(),
      rowId: (row: { id: number }) => row.id,
      collapsedGroupIds: new Set<string>(),
    };

    caps.registerDisplayBuilder({
      id: 'rowGroup',
      build: (rows) => rows.map((row, dataIndex) => ({
        kind: 'data' as const,
        id: `d:${row.id}`,
        rowId: row.id,
        row,
        dataIndex,
        level: 0,
      })),
    });
    caps.registerDisplayBuilder({
      id: 'masterDetail',
      build: () => [],
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('master-detail');
    expect(String(warn.mock.calls[0]?.[0])).toContain('row group, tree, and master-detail');
    expect(caps.buildDisplayRows([{ id: 1 }], ctx)).toEqual([]);

    warn.mockRestore();
  });

  it('does not warn when the same builder id is re-registered', () => {
    const caps = new GridCapabilities();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    caps.registerDisplayBuilder({ id: 'tree', build: () => [] });
    caps.registerDisplayBuilder({ id: 'tree', build: () => [] });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('GridCapabilities cell widgets / row aria / range source', () => {
  it('resolves a cell widget by column and row, and unregisters it', () => {
    const caps = new GridCapabilities<{ id: number; master: boolean }>();
    const toggle = vi.fn();
    const clean = caps.registerCellWidget({
      id: 'expand',
      columnId: (id) => id === '__expand',
      isActive: (row) => row.master,
      toggle,
    });
    const master = { id: 1, master: true };
    expect(caps.resolveCellWidget('__expand', master, 1)?.id).toBe('expand');
    expect(caps.resolveCellWidget('name', master, 1)).toBeNull();
    expect(caps.resolveCellWidget('__expand', { id: 2, master: false }, 2)).toBeNull();
    clean();
    expect(caps.resolveCellWidget('__expand', master, 1)).toBeNull();
  });

  it('returns the first row aria-details and the last range source', () => {
    const caps = new GridCapabilities<{ id: number }>();
    caps.registerRowAria({ id: 'none', ariaDetails: () => null });
    caps.registerRowAria({ id: 'md', ariaDetails: (_row, rowId) => `detail-${rowId}` });
    expect(caps.resolveRowAriaDetails({ id: 3 }, 3)).toBe('detail-3');

    expect(caps.rangeSelection()).toBeNull();
    const clean = caps.registerRangeSelection({ id: 'r', range: () => null, clear: () => undefined });
    expect(caps.rangeSelection()?.id).toBe('r');
    clean();
    expect(caps.rangeSelection()).toBeNull();
  });
});

describe('GridAdapterRegistry', () => {
  it('stores typed adapters by key id; cleanup only removes its own registration', () => {
    const registry = new GridAdapterRegistry();
    const key = adapterKey<{ n: number }>('thing');
    const first = { n: 1 };
    const second = { n: 2 };
    const cleanFirst = registry.register(key, first);
    registry.register(adapterKey<{ n: number }>('thing'), second);
    expect(registry.get(key)).toBe(second);
    cleanFirst();
    expect(registry.get(key)).toBe(second);
  });
});
