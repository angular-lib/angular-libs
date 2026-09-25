import { Component, signal, type Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataGrid } from '../components/data-grid/data-grid';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { createGrid } from '../create-grid';
import type { EditInteractionInput } from './edit-interaction';
import { isTypeToEditKey } from './edit-interaction';

interface Person {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const seed = (): Person[] => [
  { id: 1, name: 'Ada', age: 36, active: true },
  { id: 2, name: 'Grace', age: 42, active: false },
  { id: 3, name: 'Alan', age: 41, active: true },
];

const columns: ColumnDef<Person>[] = [
  { field: 'id' },
  { field: 'name', editable: true },
  { field: 'age', type: 'number', editable: true },
  { field: 'active', type: 'boolean', editable: true },
];

function hostFor(editMode: 'cell' | 'fullRow', editInteraction: EditInteractionInput) {
  @Component({
    imports: [DataGrid],
    template: `<al-data-grid [controller]="grid" [data]="rows()" [locale]="locale" />`,
  })
  class EditHost {
    readonly rows = signal(seed());
    readonly locale = { numberLocale: 'nb-NO' };
    readonly grid = createGrid({
      columns,
      rowId: (r: Person) => r.id,
      rows: this.rows,
      editMode,
      editInteraction,
      viewport: { virtual: false, pagination: false },
    });
  }
  return EditHost;
}

async function mount<H>(cls: Type<H>): Promise<{ fixture: ComponentFixture<H>; grid: DataGrid<Person> }> {
  await TestBed.configureTestingModule({ imports: [cls] }).compileComponents();
  const fixture = TestBed.createComponent(cls);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const grid = fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Person>;
  return { fixture, grid };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
}

function editorIn(fixture: ComponentFixture<unknown>, rowId: number, columnId: string): HTMLInputElement {
  return fixture.nativeElement.querySelector(
    `[data-testid="al-dg-cell-${rowId}-${columnId}"] .al-data-grid__edit-input`,
  ) as HTMLInputElement;
}

function typeInto(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function cell(fixture: ComponentFixture<unknown>, rowId: number, columnId: string): HTMLElement {
  return fixture.nativeElement.querySelector(`[data-testid="al-dg-cell-${rowId}-${columnId}"]`);
}

describe('cell editing interaction', () => {
  it('type-to-edit keeps the seed and puts the caret after it', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'default'));
    grid.api.focusCell(0, 'name');
    await settle(fixture);
    const gridEl = fixture.debugElement.query(By.directive(DataGrid)).nativeElement as HTMLElement;
    gridEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', bubbles: true, cancelable: true }));
    await settle(fixture);
    const editor = editorIn(fixture, 1, 'name');
    expect(editor.value).toBe('H');
    expect(document.activeElement).toBe(editor);
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([1, 1]);
  });

