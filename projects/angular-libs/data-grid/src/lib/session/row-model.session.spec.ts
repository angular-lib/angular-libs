import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it, vi } from 'vitest';
import { rowGroupPlugin, treeDataPlugin } from '@angular-libs/data-grid/plugins';
import { DataGrid } from '../components/data-grid/data-grid';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { createGrid } from '../create-grid';
import type { DataDisplayRow } from '../utils/row-display';

interface Person {
  id: number;
  name: string;
  city: string;
  path?: string[];
}

const columns: ColumnDef<Person>[] = [{ field: 'name', editable: true }, { field: 'city' }];

async function mount<H>(type: new () => H) {
  await TestBed.configureTestingModule({ imports: [type as never] }).compileComponents();
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const grid = fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Person>;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host: fixture.componentInstance, session: grid.session, settle, el: fixture.nativeElement as HTMLElement };
}

describe('R1 default index rowId = source index', () => {
  it('display rows, selection and auto-applied edits agree after sorting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class IndexIdHost {
      readonly rows = signal<readonly Person[]>([
        { id: 10, name: 'Zed', city: 'Oslo' },
        { id: 11, name: 'Amy', city: 'Bergen' },
      ]);
      readonly grid = createGrid<Person>({
        columns,
        rows: this.rows,
        selection: 'multi',
        viewport: { virtual: false },
      });
    }
    const { host, session, settle } = await mount(IndexIdHost);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('without rowId'))).toBe(true);
    warn.mockRestore();

    const api = host.grid.api()!;
    api.setSortModel([{ columnId: 'name', direction: 'asc' }]);
    await settle();

    const first = session.displayRows()[0] as DataDisplayRow<Person>;
    expect(first.row.name).toBe('Amy');
    expect(first.rowId).toBe(1);

    api.setSelectedIds([first.rowId]);
    expect(api.getSelectedRows().map((r) => r.name)).toEqual(['Amy']);
    api.setSelectedRows([host.rows()[1]!]);
    expect(api.getSelectedIds()).toEqual([1]);

    // Cell edit on the first *displayed* row must write Amy, not Zed.
    const column = session.columnLayout.columnsById().get('name')!;
    api.startEditingCell(first.rowId, 'name');
    session.editSync.editDraft.set('Amy2');
    session.editSync.commitEdit(first.row, first.rowId, first.dataIndex, column);
    await settle();
    expect(host.rows().map((r) => r.name)).toEqual(['Zed', 'Amy2']);

    expect(() => host.grid.applyTransaction({ remove: [host.rows()[0]!] })).toThrow(/explicit rowId/);
  });
});

describe('R3 single expansion store', () => {
  @Component({
    imports: [DataGrid],
    template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
  })
  class TreeHost {
    readonly rows = signal<readonly Person[]>([
      { id: 1, name: 'UK HQ', city: 'London', path: ['UK'] },
      { id: 2, name: 'Ada', city: 'London', path: ['UK', 'London'] },
      { id: 3, name: 'Grace', city: 'New York', path: ['US', 'New York'] },
    ]);
    readonly tree = treeDataPlugin<Person>({ getDataPath: (r) => r.path ?? [] });
    readonly grid = createGrid<Person>({
      columns,
      rowId: (r) => r.id,
      viewport: { virtual: false },
      plugins: [this.tree],
    });
  }

  it('tree nodes collapse via mouse (data node toggle + filler group row)', async () => {
    const { host, el, settle } = await mount(TreeHost);
    expect(el.textContent).toContain('Ada');
    // Each leaf once.
    expect(el.querySelectorAll('[data-testid="al-dg-row-2"]')).toHaveLength(1);

    (el.querySelector('[data-testid="al-dg-tree-toggle-1"]') as HTMLElement).click();
    await settle();
    expect(el.textContent).not.toContain('Ada');
    expect(host.tree.collapsedIds().size).toBe(1);

    const us = el.querySelector('[data-testid^="al-dg-group-"]') as HTMLElement;
    us.click();
    await settle();
    expect(el.textContent).not.toContain('Grace');

    host.grid.api()!.expandAll();
    await settle();
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('Grace');

    host.grid.api()!.collapseAll();
    await settle();
    expect(el.textContent).not.toContain('Ada');
    expect(el.textContent).not.toContain('Grace');
  });

  it('tree nodes toggle via keyboard (Space on the first column)', async () => {
    const { host, session, el, settle } = await mount(TreeHost);
    session.kernel.focus.focusCell(0, 'name');
    session.kernel.focus.handleKeydown(new KeyboardEvent('keydown', { key: ' ' }));
    await settle();
    expect(el.textContent).not.toContain('Ada');
    session.kernel.focus.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(el.textContent).toContain('Ada');
    expect(host.tree.collapsedIds().size).toBe(0);
  });

  it('api, adapter and UI toggles hit the same row-group store', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class GroupHost {
      readonly rows = signal<readonly Person[]>([
        { id: 1, name: 'Ada', city: 'London' },
        { id: 2, name: 'Grace', city: 'New York' },
      ]);
      readonly groups = rowGroupPlugin<Person>({ columns: ['city'] });
      readonly grid = createGrid<Person>({
        columns,
        rowId: (r) => r.id,
        viewport: { virtual: false },
        plugins: [this.groups],
      });
    }
    const { host, session, el, settle } = await mount(GroupHost);
    const london = session.displayRows()[0]!;
    host.grid.api()!.toggleGroup(london.id);
    await settle();
    expect(host.groups.collapsedIds().has(london.id)).toBe(true);
    expect(el.textContent).not.toContain('Ada');
    host.groups.toggleCollapsed(london.id);
    await settle();
    expect(el.textContent).toContain('Ada');
  });
});

describe('R5 staged row model', () => {
  it('collapsing a group / reordering or hiding columns does not re-run filter+sort', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class StagedHost {
      readonly rows = signal<readonly Person[]>([
        { id: 1, name: 'Ada', city: 'London' },
        { id: 2, name: 'Grace', city: 'New York' },
      ]);
      readonly groups = rowGroupPlugin<Person>({ columns: ['city'] });
      readonly grid = createGrid<Person>({
        columns,
        rowId: (r) => r.id,
        viewport: { virtual: false },
        plugins: [this.groups],
      });
    }
    const { host, session, settle } = await mount(StagedHost);
    const api = host.grid.api()!;
    api.setSortModel([{ columnId: 'name', direction: 'desc' }]);
    api.setQuickFilter('a');
    await settle();
    const processed = session.processedRows();
    expect(processed.map((r) => r.name)).toEqual(['Grace', 'Ada']);

    api.toggleGroup(session.displayRows()[0]!.id);
    await settle();
    session.columnLayout.reorderVisibleColumns(0, 1);
    api.setColumnPinned('name', 'left');
    await settle();
    expect(session.processedRows()).toBe(processed);

    // Hiding a column the quick filter matched on *does* re-run it.
    api.setColumnVisible('city', false);
    await settle();
    expect(session.processedRows()).not.toBe(processed);
  });

  it('flat grid with no filter/sort passes the data array straight through', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class FlatHost {
      readonly rows = signal<readonly Person[]>([{ id: 1, name: 'Ada', city: 'London' }]);
      readonly grid = createGrid<Person>({ columns, rowId: (r) => r.id, viewport: { virtual: false } });
    }
    const { host, session } = await mount(FlatHost);
    expect(session.processedRows()).toBe(host.rows());
  });
});
