import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { GridCapabilities } from '@angular-libs/data-grid/plugin';
import type { CustomDisplayRow } from '@angular-libs/data-grid/internals';
import {
  buildMasterDetailDisplayRows,
  createMasterDetailAdapter,
  masterDetailPlugin,
  MASTER_DETAIL_PLUGIN_KIND,
  EMPTY_DETAIL_ROW_HEIGHT,
} from './master-detail.plugin';
import {
  MasterDetailDefaultView,
  detailGridConfigKey,
} from './master-detail-default.view';
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

function pluginContext(
  caps: GridCapabilities<Customer>,
  api: { getSourceRows?: () => readonly Customer[]; getLocale?: () => unknown } = {},
) {
  return {
    api: {
      getLocale: () => ({
        expandDetailAriaLabel: 'Expand detail',
        collapseDetailAriaLabel: 'Collapse detail',
      }),
      ...api,
    } as never,
    element: document.createElement('div'),
    injector: null as never,
    slots: {} as never,
    capabilities: caps,
  };
}

describe('masterDetailPlugin', () => {
  it('inserts detail plugin rows only for expanded masters', () => {
    const expanded = new Set([1, 3]);
    const rows = buildMasterDetailDisplayRows({
      rows: customers,
      rowId: (r) => r.id,
      isExpanded: (id) => expanded.has(id as number),
      getDetailRows: (r) => r.orders,
      detailRowHeight: 160,
      detailGrid: {
        columns: [{ field: 'sku' }, { field: 'qty' }],
        rowId: (r) => r.sku,
      },
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

  it('uses a compact height for empty default-view detail panels', () => {
    const rows = buildMasterDetailDisplayRows({
      rows: customers,
      rowId: (r) => r.id,
      isExpanded: () => true,
      getDetailRows: (r) => r.orders,
      isRowMaster: () => true,
      detailRowHeight: 200,
      emptyDetailRowHeight: EMPTY_DETAIL_ROW_HEIGHT,
    });
    const empty = rows.find((r) => r.id === 'md:2');
    expect(empty?.kind).toBe('plugin');
    if (empty?.kind === 'plugin') {
      expect(empty.height).toBe(EMPTY_DETAIL_ROW_HEIGHT);
    }
    const full = rows.find((r) => r.id === 'md:1');
    if (full?.kind === 'plugin') {
      expect(full.height).toBe(200);
    }
  });

  it('defaults isRowMaster to rows that have detail children', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailColumns: [{ field: 'sku' }],
    });
    const caps = new GridCapabilities<Customer>();
    md.setup!(pluginContext(caps));
    md.expandAll([1, 2, 3]);

    const display = caps.buildDisplayRows(customers, {
      columnsById: new Map(),
      rowId: (row) => row.id,
      collapsedGroupIds: new Set(),
    });
    expect(display.filter((r) => r.kind === 'plugin').map((r) => r.id)).toEqual([
      'md:1',
      'md:3',
    ]);
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

  it('re-evaluates isOpenByDefault on every display pass until overridden', () => {
    const adapter = createMasterDetailAdapter();
    let openAda = true;
    const build = () =>
      buildMasterDetailDisplayRows({
        rows: customers,
        rowId: (r) => r.id,
        isExpanded: (id, row) =>
          adapter.isExpanded(id, row.id === 1 && openAda),
        getDetailRows: (r) => r.orders,
        isRowMaster: (r) => r.orders.length > 0,
        detailRowHeight: 120,
      });

    expect(build().some((r) => r.id === 'md:1')).toBe(true);
    openAda = false;
    expect(build().some((r) => r.id === 'md:1')).toBe(false);
    openAda = true;
    expect(build().some((r) => r.id === 'md:1')).toBe(true);

    adapter.collapse(1);
    expect(build().some((r) => r.id === 'md:1')).toBe(false);
  });

  it('collapseAll without ids blocks open-by-default', () => {
    const adapter = createMasterDetailAdapter();
    expect(adapter.isExpanded(1, true)).toBe(true);
    adapter.collapseAll();
    expect(adapter.isExpanded(1, true)).toBe(false);
    adapter.expand(1);
    expect(adapter.isExpanded(1, true)).toBe(true);
  });

  it('expandColumn wires renderer params to the plugin adapter', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailGrid: { columns: [{ field: 'sku' }], rowId: (r) => r.sku },
    });
    const col = md.expandColumn();
    expect(col.id).toBe('__masterDetailExpand');
    expect(col.cellRenderer).toBeTruthy();
    expect(col.cellRendererParams?.['masterDetail']).toBe(md);
  });

  it('normalizes detailColumns into detailGrid on the payload', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailColumns: [{ field: 'sku' }],
    });
    const rows = buildMasterDetailDisplayRows({
      rows: customers,
      rowId: (r) => r.id,
      isExpanded: (id) => id === 1,
      getDetailRows: (r) => r.orders,
      detailRowHeight: 120,
      detailGrid: { columns: [{ field: 'sku' }] },
    });
    const detail = rows.find((r) => r.kind === 'plugin');
    expect(detail?.kind).toBe('plugin');
    if (detail?.kind === 'plugin') {
      const payload = detail.payload as { detailGrid?: { columns: unknown[] } };
      expect(payload.detailGrid?.columns).toHaveLength(1);
    }
    expect(md.id).toBe('masterDetail');
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

  it('detailGridConfigKey changes when column fields are replaced', () => {
    const a = detailGridConfigKey({ columns: [{ field: 'sku' }] });
    const b = detailGridConfigKey({ columns: [{ field: 'qty' }] });
    expect(a).not.toBe(b);
  });

  it('reuses the nested controller for the same master across display passes', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailGrid: { columns: [{ field: 'sku' }], rowId: (r) => r.sku },
    });
    const caps = new GridCapabilities<Customer>();
    md.setup!(pluginContext(caps));
    md.expand(1);

    const ctx = {
      columnsById: new Map(),
      rowId: (row: Customer) => row.id,
      collapsedGroupIds: new Set<string>(),
    };
    const first = caps.buildDisplayRows(customers, ctx).find((r) => r.id === 'md:1');
    expect(first?.kind).toBe('plugin');
    const obtain =
      first?.kind === 'plugin'
        ? (first.payload as { obtainDetailController?: (cfg: { columns: { field: string }[] }) => unknown })
            .obtainDetailController
        : undefined;
    expect(obtain).toBeTruthy();
    const cfg = { columns: [{ field: 'sku' }], rowId: (r: Order) => r.sku };
    const a = obtain!(cfg);
    const b = obtain!(cfg);
    expect(a).toBe(b);

    const second = caps.buildDisplayRows(customers, ctx).find((r) => r.id === 'md:1');
    const obtain2 =
      second?.kind === 'plugin'
        ? (
            second.payload as {
              obtainDetailController?: (config: {
                columns: { field: string }[];
                rowId: (r: Order) => string;
              }) => unknown;
            }
          ).obtainDetailController
        : undefined;
    expect(obtain2!(cfg)).toBe(a);
  });

  it('evicts cached detail controllers when a master leaves source data', () => {
    const source = [...customers];
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailGrid: { columns: [{ field: 'sku' }], rowId: (r) => r.sku },
    });
    const caps = new GridCapabilities<Customer>();
    md.setup!(
      pluginContext(caps, {
        getSourceRows: () => source,
      }),
    );
    md.expand(1);

    const ctx = {
      columnsById: new Map(),
      rowId: (row: Customer) => row.id,
      collapsedGroupIds: new Set<string>(),
    };
    const first = caps.buildDisplayRows(customers, ctx).find((r) => r.id === 'md:1');
    const obtain = (
      first?.kind === 'plugin'
        ? (
            first.payload as {
              obtainDetailController?: (cfg: { columns: { field: string }[] }) => unknown;
            }
          ).obtainDetailController
        : undefined
    )!;
    const cfg = { columns: [{ field: 'sku' }] };
    const cached = obtain(cfg);
    expect(obtain(cfg)).toBe(cached);

    source.splice(0, source.length, ...customers.filter((c) => c.id !== 1));
    caps.buildDisplayRows(source, ctx);

    source.splice(0, source.length, ...customers);
    md.expand(1);
    const again = caps.buildDisplayRows(customers, ctx).find((r) => r.id === 'md:1');
    const obtain2 = (
      again?.kind === 'plugin'
        ? (
            again.payload as {
              obtainDetailController?: (cfg: { columns: { field: string }[] }) => unknown;
            }
          ).obtainDetailController
        : undefined
    )!;
    expect(obtain2(cfg)).not.toBe(cached);
  });

  it('persists and restores nested grid state on the payload hooks', () => {
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailGrid: { columns: [{ field: 'sku' }], rowId: (r) => r.sku },
    });
    const caps = new GridCapabilities<Customer>();
    md.setup!(pluginContext(caps));
    md.expand(1);
    const row = caps
      .buildDisplayRows(customers, {
        columnsById: new Map(),
        rowId: (row) => row.id,
        collapsedGroupIds: new Set<string>(),
      })
      .find((r) => r.id === 'md:1');
    expect(row?.kind).toBe('plugin');
    const payload = row?.kind === 'plugin' ? (row.payload as {
      obtainDetailController?: (cfg: { columns: { field: string }[] }) => unknown;
      persistDetailState?: (api: {
        getState: () => { sorts: { columnId: string; direction: string }[] };
        getSelectedIds: () => Array<string | number>;
      }) => void;
      takePersistedDetailState?: () => {
        state: { sorts: { columnId: string; direction: string }[] };
        selectedIds: Array<string | number>;
      } | null;
    }) : undefined;
    payload!.obtainDetailController!({ columns: [{ field: 'sku' }] });
    payload!.persistDetailState!({
      getState: () => ({ sorts: [{ columnId: 'sku', direction: 'desc' }] }),
      getSelectedIds: () => ['A1'],
    });
    const snap = payload!.takePersistedDetailState!();
    expect(snap?.state.sorts).toEqual([{ columnId: 'sku', direction: 'desc' }]);
    expect(snap?.selectedIds).toEqual(['A1']);
    expect(payload!.takePersistedDetailState!()).toBeNull();
  });
});

