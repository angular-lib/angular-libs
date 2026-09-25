import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ColumnLayoutHost } from './column-layout.host';
import type { ColumnLayoutDeps } from './binder-surface';
import type { ColumnOrGroupDef } from '../components/data-grid/data-grid.types';

interface Row {
  id: number;
  a: string;
  b: string;
  c: string;
}

const rows: Row[] = [
  { id: 1, a: 'x', b: 'y', c: 'z' },
  { id: 2, a: '=1+1', b: 'y', c: 'z' },
];

function makeHost(columns: ColumnOrGroupDef<Row>[], width = 600) {
  const viewportWidth = signal(width);
  const selected = new Set<Row>([rows[1]!]);
  const deps = {
    effectiveColumns: () => columns,
    quickFilter: signal(''),
    hiddenColumnIds: signal<string[]>([]),
    multiSort: () => false,
    columnReorder: () => true,
    showSelection: () => false,
    rowDragEnabled: () => false,
    fullRowEdit: () => false,
    processedRows: () => rows,
    data: () => rows,
    hostElement: () => document.createElement('div'),
    viewportWidth: () => viewportWidth(),
    isRowSelected: (row: Row) => selected.has(row),
    publishSort: vi.fn(),
    publishFilter: vi.fn(),
    publishColumnOrder: vi.fn(),
    getStateExtras: () => ({ pageIndex: 0, activeSidePanel: null }),
    applyStateExtras: vi.fn(),
    notifyPlugins: vi.fn(),
    emitState: vi.fn(),
    emitQueryIfServer: vi.fn(),
  } as unknown as ColumnLayoutDeps<Row>;
  return { host: new ColumnLayoutHost<Row>(deps), viewportWidth };
}

function pointer(type: string, clientX: number): PointerEvent {
  const ev = new MouseEvent(type, { clientX, bubbles: true }) as unknown as PointerEvent;
  return ev;
}

describe('ColumnLayoutHost widths', () => {
  it('resolves flex tracks against the measured viewport width', () => {
    const { host, viewportWidth } = makeHost([
      { field: 'a', width: 100 },
      { field: 'b', flex: 1 },
    ]);
    expect(host.gridTemplateColumns()).toBe('100px 500px');
    viewportWidth.set(400);
    expect(host.gridTemplateColumns()).toBe('100px 300px');
    expect(host.resolvedWidths()).toEqual({ a: 100, b: 300 });
  });

  it('resize locks only the dragged column; flex keeps absorbing', () => {
    const { host, viewportWidth } = makeHost([
      { field: 'a', width: 100 },
      { field: 'b', flex: 1 },
      { field: 'c', flex: 1 },
    ]);
    const a = host.visibleColumns()[0]!;
    host.startResize(pointer('pointerdown', 100), a);
    window.dispatchEvent(pointer('pointermove', 150));
    window.dispatchEvent(pointer('pointerup', 150));
    expect(host.widthOverrides()).toEqual({ a: 150 });
    expect(host.resolvedWidths()).toEqual({ a: 150, b: 225, c: 225 });
    // Flex still reacts to viewport changes after a resize.
    viewportWidth.set(750);
    expect(host.resolvedWidths()).toEqual({ a: 150, b: 300, c: 300 });
  });

  it('exportCsv honours columnKeys, onlySelected and suppressExport', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { host } = makeHost([
      { id: 'util', header: 'U', suppressExport: true },
      { field: 'a', header: 'A' },
      { field: 'b', header: 'B' },
    ]);
    expect(host.exportCsv({ columnSeparator: ',' })).toBe("A,B\r\nx,y\r\n'=1+1,y");
    expect(host.exportCsv({ columnSeparator: ',', columnKeys: ['b', 'util'], onlySelected: true })).toBe(
      'B,U\r\ny,',
    );
    vi.restoreAllMocks();
  });
});
