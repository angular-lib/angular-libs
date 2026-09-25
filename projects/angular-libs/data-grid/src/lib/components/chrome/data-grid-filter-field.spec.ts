import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { DataGrid } from '../data-grid/data-grid';
import { createGrid, type GridChromeOptions } from '../../create-grid';
import type { ColumnDef } from '../data-grid/data-grid.types';
import { sideBarPlugin } from '@angular-libs/data-grid/plugins';

interface Person {
  id: number;
  name: string;
  age: number | null;
  status: string;
  joined: string;
}

const people: Person[] = [
  { id: 1, name: 'Ada', age: 36, status: 'A', joined: '2024-05-01' },
  { id: 2, name: 'Grace', age: 0, status: 'I', joined: '2024-05-02' },
  { id: 3, name: 'Alan', age: null, status: 'A', joined: '2024-05-03' },
  { id: 4, name: 'Linus', age: 150, status: '', joined: '2024-05-04' },
];

const columns: ColumnDef<Person>[] = [
  { field: 'name', filter: true },
  { field: 'age', type: 'number', filter: true },
  { field: 'status', filter: 'set', valueFormatter: (v) => (v === 'A' ? 'Active' : v ? 'Inactive' : '') },
  // Explicit text filter on a date-typed column: UI and logic must agree.
  { field: 'joined', type: 'date', filter: 'text' },
];

