import { GridCapabilities } from './capabilities';
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
