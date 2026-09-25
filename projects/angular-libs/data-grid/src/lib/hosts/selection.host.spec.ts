import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SelectionHost } from './selection.host';
import type { SelectionDeps } from './binder-surface';
import type { DisplayRow } from '../utils/row-display';

interface Row {
  id: number;
  locked?: boolean;
}

const all: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, locked: i === 5 }));

function makeHost(opts: {
  scope?: 'filtered' | 'page' | 'all';
  processed?: Row[];
  page?: Row[];
  selectable?: boolean;
}) {
  const selectedIds = signal<Array<string | number>>([]);
  const processed = signal(opts.processed ?? all);
  const page = signal(opts.page ?? processed());
  const rowId = vi.fn((row: Row) => row.id);
  const deps = {
    selectedIds,
    effectiveSelectionMode: () => 'multi',
    effectiveRowClickSelects: () => false,
    selectAllScope: () => opts.scope ?? 'filtered',
    isRowSelectableFn: () => (opts.selectable === false ? null : (row: Row) => !row.locked),
    data: () => all,
    effectiveRowId: () => rowId,
    processedRows: () => processed(),
    displayRows: () => [],
    visibleColumns: () => [],
    copyEnabled: () => false,
    pagedDisplayRows: (): DisplayRow<Row>[] =>
      page().map((row) => ({ kind: 'data', row, rowId: row.id, dataIndex: all.indexOf(row), level: 0 }) as DisplayRow<Row>),
    getQuery: () => ({}) as never,
    publishSelectionChange: vi.fn(),
    publishRowClick: vi.fn(),
    notifyPlugins: vi.fn(),
    effectivePlugins: () => [],
    pluginContext: () => ({}) as never,
  } as unknown as SelectionDeps<Row>;
  return { host: new SelectionHost<Row>(deps), selectedIds, processed, page, rowId, deps };
}

const check = (checked: boolean) => ({ target: { checked } }) as unknown as Event;

describe('SelectionHost select-all', () => {
  it('page scope unions with / subtracts from the existing selection', () => {
    const { host, selectedIds, page } = makeHost({ scope: 'page', page: all.slice(0, 2) });
    host.toggleSelectAll(check(true));
    expect(selectedIds()).toEqual([1, 2]);

    page.set(all.slice(2, 4));
    expect(host.selectAllState()).toEqual({ checked: false, indeterminate: false });
    host.toggleSelectAll(check(true));
    expect(selectedIds()).toEqual([1, 2, 3, 4]);
    expect(host.selectAllState().checked).toBe(true);

    host.toggleSelectAll(check(false));
    expect(selectedIds()).toEqual([1, 2]);
  });

  it('filtered scope covers every processed row (all pages), not filtered-out ones', () => {
    const processed = all.filter((r) => r.id !== 3);
    const { host, selectedIds } = makeHost({ processed, page: processed.slice(0, 2) });
    selectedIds.set([3]);
    host.toggleSelectAll(check(true));
    // Row 6 is not selectable; row 3 (filtered out) stays selected.
    expect([...selectedIds()].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(host.selectAllState()).toEqual({ checked: true, indeterminate: false });
    host.toggleSelectAll(check(false));
    expect(selectedIds()).toEqual([3]);
  });

  it('all scope includes filtered-out rows', () => {
    const { host, selectedIds } = makeHost({ scope: 'all', processed: all.slice(0, 1) });
    host.selectAllVisible();
    expect(selectedIds()).toEqual([1, 2, 3, 4, 5]);
  });

  it('header state ignores non-selectable rows', () => {
    const { host, selectedIds } = makeHost({});
    selectedIds.set([1, 2, 3, 4, 5]);
    expect(host.selectAllState()).toEqual({ checked: true, indeterminate: false });
    selectedIds.set([2]);
    expect(host.selectAllState()).toEqual({ checked: false, indeterminate: true });
  });

  it('isSelected / findDataRowById do not rescan per call', () => {
    const { host, selectedIds, rowId } = makeHost({ selectable: false });
    selectedIds.set([2, 4]);
    expect(host.isSelected(4)).toBe(true);
    expect(host.isSelected(3)).toBe(false);
    host.toggleSelectAll(check(true));
    const calls = rowId.mock.calls.length;
    for (const row of all) {
      host.isSelected(row.id);
      host.findDataRowById(row.id);
      host.isRowSelectedByRef(row);
    }
    expect(rowId.mock.calls.length).toBe(calls);
    expect(host.isRowSelectedByRef(all[0]!)).toBe(true);
  });
});