describe('MasterDetailDefaultView nested controller', () => {
  it('recreates the nested grid when detailGrid columns change', async () => {
    const detailGrid: {
      columns: { field: keyof Order & string }[];
      rowId: (row: Order) => string;
    } = {
      columns: [{ field: 'sku' }],
      rowId: (r) => r.sku,
    };
    const item = signal<CustomDisplayRow>({
      kind: 'plugin',
      pluginKind: MASTER_DETAIL_PLUGIN_KIND,
      id: 'md:1',
      payload: {
        master: customers[0],
        masterRowId: 1,
        detailRows: customers[0]!.orders,
        detailGrid,
      },
    });

    @Component({
      imports: [MasterDetailDefaultView],
      template: `<al-dg-master-detail-view [item]="item()" />`,
    })
    class Host {
      readonly item = item;
    }

    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const view = fixture.debugElement.children[0]!
      .componentInstance as MasterDetailDefaultView<Customer, Order>;
    const first = view.detailController();
    expect(first).toBeTruthy();
    expect(first!.columns).toEqual([{ field: 'sku' }]);

    detailGrid.columns = [{ field: 'qty' }];
    item.set({
      kind: 'plugin',
      pluginKind: MASTER_DETAIL_PLUGIN_KIND,
      id: 'md:1',
      payload: {
        master: customers[0],
        masterRowId: 1,
        detailRows: customers[0]!.orders,
        detailGrid,
      },
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const second = view.detailController();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(second!.columns).toEqual([{ field: 'qty' }]);
  });
});

describe('exclusive display builders', () => {
  it('warns that master-detail cannot share a builder with row group', () => {
    const caps = new GridCapabilities();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    caps.registerDisplayBuilder({ id: 'rowGroup', build: () => [] });
    const md = masterDetailPlugin<Customer, Order>({
      getDetailRows: (r) => r.orders,
      detailColumns: [{ field: 'sku' }],
    });
    md.setup!(pluginContext(caps as GridCapabilities<Customer>));
    expect(String(warn.mock.calls[0]?.[0])).toContain('master-detail');
    warn.mockRestore();
  });
});
