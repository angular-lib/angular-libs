import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DataGrid } from './data-grid';
import { DataGridCellDirective } from '../../data-grid-cell.directive';
import type { ColumnDef, ColumnOrGroupDef } from './data-grid.types';
import { filterRows, quickFilterRows, toDateKey } from '../../utils/filter-rows';
import { sortRows, nextSortDirection } from '../../utils/sort-rows';
import { resolveColumns, getCellValue, formatCellValue, moveItem } from '../../utils/cell-value';
import { rowsToCsv } from '../../utils/csv';
import { collectFindMatches, splitFindHighlight } from '../../utils/find';
import { cloneRowDraft } from '../../utils/row-edit';
import { applyCellEdit } from '../../utils/apply-edit';
import {
  resolveColumnTracks,
  resolveColumnWidths,
  reconcileColumnOrder,
  reconcileHiddenColumnIds,
} from '../../utils/column-layout';
import { FocusController } from '../../controllers/focus';
import { FindController } from '../../controllers/find';
import { activatePlugins, dedupePlugins, notifyPlugins } from '../../plugins/types';
import { parseGridState, serializeGridState } from '../../utils/state';
import { flattenColumnDefs, buildLeafGroupMap, buildVisibleGroupHeaderRow, resolveColumnOrGroupDefs, sameColumnGroup } from '../../utils/column-groups';
import { parseSetFilter, serializeSetFilter } from '../../utils/filter-rows';
import { parseClipboardMatrix } from '../../utils/clipboard-paste';
import {
  findPlugin,
  rowGroupPlugin,
  sideBarPlugin,
  statusBarPlugin,
  treeDataPlugin,
} from '@angular-libs/data-grid/plugins';
import { createGrid } from '../../create-grid';
import { runClientRowPipeline } from '../../utils/row-pipeline';
import { buildDisplayRows, collectTreeGroupIds } from '../../utils/row-display';
import { coerceCellEditValue } from '../../utils/coerce-cell-value';
import { collectAllGroupIds } from '../../utils/collect-group-ids';
import {
  attachRowReorder,
  buildRowReorderEvent,
  isRowDragAllowed,
  resolveRowDropDataIndex,
} from '../../utils/row-interactions';
import { moveColumn, materializeColumnLayout, partitionColumnsByPin, setColumnPin, emptyColumnLayout, reconcileColumnLayout } from '../../utils/column-layout';
import { formatAggregateValue } from '../../utils/editors';
import { computeVirtualWindow } from '../../controllers/virtual-window';
import { vi } from 'vitest';

interface Person {
  id: number;
  name: string;
  age: number;
  city: string;
  active: boolean;
  path?: string[];
}

const people: Person[] = [
  { id: 1, name: 'Ada', age: 36, city: 'London', active: true, path: ['UK', 'London'] },
  { id: 2, name: 'Grace', age: 42, city: 'New York', active: false, path: ['US', 'New York'] },
  { id: 3, name: 'Alan', age: 41, city: 'Manchester', active: true, path: ['UK', 'Manchester'] },
];

const columns: ColumnDef<Person>[] = [
  { field: 'name', filter: true },
  { field: 'age', filter: 'number', editable: true, type: 'number' },
  { field: 'city', header: 'City' },
  { field: 'active', type: 'boolean', filter: 'boolean', editable: true },
];

