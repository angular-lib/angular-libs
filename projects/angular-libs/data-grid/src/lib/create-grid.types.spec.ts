/**
 * Type-level spec (S3): `createGrid` infers `T` from `rows` / typed `columns`
 * and accepts row-agnostic plugins for any `T`. Checked by the spec compile
 * (`@ts-expect-error` must stay an error); runtime asserts are trivial.
 */

import { signal } from '@angular/core';
import {
  cellRangePlugin,
  defaultGridPlugins,
  rowDragPlugin,
  rowGroupPlugin,
  sideBarPlugin,
  treeDataPlugin,
} from '@angular-libs/data-grid/plugins';
import type { ColumnDef, ColumnOrGroupDef, DataGridQuery, DataGridState } from './components/data-grid/data-grid.types';
import { createGrid, type GridController } from './create-grid';

interface Person {
  id: number;
  name: string;
  department: string;
}

interface Order {
  sku: string;
}

const columns: ColumnDef<Person>[] = [{ field: 'name' }, { field: 'department' }];

describe('createGrid typing (S3)', () => {
  it('README quick start compiles and infers T from typed columns', () => {
    const groups = rowGroupPlugin({ columns: ['department'] });
    const grid = createGrid({
      columns,
      rowId: (r) => r.id,
      selection: 'multi',
      viewport: { virtual: true, pageSize: 25 },
      chrome: { showToolbar: true, contextMenu: true },
      plugins: [...defaultGridPlugins({ sideBar: false }), rowDragPlugin(), groups],
    });
    expectTypeOf(grid).toEqualTypeOf<GridController<Person>>();
    groups.setColumns(['department']);
    expect(grid.columns()).toBe(columns);
  });

  it('infers T with a single row-agnostic plugin', () => {
    const grid = createGrid({ columns, rowId: (r) => r.id, plugins: [sideBarPlugin()] });
    expectTypeOf(grid).toEqualTypeOf<GridController<Person>>();
  });

  it('accepts row-agnostic plugin spreads with an explicit T', () => {
    const grid = createGrid<Person>({
      columns,
      plugins: [...defaultGridPlugins(), cellRangePlugin(), sideBarPlugin()],
    });
    expectTypeOf(grid.api).returns.toEqualTypeOf<
      import('./api/grid-api').DataGridApi<Person> | null
    >();
  });

  it('infers T from rows for inline column literals', () => {
    const rows = signal<readonly Person[]>([]);
    const grid = createGrid({
      columns: [{ field: 'name' }, { field: 'department', valueFormatter: (_v, r) => r.name }],
      rows,
      rowId: (r) => r.id,
      isRowSelectable: (r) => r.department !== 'HR',
    });
    expectTypeOf(grid).toEqualTypeOf<GridController<Person>>();
  });

  it('keeps typed plugins row-checked', () => {
    // Inline row-typed plugins take `T` from an explicit `createGrid<T>` (or `factory<T>`).
    createGrid<Person>({
      columns,
      plugins: [treeDataPlugin({ getDataPath: (r) => [r.department, r.name] }), sideBarPlugin()],
    });
    createGrid({ columns, plugins: [treeDataPlugin<Person>({ getDataPath: (r) => [r.name] })] });
    const orders = treeDataPlugin<Order>({ getDataPath: (r) => [r.sku] });
    // @ts-expect-error — a plugin typed for other rows is rejected
    createGrid({ columns, plugins: [orders] });
    // @ts-expect-error — field must be a key of the row type
    createGrid<Person>({ columns: [{ field: 'nope' }] });
    expect(orders.id).toBe('treeData');
  });

  it('exposes runtime schema + state as signals', () => {
    const grid = createGrid({ columns, rowId: (r) => r.id });
    expectTypeOf(grid.columns.set).parameter(0).toEqualTypeOf<readonly ColumnOrGroupDef<Person>[]>();
    expectTypeOf(grid.state).returns.toEqualTypeOf<DataGridState | null>();
    expectTypeOf(grid.query).returns.toEqualTypeOf<DataGridQuery | null>();
    expect(grid.state()).toBeNull();
    expect(grid.selection()).toBe('none');
  });
});
