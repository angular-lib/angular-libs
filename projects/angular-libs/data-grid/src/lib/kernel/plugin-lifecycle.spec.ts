import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { DataGrid } from '../components/data-grid/data-grid';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { createGrid, type GridController } from '../create-grid';
import type { DataGridApi } from '../api/grid-api';
import { GridCapabilities } from '../plugins/capabilities';
import { GridAdapterRegistry, adapterKey } from '../plugins/adapter-registry';
import {
  DataGridSlotRegistry,
  setupPlugin,
  type DataGridPlugin,
  type DataGridPluginContext,
} from '../plugins/types';
import {
  cellRangePlugin,
  CELL_RANGE_ADAPTER,
  flashCellsPlugin,
  rowDragPlugin,
  rowGroupPlugin,
  ROW_GROUP_ADAPTER,
  sideBarPlugin,
} from '@angular-libs/data-grid/plugins';

interface Row {
  id: number;
  name: string;
  city: string;
}

const rows: Row[] = [
  { id: 1, name: 'Ada', city: 'London' },
  { id: 2, name: 'Grace', city: 'New York' },
];
const columns: ColumnDef<Row>[] = [{ field: 'name' }, { field: 'city' }];

class RecordingErrorHandler extends ErrorHandler {
  readonly errors: Error[] = [];
  override handleError(error: unknown): void {
    this.errors.push(error as Error);
  }
}

function baseContext(): DataGridPluginContext<Row> {
  return {
    api: {} as never,
    element: document.createElement('div'),
    injector: null as never,
    slots: new DataGridSlotRegistry(signal([]), signal([]), signal([])),
    capabilities: new GridCapabilities<Row>(),
    adapters: new GridAdapterRegistry(),
  };
}

const toolbar = (id: string) => ({ id, icon: id, ariaLabel: id, actionClick: () => undefined });

async function mount<C>(host: new () => C): Promise<{ fixture: ComponentFixture<C>; errors: Error[] }> {
  const handler = new RecordingErrorHandler();
  await TestBed.configureTestingModule({
    imports: [host as never],
    providers: [{ provide: ErrorHandler, useValue: handler }],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, errors: handler.errors };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('setupPlugin (scoped registrations)', () => {
  it('rolls back registrations when setup throws partway', () => {
    const ctx = baseContext();
    const report = vi.fn();
    const key = adapterKey<{ n: number }>('x');
    const bad: DataGridPlugin<Row> = {
      id: 'bad',
      setup(c) {
        c.slots.registerToolbar(toolbar('bad-item'));
        c.slots.enableRowDrag();
        c.capabilities.registerInteraction({ id: 'bad-i', setup: () => undefined });
        c.adapters.register(key, { n: 1 });
        throw new Error('boom');
      },
    };
    expect(setupPlugin(bad, ctx, report)).toBeNull();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), 'setup', 'bad');
    expect(ctx.slots.toolbarItems()).toEqual([]);
    expect(ctx.slots.rowDragEnabled()).toBe(false);
    expect(ctx.capabilities.getInteractions()).toEqual([]);
    expect(ctx.adapters.get(key)).toBeNull();
  });

  it('dispose undoes registrations the plugin forgot to clean up, even if cleanup throws', () => {
    const ctx = baseContext();
    const report = vi.fn();
    const entry = setupPlugin<Row>(
      {
        id: 'leaky',
        setup(c) {
          c.slots.registerToolbar(toolbar('leaky'));
          return () => {
            throw new Error('cleanup boom');
          };
        },
      },
      ctx,
      report,
    )!;
    expect(ctx.slots.toolbarItems().map((i) => i.id)).toEqual(['leaky']);
    entry.dispose();
    expect(ctx.slots.toolbarItems()).toEqual([]);
    expect(report).toHaveBeenCalledWith(expect.any(Error), 'cleanup', 'leaky');
  });
});