describe('data-grid utils', () => {
  it('resolves columns and reads values', () => {
    const resolved = resolveColumns(columns);
    expect(resolved[0]!.id).toBe('name');
    expect(getCellValue(people[0]!, resolved[0]!, 0)).toBe('Ada');
    expect(
      formatCellValue(1000, people[0]!, {
        field: 'age',
        valueFormatter: (v) => `$${v}`,
      }, 0),
    ).toBe('$1000');
  });

  it('filters, quick-filters, and sorts rows', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const filtered = filterRows(people, { name: 'a' }, byId);
    expect(filtered.map((p) => p.name)).toEqual(['Ada', 'Grace', 'Alan']);

    const quick = quickFilterRows(people, 'york', resolved);
    expect(quick.map((p) => p.name)).toEqual(['Grace']);

    const sorted = sortRows(people, [{ columnId: 'age', direction: 'asc' }], byId);
    expect(sorted.map((p) => p.age)).toEqual([36, 41, 42]);
  });

  it('exports csv and round-trips state', () => {
    const csv = rowsToCsv(people, resolveColumns(columns));
    expect(csv.split('\n')[0]).toContain('name');
    expect(csv).toContain('Ada');

    const raw = serializeGridState({
      sorts: [{ columnId: 'age', direction: 'desc' }],
      filters: { name: 'Ada' },
      quickFilter: 'x',
      hiddenColumnIds: ['city'],
      columnOrder: ['age', 'name'],
      widthOverrides: { name: 120 },
      columnPins: { name: 'left' },
      pageIndex: 1,
      activeSidePanel: 'filters',
    });
    const parsed = parseGridState(raw);
    expect(parsed?.hiddenColumnIds).toEqual(['city']);
    expect(parsed?.columnPins).toEqual({ name: 'left' });
    expect(parsed?.activeSidePanel).toBe('filters');
  });

  it('finds and highlights matching cells', () => {
    const resolved = resolveColumns(columns);
    const matches = collectFindMatches(people, resolved, 'york', {
      rowId: (row) => row.id,
    });
    expect(matches).toEqual([{ rowId: 2, rowIndex: 1, columnId: 'city' }]);

    const parts = splitFindHighlight('New York', 'yor');
    expect(parts).toEqual([
      { text: 'New ', match: false },
      { text: 'Yor', match: true },
      { text: 'k', match: false },
    ]);
  });

  it('clones row drafts for signal forms', () => {
    const draft = cloneRowDraft(people[0]!);
    expect(draft).toEqual(people[0]);
    expect(draft).not.toBe(people[0]);
    draft.name = 'Changed';
    expect(people[0]!.name).toBe('Ada');
  });

  it('applies cell edits immutably and resolves flex widths', () => {
    const cols = resolveColumns<Person>([
      { field: 'name', width: 100 },
      { field: 'city', flex: 1, minWidth: 80 },
    ]);
    const widths = resolveColumnWidths(cols, {}, 400, 0);
    expect(widths['name']).toBe(100);
    expect(widths['city']).toBe(300);

    const { tracks, widthsPx } = resolveColumnTracks(cols, {}, { select: true });
    expect(tracks).toBe('40px 100px minmax(80px, 1fr)');
    expect(widthsPx['name']).toBe(100);
    expect(widthsPx['city']).toBeNull();

    const next = applyCellEdit(
      people,
      {
        row: people[0]!,
        rowId: 1,
        column: cols[0]!,
        columnId: 'name',
        previousValue: 'Ada',
        value: 'Augusta',
      },
      (row) => row.id,
    );
    expect(next[0]!.name).toBe('Augusta');
    expect(people[0]!.name).toBe('Ada');
  });

  it('normalizes dates and navigates focus', () => {
    expect(toDateKey('2024-05-01T12:00:00.000Z')).toBe('2024-05-01');
    // Local calendar date — not UTC ISO day (avoids TZ off-by-one for date inputs).
    const localMay2 = new Date(2024, 4, 2);
    expect(toDateKey(localMay2)).toBe('2024-05-02');
    expect(toDateKey('2024-05-02')).toBe('2024-05-02');

    const focus = new FocusController({
      getRowCount: () => 3,
      getColumnIds: () => ['name', 'age'],
    });
    focus.focusCell(1, 'name');
    expect(focus.move(0, 1)).toEqual({ rowIndex: 1, columnId: 'age', realm: 'body' });
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(true);
    expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'age', realm: 'body' });
  });

  it('bridges body focus into header realm on ArrowUp from row 0', () => {
    const headers: string[] = [];
    const focus = new FocusController({
      getRowCount: () => 2,
      getColumnIds: () => ['name', 'age'],
      onHeaderActivate: (id) => headers.push(id),
      onOpenColumnMenu: (id) => headers.push(`menu:${id}`),
    });
    focus.focusCell(0, 'name');
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))).toBe(true);
    expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'name', realm: 'header' });
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(headers).toEqual(['name']);
    expect(
      focus.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true })),
    ).toBe(true);
    expect(headers).toEqual(['name', 'menu:name']);
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).toBe(true);
    expect(focus.getFocus()?.realm).toBe('body');
  });

  it('restores last focus for Tab re-entry', () => {
    const focus = new FocusController({
      getRowCount: () => 3,
      getColumnIds: () => ['name', 'age'],
    });
    focus.focusCell(2, 'age');
    focus.setFocus(null);
    expect(focus.restoreOrFocusDefault()).toEqual({
      rowIndex: 2,
      columnId: 'age',
      realm: 'body',
    });
  });

  it('dedupes plugins by id', () => {
    const a = statusBarPlugin();
    const b = statusBarPlugin({ showSelected: false });
    expect(dedupePlugins([a, b])).toHaveLength(1);
    expect(dedupePlugins([a, b])[0]).toBe(b);
    expect(dedupePlugins([findPlugin(), sideBarPlugin(), findPlugin({ caseSensitive: true })])).toHaveLength(
      2,
    );
  });

  it('isolates plugin setup and notify errors', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const good = {
      id: 'good',
      setup: () => undefined,
      onSelectionChange: () => undefined,
    };
    const badSetup = {
      id: 'badSetup',
      setup: () => {
        throw new Error('boom-setup');
      },
    };
    const badNotify = {
      id: 'badNotify',
      onSelectionChange: () => {
        throw new Error('boom-notify');
      },
    };
    const ctx = {
      api: {} as never,
      element: document.createElement('div'),
      injector: null as never,
      slots: null as never,
      capabilities: null as never,
    };
    expect(() => activatePlugins([badSetup, good], ctx)).not.toThrow();
    expect(() =>
      notifyPlugins([badNotify, good], ctx, 'onSelectionChange', []),
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('flattens column groups and keeps group headers aligned to visible order', () => {
    const defs: ColumnOrGroupDef<Person>[] = [
      {
        headerName: 'A',
        children: [{ field: 'name' }, { field: 'city' }],
      },
      { field: 'age' },
    ];
    const leaves = flattenColumnDefs(defs);
    expect(leaves.map((c) => c.field)).toEqual(['name', 'city', 'age']);

    const resolved = resolveColumnOrGroupDefs(defs);
    const map = buildLeafGroupMap(defs);
    expect(map.get('name')?.groupLabel).toBe('A');
    expect(map.get('city')?.groupLabel).toBe('A');
    expect(sameColumnGroup(map, 'name', 'city')).toBe(true);
    expect(sameColumnGroup(map, 'name', 'age')).toBe(false);

    const header = buildVisibleGroupHeaderRow(
      [
        resolved.find((c) => c.id === 'city')!,
        resolved.find((c) => c.id === 'name')!,
        resolved.find((c) => c.id === 'age')!,
      ],
      map,
    );
    expect(header[0]).toMatchObject({ label: 'A', colspan: 2 });
    expect(header[1]?.columnId).toBe('age');

    expect(parseSetFilter(serializeSetFilter(['Ada', 'Alan']))).toEqual(['Ada', 'Alan']);
    expect(parseClipboardMatrix('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('splits group headers when children straddle pin sides', () => {
    const defs: ColumnOrGroupDef<Person>[] = [
      {
        headerName: 'Identity',
        children: [
          { field: 'name', pinned: 'left' },
          { field: 'city' },
        ],
      },
      { field: 'age', pinned: 'right' },
    ];
    const resolved = resolveColumnOrGroupDefs(defs);
    const map = buildLeafGroupMap(defs);
    const header = buildVisibleGroupHeaderRow(resolved, map);

    expect(header).toHaveLength(3);
    expect(header[0]).toMatchObject({
      label: 'Identity',
      colspan: 1,
      pinned: 'left',
      startColumnId: 'name',
      endColumnId: 'name',
    });
    expect(header[1]).toMatchObject({
      label: 'Identity',
      colspan: 1,
      pinned: null,
      startColumnId: 'city',
      endColumnId: 'city',
    });
    expect(header[2]).toMatchObject({
      columnId: 'age',
      pinned: 'right',
      startColumnId: 'age',
    });
  });

  it('keeps grouped pinned siblings in one sticky group cell', () => {
    const defs: ColumnOrGroupDef<Person>[] = [
      {
        headerName: 'Identity',
        children: [
          { field: 'name', pinned: 'left' },
          { field: 'city', pinned: 'left' },
        ],
      },
    ];
    const resolved = resolveColumnOrGroupDefs(defs);
    const header = buildVisibleGroupHeaderRow(resolved, buildLeafGroupMap(defs));
    expect(header).toHaveLength(1);
    expect(header[0]).toMatchObject({
      label: 'Identity',
      colspan: 2,
      pinned: 'left',
      startColumnId: 'name',
      endColumnId: 'city',
    });
  });

  it('coerces blank numbers to null and dates back to Date', () => {
    expect(coerceCellEditValue({ field: 'age', type: 'number' }, '')).toBeNull();
    expect(coerceCellEditValue({ field: 'age', type: 'number' }, '  ')).toBeNull();
    expect(coerceCellEditValue({ field: 'age', type: 'number' }, '42')).toBe(42);

    const prev = new Date(2024, 4, 1);
    const next = coerceCellEditValue({ field: 'born', type: 'date' }, '2024-05-02', prev);
    expect(next).toBeInstanceOf(Date);
    expect(toDateKey(next)).toBe('2024-05-02');
  });

  it('collects nested group ids without mutating collapse state', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const ids = collectAllGroupIds(people, ['city', 'active'], byId);
    expect(ids.some((id) => id.includes('city=London'))).toBe(true);
    expect(ids.some((id) => id.includes('active=true'))).toBe(true);
  });

  it('cycles sort asc → desc → none (clear)', () => {
    expect(nextSortDirection(null, false)).toBe('asc');
    expect(nextSortDirection('asc', false)).toBe('desc');
    expect(nextSortDirection('desc', false)).toBeNull();
    expect(nextSortDirection('desc', true)).toBeNull();
  });

  it('resolves row drop index from scroll geometry and reorders by absolute indices', () => {
    const rows = [
      { kind: 'data' as const, id: 'd:0', rowId: 0, row: {}, dataIndex: 0, level: 0 },
      { kind: 'data' as const, id: 'd:1', rowId: 1, row: {}, dataIndex: 1, level: 0 },
      { kind: 'data' as const, id: 'd:2', rowId: 2, row: {}, dataIndex: 2, level: 0 },
    ];
    expect(
      resolveRowDropDataIndex({
        clientY: 50,
        scrollTop: 0,
        scrollRectTop: 40,
        rowHeight: 36,
        contentOffsetY: 72,
        displayRows: rows,
      }),
    ).toBeNull(); // still over sticky header
    expect(
      resolveRowDropDataIndex({
        clientY: 130,
        scrollTop: 0,
        scrollRectTop: 40,
        rowHeight: 36,
        contentOffsetY: 72,
        displayRows: rows,
      }),
    ).toBe(0); // y = 130 - 40 - 72 = 18 → floor(18/36)=0
    expect(
      resolveRowDropDataIndex({
        clientY: 170,
        scrollTop: 0,
        scrollRectTop: 40,
        rowHeight: 36,
        contentOffsetY: 72,
        displayRows: rows,
      }),
    ).toBe(1); // y = 58 → floor(58/36)=1

    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('attachRowReorder emits drop via window pointer listeners', () => {
    const overs: Array<number | null> = [];
    let dropped: [number, number] | null = null;
    let ended = 0;
    const cleanup = attachRowReorder({
      pointerId: 1,
      fromIndex: 0,
      getDropIndex: (y) => (y > 100 ? 2 : 1),
      onOver: (i) => overs.push(i),
      onDrop: (from, to) => {
        dropped = [from, to];
      },
      onEnd: () => {
        ended += 1;
      },
    });
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 150 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 150 }));
    expect(overs).toEqual([2]);
    expect(dropped).toEqual([0, 2]);
    expect(ended).toBe(1);
    cleanup(); // idempotent
    expect(ended).toBe(1);
  });

  it('formats aggregates with column valueFormatter', () => {
    const formatted = formatAggregateValue(54441750, {
      field: 'salary',
      valueFormatter: (v) => (typeof v === 'number' ? `$${v}` : ''),
    });
    expect(formatted).toBe('$54441750');
  });

  it('moves column onto a pinned target and adopts its pin', () => {
    const layout = reconcileColumnLayout(emptyColumnLayout(), [
      { id: 'name', pinned: 'left' },
      { id: 'age' },
      { id: 'city', pinned: 'right' },
    ]);
    const next = moveColumn(layout, 'age', 'name');
    expect(next).toEqual({
      order: ['age', 'name', 'city'],
      pin: { name: 'left', age: 'left', city: 'right' },
    });
  });

  it('setColumnPin moves the column to the matching edge', () => {
    const layout = reconcileColumnLayout(emptyColumnLayout(), [
      { id: 'name' },
      { id: 'age' },
      { id: 'city' },
    ]);
    expect(setColumnPin(layout, 'city', 'left')).toEqual({
      order: ['city', 'name', 'age'],
      pin: { name: null, age: null, city: 'left' },
    });
  });

  it('materializes layout order and pins for display', () => {
    const cols = resolveColumns<Person>([
      { field: 'age' },
      { field: 'name', pinned: 'left' },
      { field: 'city' },
    ]);
    const layout = {
      order: ['age', 'name', 'city'],
      pin: { age: null, name: null, city: 'right' } as const,
    };
    const materialized = materializeColumnLayout(cols, layout);
    expect(materialized.map((c) => c.id)).toEqual(['age', 'name', 'city']);
    expect(materialized.find((c) => c.id === 'name')?.pinned).toBeUndefined();
    expect(materialized.find((c) => c.id === 'city')?.pinned).toBe('right');

    const leftHeavy = materializeColumnLayout(cols, {
      order: ['age', 'name', 'city'],
      pin: { age: 'left', name: 'left', city: null },
    });
    expect(partitionColumnsByPin(leftHeavy).map((c) => c.id)).toEqual(['age', 'name', 'city']);
  });
});

