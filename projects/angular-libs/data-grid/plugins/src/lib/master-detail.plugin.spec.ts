import { describe, expect, it } from 'vitest';
import {
  buildMasterDetailDisplayRows,
  createMasterDetailAdapter,
  masterDetailPlugin,
  MASTER_DETAIL_PLUGIN_KIND,
} from './master-detail.plugin';
import { computeVirtualWindow } from '@angular-libs/data-grid/internals';

interface Order {
  sku: string;
  qty: number;
}

interface Customer {
  id: number;
  name: string;
  orders: Order[];
}

const customers: Customer[] = [
  { id: 1, name: 'Ada', orders: [{ sku: 'A1', qty: 2 }] },
  { id: 2, name: 'Grace', orders: [] },
  { id: 3, name: 'Alan', orders: [{ sku: 'B2', qty: 1 }, { sku: 'C3', qty: 4 }] },
];

describe('masterDetailPlugin', () => {
  it('inserts detail plugin rows only for expanded masters', () => {
    const expanded = new Set([1, 3]);
    const rows = buildMasterDetailDisplayRows({
      rows: customers,
      rowId: (r) => r.id,
      isExpanded: (id) => expanded.has(id as number),
      getDetailRows: (r) => r.orders,
      detailRowHeight: 160,
      detailColumns: [{ field: 'sku' }, { field: 'qty' }],
    });

    expect(rows.map((r) => r.kind)).toEqual([
      'data',
      'plugin',
      'data',
      'data',
      'plugin',
    ]);
    const detail = rows[1];
    expect(detail?.kind).toBe('plugin');
    if (detail?.kind === 'plugin') {
      expect(detail.pluginKind).toBe(MASTER_DETAIL_PLUGIN_KIND);
      expect(detail.height).toBe(160);
      expect(detail.id).toBe('md:1');
    }
  });

  it('respects isRowMaster', () => {
    const rows = buildMasterDetailDisplayRows({
      rows: customers,
      rowId: (r) => r.id,
      isExpanded: () => true,
      getDetailRows: (r) => r.orders,
      isRowMaster: (r) => r.orders.length > 0,
      detailRowHeight: 120,
    });
    const plugins = rows.filter((r) => r.kind === 'plugin');
    expect(plugins).toHaveLength(2);
    expect(plugins.map((r) => r.id)).toEqual(['md:1', 'md:3']);
  });

  it('adapter toggles expand state with open-by-default', () => {
    const adapter = createMasterDetailAdapter();
    expect(adapter.isExpanded(1, true)).toBe(true);
    expect(adapter.isExpanded(1, false)).toBe(false);

    adapter.toggle(1, true);
    expect(adapter.isExpanded(1, true)).toBe(false);
    expect(adapter.collapsedIds().has(1)).toBe(true);

    adapter.toggle(1, true);
    expect(adapter.isExpanded(1, true)).toBe(true);

    adapter.expandAll([1, 3]);
    expect([...adapter.expandedIds()].sort()).toEqual([1, 3]);

    adapter.collapseAll([1, 2, 3]);
    expect(adapter.isExpanded(1, true)).toBe(false);
    expect(adapter.isExpanded(3, true)).toBe(false);
  });

  it('collapseAll without ids blocks open-by-default', () => {
    const adapter = createMasterDetailAdapter();
    expect(adapter.isExpanded(1, true)).toBe(true);
    adapter.collapseAll();
    expect(adapter.isExpanded(1, true)).toBe(false);
    adapter.expand(1);
    expect(adapter.isExpanded(1, true)).toBe(true);
  });

  it('expandColumn wires renderer params to the adapter', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailColumns: [{ field: 'sku' }],
    });
    const col = md.expandColumn();
    expect(col.id).toBe('__masterDetailExpand');
    expect(col.cellRenderer).toBeTruthy();
    expect(col.cellRendererParams?.['masterDetail']).toBe(md);
  });

  it('variable virtual window accounts for detail heights', () => {
    const heights = [36, 160, 36, 36, 160];
    const window = computeVirtualWindow({
      rowCount: heights.length,
      rowHeight: 36,
      rowHeights: heights,
      scrollTop: 0,
      viewportHeight: 100,
      overscan: 0,
      enabled: true,
    });
    expect(window.totalHeight).toBe(36 + 160 + 36 + 36 + 160);
    expect(window.start).toBe(0);
    expect(window.end).toBeGreaterThan(1);
  });
});