describe('plugin lifecycle isolation (mounted grid)', () => {
  it('a throwing plugin / interaction does not break other plugins or api binding', async () => {
    const seen: string[] = [];
    const good: DataGridPlugin<Row> = {
      id: 'good',
      setup: (c) => c.slots.registerToolbar(toolbar('good-item')),
    };
    const bad: DataGridPlugin<Row> = {
      id: 'bad',
      setup(c) {
        c.slots.registerToolbar(toolbar('bad-item'));
        throw new Error('bad setup');
      },
    };
    const badInteraction: DataGridPlugin<Row> = {
      id: 'badInteraction',
      setup: (c) =>
        c.capabilities.registerInteraction({
          id: 'explodes',
          setup: () => {
            throw new Error('interaction boom');
          },
        }),
    };
    const after: DataGridPlugin<Row> = {
      id: 'after',
      setup: (c) =>
        c.capabilities.registerInteraction({
          id: 'after-i',
          setup: () => {
            seen.push('after attached');
            return () => seen.push('after detached');
          },
        }),
    };

    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows" (apiReady)="ready = $event" />`,
    })
    class Host {
      rows = rows;
      ready: DataGridApi<Row> | null = null;
      grid = createGrid<Row>({ columns, rowId: (r) => r.id, plugins: [good, bad, badInteraction, after] });
    }

    const { fixture, errors } = await mount(Host);
    const host = fixture.componentInstance;
    expect(host.ready).toBeTruthy();
    expect(host.grid.api()).toBe(host.ready);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="al-dg-toolbar-action-good-item"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-toolbar-action-bad-item"]')).toBeFalsy();
    expect(seen).toEqual(['after attached']);
    expect(errors.map((e) => (e.cause as Error).message)).toEqual(['bad setup', 'interaction boom']);

    fixture.destroy();
    expect(seen).toEqual(['after attached', 'after detached']);
  });

  it('teardown continues past throwing plugin / interaction cleanups', async () => {
    const seen: string[] = [];
    const plugins: DataGridPlugin<Row>[] = [
      {
        id: 'first',
        setup: (c) => {
          c.capabilities.registerInteraction({ id: 'first-i', setup: () => () => seen.push('first-i') });
          return () => seen.push('first');
        },
      },
      {
        id: 'throws',
        setup: (c) => {
          c.capabilities.registerInteraction({
            id: 'throws-i',
            setup: () => () => {
              throw new Error('interaction cleanup');
            },
          });
          return () => {
            throw new Error('plugin cleanup');
          };
        },
      },
    ];

    @Component({ imports: [DataGrid], template: `<al-data-grid [controller]="grid" [data]="rows" />` })
    class Host {
      rows = rows;
      grid = createGrid<Row>({ columns, rowId: (r) => r.id, plugins });
    }

    const { fixture, errors } = await mount(Host);
    const grid = fixture.componentInstance.grid;
    fixture.destroy();
    expect(seen).toEqual(['first-i', 'first']);
    expect(errors.map((e) => (e.cause as Error).message)).toEqual([
      'interaction cleanup',
      'plugin cleanup',
    ]);
    expect(grid.api()).toBeNull();
  });
});

describe('plugin recomposition', () => {
  it('setPlugins sets up each change once and keeps unchanged instances', async () => {
    const log: string[] = [];
    const tracked = (id: string): DataGridPlugin<Row> => ({
      id,
      setup: () => {
        log.push(`setup ${id}`);
        return () => log.push(`cleanup ${id}`);
      },
    });
    const a = tracked('a');
    const b = tracked('b');
    const c = tracked('c');

    @Component({ imports: [DataGrid], template: `<al-data-grid [controller]="grid" [data]="rows" />` })
    class Host {
      rows = rows;
      grid = createGrid<Row>({ columns, rowId: (r) => r.id, plugins: [a, b] });
    }

    const { fixture } = await mount(Host);
    expect(log).toEqual(['setup a', 'setup b']);
    log.length = 0;

    fixture.componentInstance.grid.setPlugins([a, c]);
    await settle(fixture);
    expect(log).toEqual(['cleanup b', 'setup c']);
    log.length = 0;

    // Same instances again — no churn.
    fixture.componentInstance.grid.setPlugins([a, c]);
    await settle(fixture);
    expect(log).toEqual([]);
  });

  it('lifecycle hooks follow the active plugin list', async () => {
    const calls: string[] = [];
    const hooked = (id: string): DataGridPlugin<Row> => ({
      id,
      onSortChange: () => calls.push(id),
    });
    const oldPlugin = hooked('old');
    const newPlugin = hooked('new');

    @Component({ imports: [DataGrid], template: `<al-data-grid [controller]="grid" [data]="rows" />` })
    class Host {
      rows = rows;
      grid = createGrid<Row>({ columns, rowId: (r) => r.id, plugins: [oldPlugin] });
    }

    const { fixture } = await mount(Host);
    const grid = fixture.componentInstance.grid;
    grid.setPlugins([newPlugin]);
    await settle(fixture);
    grid.api()!.setSortModel([{ columnId: 'name', direction: 'asc' }]);
    expect(calls).toEqual(['new']);
  });
});