@Component({
  imports: [DataGrid, DataGridCellDirective],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [pagination]="true"
      [pageSize]="2"
      [showToolbar]="true"
    >
      <ng-template alGridCell="city" let-row let-value="value">
        <em>{{ value }}</em>
      </ng-template>
    </al-data-grid>
  `,
})
class HostGrid {
  readonly rows = signal(people);
  readonly grid = createGrid({
    columns,
    rowId: (row: Person) => row.id,
    selection: 'multi',
    plugins: [sideBarPlugin<Person>()],
  });
}

describe('DataGrid', () => {
  let fixture: ComponentFixture<HostGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostGrid],
    }).compileComponents();

    fixture = TestBed.createComponent(HostGrid);
    await fixture.whenStable();
  });

  it('renders headers, pagination, toolbar, and sidebar', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('name');
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('Grace');
    expect(el.textContent).not.toContain('Alan');
    expect(el.textContent).toContain('Page 1 / 2');
    expect(el.querySelector('[data-testid="al-dg-toolbar-quick-filter"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-sidebar"]')).toBeTruthy();
  });

  it('sorts when a header is clicked', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll<HTMLButtonElement>('.al-data-grid__header-btn');
    const ageHeader = [...buttons].find((b) => b.textContent?.includes('age'));
    ageHeader?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const bodyText = el.querySelector('.al-data-grid__tbody')?.textContent ?? '';
    expect(bodyText.indexOf('Ada')).toBeGreaterThan(-1);
    expect(bodyText.indexOf('Alan')).toBeGreaterThan(-1);
    expect(bodyText.indexOf('Ada')).toBeLessThan(bodyText.indexOf('Alan'));
    expect(bodyText).not.toContain('Grace');
  });
});

@Component({
  imports: [DataGrid],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [virtual]="false"
      [pagination]="false"
    />
  `,
})
class PinMenuHostGrid {
  readonly rows = signal(people);
  readonly grid = createGrid({
    columns: [
      { field: 'name', pinned: 'left' },
      { field: 'age' },
      { field: 'city' },
    ] as ColumnDef<Person>[],
    rowId: (row: Person) => row.id,
  });
}