async function render(
  chrome: GridChromeOptions = {},
  extra: { sideBar?: boolean; cols?: ColumnDef<Person>[] } = {},
) {
  @Component({
    imports: [DataGrid],
    template: `<al-data-grid [controller]="grid" [data]="rows()" />`,
  })
  class Host {
    readonly rows = signal(people);
    readonly grid = createGrid({
      columns: extra.cols ?? columns,
      rowId: (r: Person) => r.id,
      viewport: { virtual: false },
      chrome: { floatingFilters: true, filterDebounceMs: 0, ...chrome },
      plugins: extra.sideBar ? [sideBarPlugin<Person>({ panels: ['filters'], defaultPanel: 'filters' })] : [],
    });
  }
  await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const api = () => fixture.componentInstance.grid.api()!;
  const bodyIds = () =>
    [...el.querySelectorAll<HTMLElement>('[data-row-id]')]
      .map((r) => r.getAttribute('data-row-id'))
      .filter((v, i, a) => a.indexOf(v) === i);
  return { fixture, el, api, bodyIds };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DataGridFilterField (F1)', () => {
  it('debounces typed text; the model is written once after the delay', async () => {
    const { fixture, el, api } = await render({ filterDebounceMs: 40 });
    const input = el.querySelector<HTMLInputElement>(
      '[data-testid="al-dg-filter-name"] [data-testid="al-dg-filter-field-text"]',
    )!;
    type(input, 'A');
    type(input, 'Ad');
    await settle(fixture);
    expect(api().getFilterModel()).toEqual({});
    await new Promise((r) => setTimeout(r, 80));
    await settle(fixture);
    expect(api().getFilterModel()).toEqual({
      name: { kind: 'text', conditions: [{ op: 'contains', value: 'Ad' }] },
    });
    expect(input.value).toBe('Ad');
  });

  it('Enter flushes a pending edit immediately', async () => {
    const { fixture, el, api } = await render({ filterDebounceMs: 10_000 });
    const input = el.querySelector<HTMLInputElement>(
      '[data-testid="al-dg-filter-name"] [data-testid="al-dg-filter-field-text"]',
    )!;
    type(input, 'Gr');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    expect(api().getColumnFilter('name')).toEqual({
      kind: 'text',
      conditions: [{ op: 'contains', value: 'Gr' }],
    });
  });

  it('number shorthand drives the operator; junk is aria-invalid and clears the filter', async () => {
    const { fixture, el, api } = await render();
    const cell = el.querySelector<HTMLElement>('[data-testid="al-dg-filter-age"]')!;
    const input = cell.querySelector<HTMLInputElement>('[data-testid="al-dg-filter-field-text"]')!;
    const op = cell.querySelector<HTMLSelectElement>('[data-testid="al-dg-filter-field-op"]')!;
    expect(input.type).toBe('text');

    type(input, '>=36');
    await settle(fixture);
    expect(api().getColumnFilter('age')).toEqual({
      kind: 'number',
      conditions: [{ op: 'greaterThanOrEqual', value: 36 }],
    });
    expect(op.value).toBe('greaterThanOrEqual');
    expect(input.value).toBe('>=36');

    type(input, '0');
    op.value = 'equals';
    op.dispatchEvent(new Event('change'));
    await settle(fixture);
    // `0` matches the 0 row only — never null.
    expect(api().getProcessedRows().map((r) => r.id)).toEqual([2]);

    type(input, '>abc');
    await settle(fixture);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(api().getColumnFilter('age')).toBeNull();

    type(input, '1..100');
    await settle(fixture);
    expect(api().getColumnFilter('age')).toEqual({
      kind: 'number',
      conditions: [{ op: 'inRange', value: 1, valueTo: 100 }],
    });
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('blank operator needs no value; floating control follows resolveFilterKind', async () => {
    const { fixture, el, api } = await render();
    const joined = el.querySelector<HTMLElement>('[data-testid="al-dg-filter-joined"]')!;
    // `{ type: 'date', filter: 'text' }` → text control, not a date picker.
    expect(joined.querySelector('[data-testid="al-dg-filter-field-date"]')).toBeNull();
    expect(joined.querySelector('[data-testid="al-dg-filter-field-text"]')).toBeTruthy();

    const op = el.querySelector<HTMLSelectElement>(
      '[data-testid="al-dg-filter-age"] [data-testid="al-dg-filter-field-op"]',
    )!;
    op.value = 'blank';
    op.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(api().getColumnFilter('age')).toEqual({ kind: 'number', conditions: [{ op: 'blank' }] });
    expect(
      el.querySelector('[data-testid="al-dg-filter-age"] [data-testid="al-dg-filter-field-text"]'),
    ).toBeNull();
  });

  it('text column filter matches valueFormatter output (like the quick filter)', async () => {
    const { fixture, api } = await render({}, {
      cols: [{ field: 'status', filter: 'text', valueFormatter: (v) => (v === 'A' ? 'Active' : 'Inactive') }],
    });
    api().setColumnFilter('status', { kind: 'text', conditions: [{ op: 'startsWith', value: 'act' }] });
    await settle(fixture);
    expect(api().getProcessedRows().map((r) => r.id)).toEqual([1, 3]);
  });

  it('set filter: all checked by default, search, select-all, blanks, count, light dismiss', async () => {
    const { fixture, el, api } = await render();
    const cell = el.querySelector<HTMLElement>('[data-testid="al-dg-filter-status"]')!;
    const trigger = cell.querySelector<HTMLButtonElement>('[data-testid="al-dg-set-filter-trigger"]')!;
    expect(trigger.textContent).toContain('All');
    expect(trigger.getAttribute('aria-label')).toContain('status');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    await settle(fixture);
    const popup = cell.querySelector<HTMLElement>('[data-testid="al-dg-set-filter-popup"]')!;
    expect(popup).toBeTruthy();
    const labels = () =>
      [...popup.querySelectorAll<HTMLLabelElement>('.al-dg-filter-field__set-item')].map((l) =>
        l.textContent!.trim(),
      );
    expect(labels()).toEqual(['(Select all)', 'Active', 'Inactive', '(Blanks)']);
    const boxes = () => [...popup.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(boxes().every((b) => b.checked)).toBe(true);

    // Uncheck "Inactive" → include-list of the rest.
    boxes()[2]!.click();
    await settle(fixture);
    expect(api().getColumnFilter('status')).toEqual({ kind: 'set', values: ['A', null] });
    expect(trigger.textContent).toContain('2 selected');

    // Search narrows the list.
    type(popup.querySelector<HTMLInputElement>('[data-testid="al-dg-set-filter-search"]')!, 'act');
    await settle(fixture);
    expect(labels()).toEqual(['(Select all)', 'Active', 'Inactive']);

    // Escape closes and returns focus to the trigger.
    popup.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle(fixture);
    expect(cell.querySelector('[data-testid="al-dg-set-filter-popup"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    // Outside pointerdown closes too.
    trigger.click();
    await settle(fixture);
    expect(cell.querySelector('[data-testid="al-dg-set-filter-popup"]')).toBeTruthy();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle(fixture);
    expect(cell.querySelector('[data-testid="al-dg-set-filter-popup"]')).toBeNull();

    // Select all again → filter removed.
    trigger.click();
    await settle(fixture);
    cell.querySelector<HTMLInputElement>('[data-testid="al-dg-set-filter-select-all"]')!.click();
    await settle(fixture);
    expect(api().getColumnFilter('status')).toBeNull();
  });

  it('floating filter shows a read-only summary for two-condition models', async () => {
    const { fixture, el, api } = await render();
    api().setColumnFilter('name', {
      kind: 'text',
      conditions: [
        { op: 'startsWith', value: 'a' },
        { op: 'endsWith', value: 'n' },
      ],
      join: 'or',
    });
    await settle(fixture);
    const summary = el.querySelector<HTMLInputElement>(
      '[data-testid="al-dg-filter-name"] [data-testid="al-dg-filter-field-summary"]',
    )!;
    expect(summary.readOnly).toBe(true);
    expect(summary.value).toBe('Starts with a OR Ends with n');
  });

  it('filters panel: second condition with OR join', async () => {
    const { fixture, el, api } = await render({}, { sideBar: true });
    const add = el.querySelector<HTMLSelectElement>('[data-testid="al-dg-filters-add"]')!;
    add.value = 'name';
    add.dispatchEvent(new Event('change'));
    await settle(fixture);
    const card = el.querySelector<HTMLElement>('[data-testid="al-dg-filter-card-name"]')!;
    type(card.querySelector<HTMLInputElement>('[data-testid="al-dg-filter-field-text"]')!, 'Ada');
    await settle(fixture);
    card.querySelector<HTMLInputElement>('[data-testid="al-dg-filter-join-or"]')!.click();
    type(card.querySelector<HTMLInputElement>('[data-testid="al-dg-filter-field-text-1"]')!, 'Linus');
    await settle(fixture);
    expect(api().getColumnFilter('name')).toEqual({
      kind: 'text',
      conditions: [
        { op: 'contains', value: 'Ada' },
        { op: 'contains', value: 'Linus' },
      ],
      join: 'or',
    });
    expect(api().getProcessedRows().map((r) => r.id)).toEqual([1, 4]);
  });

  it('toolbar quick filter is debounced; words AND across columns', async () => {
    const { fixture, el, api } = await render({ filterDebounceMs: 30, showToolbar: true });
    const quick = el.querySelector<HTMLInputElement>('[data-testid="al-dg-toolbar-quick-filter"]')!;
    type(quick, 'ada active');
    await settle(fixture);
    expect(api().getQuickFilter()).toBe('');
    await new Promise((r) => setTimeout(r, 60));
    await settle(fixture);
    expect(api().getQuickFilter()).toBe('ada active');
    expect(api().getProcessedRows().map((r) => r.id)).toEqual([1]);
  });
});