  it('F2 / API start still selects the whole value', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'default'));
    grid.api.startEditingCell(1, 'name');
    await settle(fixture);
    const editor = editorIn(fixture, 1, 'name');
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, 3]);
  });

  it('excel: clicking another cell commits the open edit before switching', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'excel'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingCell(1, 'name');
    await settle(fixture);
    typeInto(editorIn(fixture, 1, 'name'), 'Zed');
    cell(fixture, 2, 'name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(host.rows()[0]!.name).toBe('Zed');
    expect(grid.editSyncHost.editingCell()).toEqual({ rowId: 2, columnId: 'name' });

    typeInto(editorIn(fixture, 2, 'name'), 'Hopper');
    grid.api.startEditingCell(3, 'name');
    await settle(fixture);
    expect(host.rows()[1]!.name).toBe('Hopper');
  });

  it('default preset: clicking elsewhere commits too', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'default'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingCell(1, 'name');
    await settle(fixture);
    typeInto(editorIn(fixture, 1, 'name'), 'Zed');
    cell(fixture, 3, 'age').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(host.rows()[0]!.name).toBe('Zed');
    expect(grid.editSyncHost.editingCell()).toBeNull();
  });

  it('excel: a single click on a boolean cell does not toggle it', async () => {
    const { fixture } = await mount(hostFor('cell', 'excel'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    cell(fixture, 1, 'active').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(host.rows()[0]!.active).toBe(true);
  });

  it('number editor is a decimal text input parsed with the grid locale', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'default'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingCell(1, 'age');
    await settle(fixture);
    const editor = editorIn(fixture, 1, 'age');
    expect(editor.type).toBe('text');
    expect(editor.getAttribute('inputmode')).toBe('decimal');
    typeInto(editor, '1,5');
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await settle(fixture);
    expect(host.rows()[0]!.age).toBe(1.5);
  });

  it('invalid number keeps the editor open, marks it invalid, and blocks switching', async () => {
    const { fixture, grid } = await mount(hostFor('cell', 'excel'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingCell(2, 'age');
    await settle(fixture);
    typeInto(editorIn(fixture, 2, 'age'), 'abc');
    editorIn(fixture, 2, 'age').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await settle(fixture);
    expect(grid.editSyncHost.editingCell()).toEqual({ rowId: 2, columnId: 'age' });
    expect(editorIn(fixture, 2, 'age').getAttribute('aria-invalid')).toBe('true');
    expect(host.rows()[1]!.age).toBe(42);

    cell(fixture, 3, 'name').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle(fixture);
    expect(grid.editSyncHost.editingCell()).toEqual({ rowId: 2, columnId: 'age' });
    expect(host.rows()[1]!.age).toBe(42);
  });
});

describe('fullRow row switching', () => {
  it('commits the open row by default', async () => {
    const { fixture, grid } = await mount(hostFor('fullRow', 'default'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingRow(1);
    await settle(fixture);
    typeInto(editorIn(fixture, 1, 'name'), 'Ann');
    grid.api.startEditingRow(2);
    await settle(fixture);
    expect(host.rows()[0]!.name).toBe('Ann');
    expect(grid.editSyncHost.rowEditMgr.editingId()).toBe(2);
  });

  it('stays on a row with unparseable number text', async () => {
    const { fixture, grid } = await mount(hostFor('fullRow', 'default'));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingRow(2);
    await settle(fixture);
    const age = editorIn(fixture, 2, 'age');
    expect(age.type).toBe('text');
    typeInto(age, '4,5');
    expect(grid.editSyncHost.rowTextDrafts.error('age')).toBeNull();
    typeInto(age, 'abc');
    await settle(fixture);
    expect(age.getAttribute('aria-invalid')).toBe('true');
    grid.api.startEditingRow(3);
    await settle(fixture);
    expect(grid.editSyncHost.rowEditMgr.editingId()).toBe(2);

    typeInto(age, '4,5');
    expect(grid.editSyncHost.commitRowEdit()).toBe(true);
    expect(host.rows()[1]!.age).toBe(4.5);
  });

  it("rowSwitch: 'cancel' discards the open row", async () => {
    const { fixture, grid } = await mount(hostFor('fullRow', { rowSwitch: 'cancel' }));
    const host = fixture.componentInstance as { rows: () => Person[] };
    grid.api.startEditingRow(1);
    await settle(fixture);
    typeInto(editorIn(fixture, 1, 'name'), 'Ann');
    grid.api.startEditingRow(2);
    await settle(fixture);
    expect(host.rows()[0]!.name).toBe('Ada');
    expect(grid.editSyncHost.rowEditMgr.editingId()).toBe(2);
  });

  it("rowSwitch: 'block' refuses to switch", async () => {
    const { fixture, grid } = await mount(hostFor('fullRow', { rowSwitch: 'block' }));
    grid.api.startEditingRow(1);
    await settle(fixture);
    grid.api.startEditingRow(2);
    await settle(fixture);
    expect(grid.editSyncHost.rowEditMgr.editingId()).toBe(1);
  });
});

describe('isTypeToEditKey', () => {
  it('accepts AltGr chars and rejects shortcuts / IME composition', () => {
    const altGr = new KeyboardEvent('keydown', { key: '@', ctrlKey: true, altKey: true });
    Object.defineProperty(altGr, 'getModifierState', { value: (k: string) => k === 'AltGraph' });
    expect(isTypeToEditKey(altGr)).toBe(true);
    expect(isTypeToEditKey(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))).toBe(false);
    expect(isTypeToEditKey(new KeyboardEvent('keydown', { key: 'a', isComposing: true }))).toBe(false);
  });
});

describe('cell range with string ids', () => {
  it('drag-select starts on numeric-looking string row ids', async () => {
    const { cellRangePlugin, CELL_RANGE_ADAPTER } = await import('@angular-libs/data-grid/plugins');
    interface Item {
      id: string;
      name: string;
    }

    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
    })
    class StringIdHost {
      readonly rows = signal<Item[]>([
        { id: '12', name: 'a' },
        { id: '000123', name: 'b' },
      ]);
      readonly grid = createGrid<Item>({
        columns: [{ field: 'name' }],
        rowId: (r) => r.id,
        viewport: { virtual: false, pagination: false },
        plugins: [cellRangePlugin<Item>()],
      });
    }

    await TestBed.configureTestingModule({ imports: [StringIdHost] }).compileComponents();
    const fixture = TestBed.createComponent(StringIdHost);
    await settle(fixture);
    const proto = HTMLElement.prototype as unknown as { setPointerCapture?: unknown };
    const hadCapture = 'setPointerCapture' in proto;
    if (!hadCapture) {
      proto.setPointerCapture = () => undefined;
    }
    try {
      for (const id of ['12', '000123']) {
        const td = fixture.nativeElement.querySelector(
          `.al-data-grid__td[data-row-id="${id}"][data-column-id="name"]`,
        ) as HTMLElement;
        td.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
        const range = fixture.componentInstance.grid.api()!.getAdapter(CELL_RANGE_ADAPTER)?.getRange() ?? null;
        expect(range?.anchor.columnId).toBe('name');
        td.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
      }
    } finally {
      if (!hadCapture) {
        delete proto.setPointerCapture;
      }
    }
  });
});
