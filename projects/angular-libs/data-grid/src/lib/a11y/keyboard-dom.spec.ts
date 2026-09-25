/**
 * DOM integration: keyboard scoping (K1), Escape scoping (K2), menu focus (K3),
 * focus follows row (K4), and Tab re-entry through the frame (K5).
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DataGrid } from '../components/data-grid/data-grid';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import type { DataGridToolbarSlotItem } from '../plugins/types';
import { createGrid } from '../create-grid';

interface Person {
  id: number;
  name: string;
  age: number;
  active: boolean;
}

const people: Person[] = [
  { id: 1, name: 'Ada', age: 36, active: true },
  { id: 2, name: 'Grace', age: 42, active: false },
  { id: 3, name: 'Alan', age: 41, active: true },
  { id: 4, name: 'Linus', age: 30, active: false },
];

const columns: ColumnDef<Person>[] = [
  { field: 'name', editable: true },
  { field: 'age', editable: true, type: 'number', sortable: true },
  { field: 'active', type: 'boolean', editable: true },
];

@Component({
  imports: [DataGrid],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [loading]="loading()"
      [toolbarActions]="actions"
    />
  `,
})
class KeyboardHost {
  readonly rows = signal(people.map((p) => ({ ...p })));
  readonly loading = signal(false);
  readonly clicks: string[] = [];
  readonly actions: DataGridToolbarSlotItem[] = [
    { id: 'go', icon: '▶', ariaLabel: 'Go', actionClick: () => void this.clicks.push('go') },
  ];
  readonly grid = createGrid({
    columns,
    rowId: (r: Person) => r.id,
    selection: 'multi',
    editMode: 'cell',
    viewport: { virtual: false, pagination: true, pageSize: 3 },
    chrome: { contextMenu: true },
  });
}

function keydown(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await Promise.resolve();
  fixture.detectChanges();
}

describe('DataGrid keyboard DOM integration', () => {
  let fixture: ComponentFixture<KeyboardHost>;
  let grid: DataGrid<Person>;
  let el: HTMLElement;
  const q = (sel: string) => el.querySelector(sel) as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [KeyboardHost] }).compileComponents();
    fixture = TestBed.createComponent(KeyboardHost);
    await settle(fixture);
    grid = fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Person>;
    el = fixture.nativeElement;
    document.body.appendChild(el);
  });

  afterEach(() => el.remove());

  it('K1: Enter / Space on pager and toolbar buttons do not trigger grid actions', async () => {
    grid.api.focusCell(0, 'age');
    await settle(fixture);

    const next = [...el.querySelectorAll<HTMLButtonElement>('.al-data-grid__page-btn')].at(-1)!;
    const tool = q('[data-testid="al-dg-toolbar-action-go"]');
    for (const target of [next, tool]) {
      expect(keydown(target, 'Enter').defaultPrevented).toBe(false);
      expect(keydown(target, ' ').defaultPrevented).toBe(false);
      expect(keydown(target, 'x').defaultPrevented).toBe(false);
      expect(keydown(target, 'ArrowDown').defaultPrevented).toBe(false);
    }
    await settle(fixture);
    expect(grid.editSyncHost.editingCell()).toBeNull();
    expect(grid.api.getSelectedIds()).toEqual([]);
    expect(grid.api.getFocusedCell()).toMatchObject({ rowIndex: 0, columnId: 'age' });

    // Same keys on the grid's own cell still drive the grid.
    const cell = q('[data-testid="al-dg-cell-1-age"]');
    expect(keydown(cell, 'ArrowDown').defaultPrevented).toBe(true);
    expect(grid.api.getFocusedCell()).toMatchObject({ rowIndex: 1, columnId: 'age' });
  });

  it('K2: Escape outside the grid does not cancel an edit', async () => {
    grid.api.startEditingCell(1, 'age');
    await settle(fixture);
    expect(grid.editSyncHost.editingCell()).not.toBeNull();

    // App search box outside the grid (not focused: cell edits commit on blur).
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    const event = keydown(outside, 'Escape');
    await settle(fixture);
    expect(event.defaultPrevented).toBe(false);
    expect(grid.editSyncHost.editingCell()).not.toBeNull();
    outside.remove();
  });

  it('K3: Enter in the column menu stays in the menu; activating an item returns focus', async () => {
    grid.api.focusCell(0, 'age');
    await settle(fixture);
    grid.session.kernel.focus.focusCell(0, 'age', 'header');
    await settle(fixture);
    const header = q('[data-testid="al-dg-col-age"]');
    expect(document.activeElement).toBe(header);

    keydown(header, 'ArrowDown', { altKey: true });
    await settle(fixture);
    const first = q('[data-testid="al-dg-ctx-sort-asc"]');
    expect(document.activeElement).toBe(first);

    const pinLeft = q('[data-testid="al-dg-ctx-pin-left"]');
    pinLeft.focus();
    const enter = keydown(pinLeft, 'Enter');
    expect(enter.defaultPrevented).toBe(false);
    expect(grid.api.getSortModel()).toEqual([]);
    pinLeft.click();
    await settle(fixture);

    expect(grid.api.getColumnPinned('age')).toBe('left');
    expect(q('[data-testid="al-dg-context-menu"]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-testid="al-dg-col-age"]'));
  });

  it('K3: Tab closes the menu and returns focus to the invoker', async () => {
    grid.session.kernel.focus.focusCell(0, 'name', 'header');
    await settle(fixture);
    grid.api.openColumnMenu('name');
    await settle(fixture);
    expect(document.activeElement?.closest('[data-testid="al-dg-context-menu"]')).toBeTruthy();

    keydown(document.activeElement!, 'Tab');
    await settle(fixture);
    expect(q('[data-testid="al-dg-context-menu"]')).toBeNull();
    expect(document.activeElement).toBe(q('[data-testid="al-dg-col-name"]'));
  });

  it('K4: focus follows the row after a sort', async () => {
    grid.api.focusCell(0, 'name');
    await settle(fixture);
    expect(document.activeElement).toBe(q('[data-testid="al-dg-cell-1-name"]'));

    grid.api.setSortModel([{ columnId: 'age', direction: 'desc' }]);
    await settle(fixture);

    // Ada (36) is the last of the first page when sorted by age desc: 42, 41, 36.
    expect(grid.api.getFocusedCell()).toMatchObject({ rowIndex: 2, columnId: 'name' });
    const ada = q('[data-testid="al-dg-cell-1-name"]');
    expect(ada.getAttribute('tabindex')).toBe('0');
    expect(ada.classList.contains('al-data-grid__td--focused')).toBe(true);
    expect(document.activeElement).toBe(ada);
  });

  it('K4: re-anchoring does not steal focus from outside the grid', async () => {
    grid.api.focusCell(0, 'name');
    await settle(fixture);
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    grid.api.setSortModel([{ columnId: 'age', direction: 'desc' }]);
    await settle(fixture);
    expect(grid.api.getFocusedCell()).toMatchObject({ rowIndex: 2 });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('K5: the frame is the tab stop while the focused cell is not rendered', async () => {
    const frame = q('[data-testid="al-dg-frame"]');
    expect(frame.getAttribute('tabindex')).toBe('0');

    grid.api.focusCell(1, 'name');
    await settle(fixture);
    expect(frame.getAttribute('tabindex')).toBe('-1');

    fixture.componentInstance.loading.set(true);
    await settle(fixture);
    expect(frame.getAttribute('tabindex')).toBe('0');
    expect(frame.querySelectorAll('[tabindex="0"]').length).toBe(0);

    fixture.componentInstance.loading.set(false);
    await settle(fixture);
    expect(frame.getAttribute('tabindex')).toBe('-1');

    // Tab re-entry: focusing the frame restores the last cell.
    grid.session.kernel.focus.setFocus(null);
    await settle(fixture);
    expect(frame.getAttribute('tabindex')).toBe('0');
    frame.focus();
    await settle(fixture);
    expect(grid.api.getFocusedCell()).toMatchObject({ rowIndex: 1, columnId: 'name' });
    expect(document.activeElement).toBe(q('[data-testid="al-dg-cell-2-name"]'));
  });
});