describe('controller input is static', () => {
  it('reports a swap and keeps the original controller bound', async () => {
    @Component({ imports: [DataGrid], template: `<al-data-grid [controller]="grid()" [data]="rows" />` })
    class Host {
      rows = rows;
      readonly first = createGrid<Row>({ columns, rowId: (r) => r.id });
      readonly second = createGrid<Row>({ columns: [{ field: 'city' }], rowId: (r) => r.id });
      readonly grid = signal<GridController<Row>>(this.first);
    }

    const { fixture, errors } = await mount(Host);
    const host = fixture.componentInstance;
    const api = host.first.api();
    expect(api).toBeTruthy();

    host.grid.set(host.second);
    await settle(fixture);
    expect(errors.some((e) => e.message.includes('[controller] cannot change'))).toBe(true);
    expect(host.first.api()).toBe(api);
    expect(host.second.api()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[role="columnheader"]').length).toBeGreaterThan(1);

    fixture.destroy();
    expect(host.first.api()).toBeNull();
  });
});

describe('plugin instances shared by two grids', () => {
  it('keeps per-grid state and fans held adapters out to every grid', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sideBar = sideBarPlugin<Row>();
    const rowDrag = rowDragPlugin<Row>();
    const groups = rowGroupPlugin<Row>({ columns: [] });
    const ranges = cellRangePlugin<Row>();
    const flash = flashCellsPlugin<Row>();
    const shared = [sideBar, rowDrag, groups, ranges, flash];

    @Component({
      imports: [DataGrid],
      template: `
        @if (showA()) {
          <div data-testid="grid-a"><al-data-grid [controller]="a" [data]="rows" /></div>
        }
        <div data-testid="grid-b"><al-data-grid [controller]="b" [data]="rows" /></div>
      `,
    })
    class Host {
      rows = rows;
      readonly showA = signal(true);
      readonly a = createGrid<Row>({ columns, rowId: (r) => r.id, viewport: { virtual: false }, plugins: shared });
      readonly b = createGrid<Row>({ columns, rowId: (r) => r.id, viewport: { virtual: false }, plugins: shared });
    }

    const { fixture } = await mount(Host);
    const host = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const inGrid = (grid: 'a' | 'b', selector: string) =>
      el.querySelector(`[data-testid="grid-${grid}"]`)?.querySelectorAll(selector).length ?? 0;

    expect(inGrid('a', '[data-testid="al-dg-sidebar"]')).toBe(1);
    expect(inGrid('b', '[data-testid="al-dg-sidebar"]')).toBe(1);
    expect(inGrid('a', '[data-testid="al-dg-row-drag"]')).toBe(2);
    expect(inGrid('b', '[data-testid="al-dg-row-drag"]')).toBe(2);

    // Per-grid range state; the held adapter drives the first grid (dev warning).
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cellRangePlugin instance attached to a second grid'));
    const rangeB = host.b.getAdapter(CELL_RANGE_ADAPTER)!;
    rangeB.setRange({ anchor: { rowIndex: 0, columnId: 'name' }, active: { rowIndex: 1, columnId: 'name' } });
    expect(rangeB.getRange()).toBeTruthy();
    expect(host.a.getAdapter(CELL_RANGE_ADAPTER)!.getRange()).toBeNull();
    expect(ranges.getRange()).toBeNull();

    // Shared adapters fan out.
    groups.setColumns(['city']);
    await settle(fixture);
    expect(host.a.getAdapter(ROW_GROUP_ADAPTER)?.columns()).toEqual(['city']);
    expect(inGrid('a', '[data-testid^="al-dg-group-"]')).toBe(2);
    expect(inGrid('b', '[data-testid^="al-dg-group-"]')).toBe(2);
    groups.setColumns([]);

    flash.flashCells({ rowIds: [1] });
    await settle(fixture);
    expect(inGrid('a', '.al-dg-cell--flash')).toBe(2);
    expect(inGrid('b', '.al-dg-cell--flash')).toBe(2);

    sideBar.setEnabled(false);
    await settle(fixture);
    expect(inGrid('a', '[data-testid="al-dg-sidebar"]')).toBe(0);
    expect(inGrid('b', '[data-testid="al-dg-sidebar"]')).toBe(0);
    sideBar.setEnabled(true);

    // Destroying grid A leaves grid B's contributions alone.
    host.showA.set(false);
    await settle(fixture);
    expect(inGrid('b', '[data-testid="al-dg-sidebar"]')).toBe(1);
    expect(inGrid('b', '[data-testid="al-dg-row-drag"]')).toBe(2);
    expect(inGrid('b', '.al-dg-cell--flash')).toBe(2);
    rowDrag.setEnabled(false);
    await settle(fixture);
    expect(inGrid('b', '[data-testid="al-dg-row-drag"]')).toBe(0);
    // With A gone, the held range adapter now drives B.
    expect(ranges.getRange()).toBeTruthy();
    warn.mockRestore();
  });
});