describe('DataGrid header pin context menu', () => {
  async function mount(): Promise<{
    fixture: ComponentFixture<PinMenuHostGrid>;
    grid: DataGrid<Person>;
    el: HTMLElement;
  }> {
    await TestBed.configureTestingModule({ imports: [PinMenuHostGrid] }).compileComponents();
    const fixture = TestBed.createComponent(PinMenuHostGrid);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const grid = fixture.debugElement.query(By.directive(DataGrid)).componentInstance as DataGrid<Person>;
    return { fixture, grid, el: fixture.nativeElement };
  }

  it('unpins a pinned column via header context menu', async () => {
    const { fixture, grid, el } = await mount();
    expect(grid.getColumnPinned('name')).toBe('left');

    const nameHeader = el.querySelector('[data-testid="al-dg-col-name"]') as HTMLElement;
    nameHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 20 }));
    fixture.detectChanges();

    const unpin = el.querySelector('[data-testid="al-dg-ctx-unpin"]') as HTMLButtonElement;
    expect(unpin).toBeTruthy();
    expect(unpin.disabled).toBe(false);
    unpin.click();
    fixture.detectChanges();

    expect(grid.getColumnPinned('name')).toBeNull();
    expect(el.querySelector('[data-testid="al-dg-context-menu"]')).toBeNull();
  });

  it('pins an unpinned column left via header context menu', async () => {
    const { fixture, grid, el } = await mount();
    expect(grid.getColumnPinned('age')).toBeNull();

    const ageHeader = el.querySelector('[data-testid="al-dg-col-age"]') as HTMLElement;
    ageHeader.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 20 }));
    fixture.detectChanges();

    const pinLeft = el.querySelector('[data-testid="al-dg-ctx-pin-left"]') as HTMLButtonElement;
    expect(pinLeft).toBeTruthy();
    expect(pinLeft.disabled).toBe(false);
    pinLeft.click();
    fixture.detectChanges();

    expect(grid.getColumnPinned('age')).toBe('left');
  });

  it('opens lean column menu via api.openColumnMenu with sort/hide items', async () => {
    const { fixture, grid, el } = await mount();
    grid.openColumnMenu('age');
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="al-dg-context-menu"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-ctx-sort-asc"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-ctx-autosize"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-ctx-hide"]')).toBeTruthy();
    expect(grid.columnMenuColumnId()).toBe('age');

    (el.querySelector('[data-testid="al-dg-ctx-sort-asc"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(grid.getSortModel()).toEqual([{ columnId: 'age', direction: 'asc' }]);
    expect(el.querySelector('[data-testid="al-dg-context-menu"]')).toBeNull();
  });
});

