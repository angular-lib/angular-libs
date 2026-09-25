/**
 * S1 / S2 / S4 — derived state & query outputs, initialState, setState,
 * runtime column / selection schema.
 */

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { rowGroupPlugin, sideBarPlugin } from '@angular-libs/data-grid/plugins';
import { DataGrid } from '../components/data-grid/data-grid';
import type {
  ColumnDef,
  DataGridQuery,
  DataGridState,
  SortChangeEvent,
} from '../components/data-grid/data-grid.types';
import { createGrid, type CreateGridOptions } from '../create-grid';
import type { ColumnFilterModel } from '../utils/filter-model';
import type { DataGridPlugin } from '../plugins/types';

interface Item {
  id: number;
  name: string;
  qty: number;
  dept: string;
}

const items = (n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Item ${String(i + 1).padStart(2, '0')}`,
    qty: i,
    dept: i % 2 ? 'B' : 'A',
  }));

const columns: ColumnDef<Item>[] = [
  { field: 'name', filter: true },
  { field: 'qty', type: 'number' },
  { field: 'dept' },
];

let gridOptions: Partial<CreateGridOptions<Item>> = {};

@Component({
  imports: [DataGrid],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [(quickFilter)]="quick"
      [(hiddenColumnIds)]="hidden"
      [(selectedIds)]="selected"
      (queryChange)="queries.push($event)"
      (stateChange)="states.push($event)"
      (sortChange)="sortEvents.push($event)"
    />
  `,
})
class StateHost {
  readonly rows = signal<readonly Item[]>(items(30));
  readonly quick = signal('');
  readonly hidden = signal<string[]>([]);
  readonly selected = signal<Array<string | number>>([]);
  readonly queries: DataGridQuery[] = [];
  readonly states: DataGridState[] = [];
  readonly sortEvents: SortChangeEvent[] = [];
  readonly grid = createGrid<Item>({
    columns,
    rowId: (row) => row.id,
    viewport: { pagination: true, pageSize: 10, virtual: false },
    chrome: { floatingFilters: false },
    ...gridOptions,
  });
}

function gridOf(fixture: ComponentFixture<unknown>): DataGrid<Item> {
  return fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Item>;
}

async function mount(options: Partial<CreateGridOptions<Item>> = {}) {
  gridOptions = options;
  const fixture = TestBed.createComponent(StateHost);
  await fixture.whenStable();
  return { fixture, host: fixture.componentInstance, api: fixture.componentInstance.grid.api()! };
}

function firstRowText(fixture: ComponentFixture<unknown>): string {
  const row = (fixture.nativeElement as HTMLElement).querySelector(
    '.al-data-grid__tbody [role="row"]',
  );
  return row?.textContent ?? '';
}

afterEach(() => {
  gridOptions = {};
});

describe('derived queryChange (S1)', () => {
  it('emits the initial query on mount and follows model / controller writes', async () => {
    const { fixture, host, api } = await mount({ serverSide: true, serverRowCount: 100 });
    expect(host.queries).toHaveLength(1);
    expect(host.queries[0]).toEqual({
      sorts: [],
      filters: {},
      quickFilter: '',
      pageIndex: 0,
      pageSize: 10,
    });

    host.quick.set('abc');
    await fixture.whenStable();
    expect(host.queries).toHaveLength(2);
    expect(host.queries[1]!.quickFilter).toBe('abc');

    host.grid.viewport.pageSize.set(50);
    await fixture.whenStable();
    expect(host.queries).toHaveLength(3);
    expect(host.queries[2]!.pageSize).toBe(50);

    // Structural equality: re-applying the same model emits nothing.
    api.setSortModel([]);
    api.setQuickFilter('abc');
    await fixture.whenStable();
    expect(host.queries).toHaveLength(3);
    expect(host.grid.query()).toEqual(host.queries[2]);
    fixture.destroy();
  });

  it('emits nothing in client mode', async () => {
    const { fixture, host, api } = await mount();
    api.setSortModel([{ columnId: 'qty', direction: 'desc' }]);
    await fixture.whenStable();
    expect(host.queries).toEqual([]);
    fixture.destroy();
  });
});

describe('derived stateChange (S1)', () => {
  it('does not emit on mount, then emits once per real change from any source', async () => {
    const onStateChange = vi.fn();
    const spy: DataGridPlugin<Item> = { id: 'spy', onStateChange };
    const { fixture, host, api } = await mount({ plugins: [sideBarPlugin(), spy] });
    expect(host.states).toEqual([]);

    api.openToolPanel('filters');
    await fixture.whenStable();
    expect(host.states.at(-1)?.activeSidePanel).toBe('filters');

    host.hidden.set(['qty']);
    await fixture.whenStable();
    expect(host.states.at(-1)?.hiddenColumnIds).toEqual(['qty']);

    const count = host.states.length;
    host.hidden.set(['qty']);
    await fixture.whenStable();
    expect(host.states).toHaveLength(count);

    expect(onStateChange).toHaveBeenCalledTimes(count);
    expect(onStateChange.mock.calls.at(-1)![1]).toEqual(host.states.at(-1));
    expect(host.grid.state()).toEqual(host.states.at(-1));
    fixture.destroy();
  });
});

