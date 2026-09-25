import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DataGrid } from './data-grid';
import { DataGridFilterField } from '../chrome/data-grid-filter-field';
import { createGrid } from '../../create-grid';
import type { ColumnDef } from './data-grid.types';

interface Person {
  id: number;
  name: string;
  city: string;
}

const people: Person[] = [
  { id: 1, name: 'Ada', city: 'Oslo' },
  { id: 2, name: 'Grace', city: 'Bergen' },
  { id: 3, name: 'Alan', city: 'Oslo' },
];

describe('DataGrid layout / selection bindings', () => {
  it('floating set filters bind memoized options; other filters get none', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class Host {
      readonly rows = signal(people);
      readonly grid = createGrid({
        columns: [
          { field: 'name', filter: 'text' },
          { field: 'city', filter: 'set' },
        ] as ColumnDef<Person>[],
        rowId: (r: Person) => r.id,
        chrome: { floatingFilters: true },
        viewport: { virtual: false, pagination: false },
      });
    }
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const fields = () =>
      fixture.debugElement
        .queryAll(By.directive(DataGridFilterField))
        .map((d) => d.componentInstance as DataGridFilterField);
    const [text, set] = fields();
    const before = set!.setOptions();
    expect(before).toEqual(['Bergen', 'Oslo']);
    expect(text!.setOptions()).toEqual([]);

    fixture.detectChanges();
    expect(fields()[1]!.setOptions()).toBe(before);
  });

  it('header checkbox reflects selectable rows across pages (selectAll: filtered)', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class Host {
      readonly rows = signal(people);
      readonly grid = createGrid({
        columns: [{ field: 'name' }] as ColumnDef<Person>[],
        rowId: (r: Person) => r.id,
        selection: 'multi',
        isRowSelectable: (r: Person) => r.id !== 3,
        viewport: { virtual: false, pagination: true, pageSize: 1 },
      });
    }
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const grid = fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Person>;

    const box = () =>
      fixture.nativeElement.querySelector('[data-testid="al-dg-select-all"]') as HTMLInputElement;
    box().click();
    fixture.detectChanges();
    expect(grid.api.getSelectedIds()).toEqual([1, 2]);
    expect(box().checked).toBe(true);
    expect(box().indeterminate).toBe(false);

    grid.api.setSelectedIds([2]);
    fixture.detectChanges();
    expect(box().checked).toBe(false);
    expect(box().indeterminate).toBe(true);
  });
});