describe('row pipeline + display model', () => {
  it('runs client filter/sort pipeline', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const rows = runClientRowPipeline({
      data: people,
      filters: { name: 'a' },
      quickFilter: '',
      externalFilter: null,
      sorts: [{ columnId: 'age', direction: 'asc' }],
      columnsById: byId,
      visibleColumns: resolved,
    });
    expect(rows.map((p) => p.name)).toEqual(['Ada', 'Alan', 'Grace']);
  });

  it('runs full grid row model via createGrid.computeRowModel', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const grid = createGrid({
      columns,
      rowId: (r) => r.id,
      selection: 'multi',
    });
    const { processedRows, displayRows } = grid.computeRowModel({
      data: people,
      filters: { city: 'London' },
      quickFilter: '',
      externalFilter: null,
      sorts: [{ columnId: 'age', direction: 'desc' }],
      columnsById: byId,
      visibleColumns: resolved,
    });
    expect(processedRows.map((r) => r.name)).toEqual(['Ada']);
    expect(displayRows.every((d) => d.kind === 'data')).toBe(true);
    expect(displayRows).toHaveLength(1);
  });

  it('builds grouped display rows with collapse', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const expanded = buildDisplayRows({
      rows: people,
      rowId: (row) => row.id,
      columnsById: byId,
      collapsedGroupIds: new Set(),
      rowGroup: { columns: ['city'] },
    });
    expect(expanded.some((r) => r.kind === 'group' && r.key === 'London')).toBe(true);
    expect(expanded.filter((r) => r.kind === 'data')).toHaveLength(3);

    const londonId = expanded.find((r) => r.kind === 'group' && r.key === 'London')!.id;
    const collapsed = buildDisplayRows({
      rows: people,
      rowId: (row) => row.id,
      columnsById: byId,
      collapsedGroupIds: new Set([londonId]),
      rowGroup: { columns: ['city'] },
    });
    expect(collapsed.filter((r) => r.kind === 'data')).toHaveLength(2);
  });

  it('computes a virtual window', () => {
    const window = computeVirtualWindow({
      rowCount: 100,
      rowHeight: 36,
      scrollTop: 360,
      viewportHeight: 180,
      overscan: 2,
      enabled: true,
    });
    expect(window.start).toBe(8);
    expect(window.end).toBeLessThanOrEqual(100);
    expect(window.offsetY).toBe(8 * 36);
  });

  it('builds tree display rows from getDataPath', () => {
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const rows = buildDisplayRows({
      rows: people,
      rowId: (row) => row.id,
      columnsById: byId,
      collapsedGroupIds: new Set(),
      treeData: { getDataPath: (row) => row.path ?? [] },
    });
    expect(rows.some((r) => r.kind === 'group' && r.key === 'UK')).toBe(true);
    expect(rows.filter((r) => r.kind === 'data')).toHaveLength(3);
  });

  it('emits tree parent leaf rows before descendants', () => {
    const treePeople: Person[] = [
      { id: 10, name: 'UK HQ', age: 1, city: 'London', active: true, path: ['UK'] },
      { id: 11, name: 'Ada', age: 36, city: 'London', active: true, path: ['UK', 'London'] },
      { id: 12, name: 'Alan', age: 41, city: 'Manchester', active: true, path: ['UK', 'Manchester'] },
    ];
    const resolved = resolveColumns(columns);
    const byId = new Map(resolved.map((c) => [c.id, c]));
    const rows = buildDisplayRows({
      rows: treePeople,
      rowId: (row) => row.id,
      columnsById: byId,
      collapsedGroupIds: new Set(),
      treeData: { getDataPath: (row) => row.path ?? [] },
    });
    const dataIds = rows.filter((r) => r.kind === 'data').map((r) => r.rowId);
    expect(dataIds.indexOf(10)).toBeLessThan(dataIds.indexOf(11));
    expect(dataIds.indexOf(10)).toBeLessThan(dataIds.indexOf(12));
  });

  it('reconciles column order and hidden ids when schema changes', () => {
    expect(reconcileColumnOrder(['b', 'a', 'gone'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
    expect(reconcileHiddenColumnIds(['gone', 'a'], ['a', 'b'], ['b'])).toEqual(['a', 'b']);
  });

  it('gates row drag and builds fromId/toId reorder payloads', () => {
    expect(
      isRowDragAllowed({
        pluginEnabled: true,
        serverSide: false,
        hasActiveSort: false,
        hasActiveFilter: false,
        displayIsFlat: true,
      }),
    ).toBe(true);
    expect(
      isRowDragAllowed({
        pluginEnabled: true,
        serverSide: false,
        hasActiveSort: true,
        hasActiveFilter: false,
        displayIsFlat: true,
      }),
    ).toBe(false);

    const payload = buildRowReorderEvent(people, 0, 2, (row) => row.id);
    expect(payload).toMatchObject({ fromId: 1, toId: 3, fromIndex: 0, toIndex: 2 });
    expect(payload?.rows.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('collects tree group path ids', () => {
    expect(collectTreeGroupIds(people, (row) => row.path ?? [])).toEqual(
      expect.arrayContaining(['t/UK', 't/UK/London', 't/US', 't/US/New York', 't/UK/Manchester']),
    );
  });

  it('Ctrl/Cmd+A only consumes the event when select-all is handled', () => {
    const focus = new FocusController({
      getRowCount: () => 3,
      getColumnIds: () => ['name'],
      onSelectAll: () => false,
    });
    expect(
      focus.handleKeydown(new KeyboardEvent('keydown', { key: 'a', metaKey: true })),
    ).toBe(false);

    const multi = new FocusController({
      getRowCount: () => 3,
      getColumnIds: () => ['name'],
      onSelectAll: () => true,
    });
    expect(
      multi.handleKeydown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })),
    ).toBe(true);
  });

  it('cycles find matches via FindController', () => {
    let index = 0;
    const ctrl = new FindController({
      getMatchCount: () => 3,
      getActiveIndex: () => index,
      setActiveIndex: (i) => {
        index = i;
      },
    });
    expect(ctrl.next()).toBe(true);
    expect(index).toBe(1);
    expect(ctrl.prev()).toBe(true);
    expect(index).toBe(0);
  });

  it('toggles group rows with Enter via FocusController', () => {
    const toggled: number[] = [];
    const focus = new FocusController({
      getRowCount: () => 3,
      getColumnIds: () => ['name'],
      isGroupRow: (i) => i === 0,
      onToggleGroup: (i) => toggled.push(i),
      getPageRowCount: () => 5,
    });
    focus.focusCell(0, 'name');
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(true);
    expect(toggled).toEqual([0]);
    expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'PageDown' }))).toBe(true);
    expect(focus.getFocus()?.rowIndex).toBe(2);
  });
});