describe('initialState (S2)', () => {
  it('applies before the first render and drops unknown columns / invalid values', async () => {
    gridOptions = {
      initialState: {
        sorts: [{ columnId: 'qty', direction: 'desc' }],
        filters: {
          gone: { kind: 'text', conditions: [{ op: 'contains', value: 'x' }] },
          qty: 5 as unknown as ColumnFilterModel,
        },
        hiddenColumnIds: ['dept', 'gone'],
        columnOrder: ['gone', 'qty', 'name'],
        pageIndex: 1,
        selectedIds: [3],
      },
    };
    const fixture = TestBed.createComponent(StateHost);
    fixture.detectChanges();
    // First paint is already the restored state (page 2 of qty desc).
    expect(firstRowText(fixture)).toContain('Item 20');
    const grid = gridOf(fixture);
    expect(grid.columnLayoutHost.visibleColumnIds()).toEqual(['qty', 'name']);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    expect(host.hidden()).toEqual(['dept']);
    expect(host.selected()).toEqual([3]);
    expect(host.grid.state()?.filters).toEqual({});
    expect(host.states).toEqual([]);
    expect(host.sortEvents).toEqual([]);
    fixture.destroy();
  });

  it('feeds the first server query (no default-state fetch)', async () => {
    const { fixture, host } = await mount({
      serverSide: true,
      serverRowCount: 100,
      initialState: { sorts: [{ columnId: 'name', direction: 'asc' }], pageIndex: 3, pageSize: 20 },
    });
    expect(host.queries).toEqual([
      {
        sorts: [{ columnId: 'name', direction: 'asc' }],
        filters: {},
        quickFilter: '',
        pageIndex: 3,
        pageSize: 20,
      },
    ]);
    fixture.destroy();
  });

  it('restores plugin slices once the plugin registers (row group)', async () => {
    const groups = rowGroupPlugin();
    const { fixture, host } = await mount({
      plugins: [groups],
      initialState: { slices: { rowGroup: { columns: ['dept'], collapsedIds: [] } } },
    });
    expect(groups.columns()).toEqual(['dept']);
    groups.setColumns(['dept', 'qty']);
    await fixture.whenStable();
    expect(host.states.at(-1)?.slices['rowGroup']).toEqual({
      columns: ['dept', 'qty'],
      collapsedIds: [],
    });
    fixture.destroy();
  });
});

describe('api.setState (S2)', () => {
  it('honours ignore, reconciles columns and fires sort hooks', async () => {
    const onSortChange = vi.fn();
    const { fixture, host, api } = await mount({ plugins: [{ id: 'sorts', onSortChange }] });
    api.setState(
      {
        sorts: [{ columnId: 'name', direction: 'desc' }],
        columnPins: { qty: 'left', gone: 'right' },
        quickFilter: 'Item',
        selectedIds: [1, 2],
      },
      { ignore: ['quickFilter'] },
    );
    await fixture.whenStable();
    expect(host.quick()).toBe('');
    expect(host.selected()).toEqual([1, 2]);
    expect(host.sortEvents).toEqual([{ sorts: [{ columnId: 'name', direction: 'desc' }] }]);
    expect(onSortChange).toHaveBeenCalledTimes(1);
    const state = api.getState();
    expect(state.columnPins).toEqual({ name: null, qty: 'left', dept: null });
    expect(state.columnOrder).toEqual(['name', 'qty', 'dept']);

    // Same sorts again: no sortChange.
    api.setState({ sorts: [{ columnId: 'name', direction: 'desc' }] });
    expect(host.sortEvents).toHaveLength(1);
    fixture.destroy();
  });
});

describe('runtime schema (S4)', () => {
  it('replaces columns via grid.columns.set and keeps layout for surviving ids', async () => {
    const { fixture, host, api } = await mount();
    api.setColumnPinned('dept', 'left');
    host.hidden.set(['qty']);
    await fixture.whenStable();

    host.grid.columns.set([
      { field: 'name' },
      { field: 'dept' },
      { id: 'extra', header: 'Extra', valueGetter: (r) => r.qty * 2, hide: true },
      { id: 'pinned', header: 'Pinned', valueGetter: () => 1, pinned: 'right' },
    ]);
    await fixture.whenStable();
    const grid = gridOf(fixture);
    expect(host.hidden()).toEqual(['extra']);
    expect(grid.columnLayoutHost.visibleColumnIds()).toEqual(['dept', 'name', 'pinned']);
    expect(api.getColumnPinned('dept')).toBe('left');
    expect(api.getColumnPinned('pinned')).toBe('right');
    fixture.destroy();
  });

  it('switches selection mode at runtime', async () => {
    const { fixture, host } = await mount();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.al-data-grid__th--select')).toBeNull();
    host.grid.selection.set('multi');
    await fixture.whenStable();
    expect(el.querySelector('.al-data-grid__th--select')).not.toBeNull();
    fixture.destroy();
  });
});