@Component({
  imports: [DataGrid],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [virtual]="false"
      [pagination]="false"
    />
  `,
})
class GroupHostGrid {
  readonly rows = signal(people);
  readonly grid = createGrid({
    columns,
    rowId: (row: Person) => row.id,
    plugins: [rowGroupPlugin<Person>({ columns: ['city'] })],
  });
}

@Component({
  imports: [DataGrid],
  template: `
    <al-data-grid
      [controller]="grid"
      [data]="rows()"
      [virtual]="false"
      [pagination]="false"
    />
  `,
})
class TreeHostGrid {
  readonly rows = signal(people);
  readonly grid = createGrid({
    columns,
    rowId: (row: Person) => row.id,
    plugins: [treeDataPlugin<Person>({ getDataPath: (row) => row.path ?? [] })],
  });
}

describe('DataGrid row grouping UI', () => {
  it('renders group rows and collapses on click', async () => {
    await TestBed.configureTestingModule({ imports: [GroupHostGrid] }).compileComponents();
    const fixture = TestBed.createComponent(GroupHostGrid);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const groups = el.querySelectorAll('[data-testid^="al-dg-group-"]');
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(el.textContent).toContain('London');
    expect(el.textContent).toContain('Ada');

    const london = [...groups].find((g) => g.textContent?.includes('London')) as HTMLElement;
    london?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Ada');
    expect(el.textContent).toContain('London');
  });

  it('focuses by display index when a data cell is clicked under grouping', async () => {
    await TestBed.configureTestingModule({ imports: [GroupHostGrid] }).compileComponents();
    const fixture = TestBed.createComponent(GroupHostGrid);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const adaCell = el.querySelector(
      '[data-testid="al-dg-cell-1-name"]',
    ) as HTMLElement | null;
    expect(adaCell).toBeTruthy();
    adaCell!.click();
    fixture.detectChanges();

    // First rows are group headers — Ada's display index is not her dataIndex (0).
    expect(adaCell!.classList.contains('al-data-grid__td--focused')).toBe(true);
  });
});

describe('DataGrid tree UI', () => {
  it('renders tree group nodes', async () => {
    await TestBed.configureTestingModule({ imports: [TreeHostGrid] }).compileComponents();
    const fixture = TestBed.createComponent(TreeHostGrid);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[data-testid^="al-dg-group-"]').length).toBeGreaterThanOrEqual(2);
    expect(el.textContent).toContain('UK');
    expect(el.textContent).toContain('Ada');
  });
});

describe('createGrid + controller binding', () => {
  it('exposes rowGroup adapter from held plugin', () => {
    const groups = rowGroupPlugin<Person>({ columns: ['city'] });
    const grid = createGrid({
      columns,
      rowId: (r) => r.id,
      selection: 'multi',
      plugins: [groups],
    });
    expect(grid.rowGroup).toBe(groups);
    expect(grid.rowGroup?.columns()).toEqual(['city']);
    groups.setColumns(['name']);
    expect(grid.rowGroup?.columns()).toEqual(['name']);
  });

  it('updates plugins via setPlugins', () => {
    const groups = rowGroupPlugin<Person>({ columns: ['city'] });
    const grid = createGrid({
      columns,
      rowId: (r) => r.id,
      plugins: [groups],
    });
    expect(grid.plugins()).toHaveLength(1);
    grid.setPlugins([groups, statusBarPlugin()]);
    expect(grid.plugins()).toHaveLength(2);
    expect(grid.rowGroup).toBe(groups);
  });

  it('renders from [controller] without columns/plugins inputs', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" />`,
    })
    class ControllerHost {
      readonly rows = signal(people);
      readonly groups = rowGroupPlugin<Person>({ columns: ['city'] });
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [this.groups],
      });
    }

    await TestBed.configureTestingModule({ imports: [ControllerHost] }).compileComponents();
    const fixture = TestBed.createComponent(ControllerHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[data-testid^="al-dg-group-"]').length).toBeGreaterThanOrEqual(3);
    expect(fixture.componentInstance.grid.api()).toBeTruthy();
  });

  it('setPlugins while mounted recomposes via kernel (not a DataGrid effect)', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" />`,
    })
    class RecomposeHost {
      readonly rows = signal(people);
      readonly groups = rowGroupPlugin<Person>({ columns: ['city'] });
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [this.groups],
      });
    }

    await TestBed.configureTestingModule({ imports: [RecomposeHost] }).compileComponents();
    const fixture = TestBed.createComponent(RecomposeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('[data-testid="al-dg-status-bar"]')).toBeFalsy();

    host.grid.setPlugins([host.groups, statusBarPlugin()]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="al-dg-status-bar"]')).toBeTruthy();
  });

  it('sideBar.setEnabled toggles chrome without setPlugins', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" />`,
    })
    class ToggleHost {
      readonly rows = signal(people);
      readonly sideBar = sideBarPlugin<Person>();
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [this.sideBar],
      });
    }

    await TestBed.configureTestingModule({ imports: [ToggleHost] }).compileComponents();
    const fixture = TestBed.createComponent(ToggleHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('[data-testid="al-dg-sidebar"]')).toBeTruthy();

    host.sideBar.setEnabled(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="al-dg-sidebar"]')).toBeFalsy();

    host.sideBar.setEnabled(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="al-dg-sidebar"]')).toBeTruthy();
  });

  it('demo-like sidebar toggle does not hang under grouping + plugins', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" />`,
    })
    class DemoLikeHost {
      readonly rows = signal(people);
      readonly groups = rowGroupPlugin<Person>({ columns: ['city'] });
      readonly sideBar = sideBarPlugin<Person>({
        panels: ['columns', 'filters'],
        position: 'right',
        defaultPanel: 'columns',
      });
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [
          statusBarPlugin(),
          this.groups,
          this.sideBar,
        ],
      });
    }

    await TestBed.configureTestingModule({ imports: [DemoLikeHost] }).compileComponents();
    const fixture = TestBed.createComponent(DemoLikeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.componentInstance;
    const started = Date.now();
    for (let i = 0; i < 30; i++) {
      host.sideBar.setEnabled(i % 2 === 0);
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(fixture.nativeElement.querySelector('al-data-grid')).toBeTruthy();
  });

  it('sideBar panels: [] registers no built-in panels', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" />`,
    })
    class EmptyPanelsHost {
      readonly rows = signal(people);
      readonly sideBar = sideBarPlugin<Person>({ panels: [] });
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [this.sideBar],
      });
    }

    await TestBed.configureTestingModule({ imports: [EmptyPanelsHost] }).compileComponents();
    const fixture = TestBed.createComponent(EmptyPanelsHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const tabs = fixture.nativeElement.querySelectorAll('.al-data-grid-sidebar__tab, [data-testid="al-dg-sidebar"] button');
    // Shell may exist but no panel tabs for built-ins
    expect(tabs.length).toBe(0);
  });

  it('filters tool panel: add/remove cards and auto-include from filter model', async () => {
    @Component({
      imports: [DataGrid],
      template: `<al-data-grid [controller]="grid" [data]="rows()" [virtual]="false" [floatingFilters]="true" />`,
    })
    class FiltersPanelHost {
      readonly rows = signal(people);
      readonly sideBar = sideBarPlugin<Person>({
        panels: ['filters'],
        defaultPanel: 'filters',
      });
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        plugins: [this.sideBar],
      });
    }

    await TestBed.configureTestingModule({ imports: [FiltersPanelHost] }).compileComponents();
    const fixture = TestBed.createComponent(FiltersPanelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="al-dg-filters-panel"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="al-dg-filter-card-name"]')).toBeFalsy();
    expect(el.textContent).toContain('No filters');

    const add = el.querySelector<HTMLSelectElement>('[data-testid="al-dg-filters-add"]');
    expect(add).toBeTruthy();
    add!.value = 'name';
    add!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid="al-dg-filter-card-name"]')).toBeTruthy();

    const textInput = el.querySelector<HTMLInputElement>(
      '[data-testid="al-dg-filter-card-name"] [data-testid="al-dg-filter-field-text"]',
    );
    expect(textInput).toBeTruthy();
    textInput!.value = 'Ada';
    textInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.grid.api()?.getFilterModel()).toEqual({ name: 'Ada' });

    fixture.componentInstance.grid.api()?.setFilterModel({ age: '36' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid="al-dg-filter-card-age"]')).toBeTruthy();

    const remove = el.querySelector<HTMLButtonElement>(
      '[data-testid="al-dg-filter-card-name"] [data-testid="al-dg-filter-card-remove"]',
    );
    remove?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelector('[data-testid="al-dg-filter-card-name"]')).toBeFalsy();
    expect(fixture.componentInstance.grid.api()?.getFilterModel()).toEqual({ age: '36' });
  });

  it('api.getSelectedRows / setSelectedRows round-trip selection by row data', async () => {
    @Component({
      imports: [DataGrid],
      template: `
        <al-data-grid
          [controller]="grid"
          [data]="rows()"
          [(selectedIds)]="selectedIds"
          [virtual]="false"
          [pagination]="false"
        />
      `,
    })
    class SelectionHost {
      readonly rows = signal(people);
      readonly selectedIds = signal<Array<string | number>>([1, 3]);
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        selection: 'multi',
      });
    }

    await TestBed.configureTestingModule({ imports: [SelectionHost] }).compileComponents();
    const fixture = TestBed.createComponent(SelectionHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const api = fixture.componentInstance.grid.api();
    expect(api).toBeTruthy();
    expect(api!.getSelectedRows().map((r) => r.name)).toEqual(['Ada', 'Alan']);

    api!.setSelectedRows([people[1]!]);
    expect(api!.getSelectedIds()).toEqual([2]);
    expect(api!.getSelectedRows().map((r) => r.name)).toEqual(['Grace']);

    api!.setSelectedRows([]);
    expect(api!.getSelectedRows()).toEqual([]);
  });

  it('cellRangePlugin Shift+arrow extends range and prefers range for copy', async () => {
    const { cellRangePlugin } = await import('@angular-libs/data-grid/plugins');

    @Component({
      imports: [DataGrid],
      template: `
        <al-data-grid
          [controller]="grid"
          [data]="rows()"
          [virtual]="false"
          [pagination]="false"
        />
      `,
    })
    class RangeHost {
      readonly rows = signal(people);
      readonly ranges = cellRangePlugin<Person>();
      readonly grid = createGrid({
        columns,
        rowId: (r: Person) => r.id,
        selection: 'multi',
        plugins: [this.ranges],
      });
    }

    await TestBed.configureTestingModule({ imports: [RangeHost] }).compileComponents();
    const fixture = TestBed.createComponent(RangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.componentInstance;
    const api = host.grid.api();
    expect(api).toBeTruthy();

    api!.focusCell(0, 'name');
    expect(api!.extendCellRange(0, 1)).toBe(true);
    expect(api!.getCellRange()).toEqual({
      anchor: { rowIndex: 0, columnId: 'name' },
      active: { rowIndex: 0, columnId: 'age' },
    });

    const text = api!.getSelectionClipboardText();
    expect(text).toContain('Ada');
    expect(text).toContain('36');

    api!.clearCellRange();
    expect(api!.getCellRange()).toBeNull();
  });
});
