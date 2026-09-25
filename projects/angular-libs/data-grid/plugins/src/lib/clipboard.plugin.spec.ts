import { describe, expect, it, vi } from 'vitest';
import { GridCapabilities } from '@angular-libs/data-grid/plugin';
import { defaultGridLocale, type PasteEvent } from '@angular-libs/data-grid';
import {
  clipboardPlugin,
  shouldDeferToNativeClipboard,
} from './clipboard.plugin';

function selectText(el: Node): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function clearSelection(): void {
  window.getSelection()?.removeAllRanges();
}

describe('shouldDeferToNativeClipboard', () => {
  it('defers when DOM text is selected', () => {
    const pre = document.createElement('pre');
    pre.textContent = '{"rowId":2,"event":"click"}';
    document.body.appendChild(pre);
    selectText(pre);

    expect(shouldDeferToNativeClipboard(new Event('copy'))).toBe(true);

    clearSelection();
    pre.remove();
  });

  it('does not defer a collapsed caret', () => {
    clearSelection();
    expect(shouldDeferToNativeClipboard(new Event('copy'))).toBe(false);
  });

  it('defers when the copy target is an editor field', () => {
    const input = document.createElement('input');
    expect(shouldDeferToNativeClipboard({ target: input } as unknown as Event)).toBe(true);
  });
});

describe('clipboardPlugin copy', () => {
  it('leaves native copy alone when sidebar text is selected', () => {
    const caps = new GridCapabilities();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const getText = vi.fn(() => 'Ada Lovelace 1');
    const plugin = clipboardPlugin({ paste: false });
    plugin.setup?.({
      api: { getSelectionClipboardText: getText } as never,
      element: host,
      injector: null as never,
      slots: { enableCopy: () => () => undefined } as never,
      capabilities: caps,
    });

    const copy = caps.getInteractions().find((item) => item.id === 'clipboard-copy');
    expect(copy).toBeTruthy();
    const detach = copy!.setup(host);

    const pre = document.createElement('pre');
    pre.textContent = '{"rowId":2}';
    host.appendChild(pre);
    selectText(pre);

    const event = new Event('copy', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(getText).not.toHaveBeenCalled();

    clearSelection();
    detach?.();
    host.remove();
  });

  it('copies the focused cell when nothing is selected', () => {
    const caps = new GridCapabilities();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const plugin = clipboardPlugin({ paste: false });
    plugin.setup?.({
      api: { getSelectionClipboardText: () => 'Ada Lovelace 1' } as never,
      element: host,
      injector: null as never,
      slots: { enableCopy: () => () => undefined } as never,
      capabilities: caps,
    });

    const copy = caps.getInteractions().find((item) => item.id === 'clipboard-copy');
    const detach = copy!.setup(host);
    clearSelection();

    const event = new Event('copy', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    detach?.();
    host.remove();
  });
});

describe('clipboardPlugin paste', () => {
  interface Emp {
    id: string;
    name: string;
    dept: string;
    salary: number;
  }
  const processed: Emp[] = [
    { id: '1', name: 'Alice', dept: 'Eng', salary: 10 },
    { id: '2', name: 'Bob', dept: 'Sales', salary: 20 },
    { id: '3', name: 'Carol', dept: 'Eng', salary: 30 },
  ];
  const columns = [
    { id: 'id', field: 'id' },
    { id: 'name', field: 'name', editable: true },
    { id: 'total', editable: true, valueGetter: (r: Emp) => r.salary * 2 },
    { id: 'salary', field: 'salary', type: 'number', editable: true },
  ];
  const flat = processed.map((row, i) => ({
    kind: 'data' as const,
    id: `d:${row.id}`,
    rowId: row.id,
    row,
    dataIndex: i,
    level: 0,
  }));

  function paste(
    text: string,
    focus: { rowIndex: number; columnId: string },
    display: readonly unknown[] = flat,
  ): PasteEvent<Emp> {
    const caps = new GridCapabilities<Emp>();
    const host = document.createElement('div');
    const emitted: PasteEvent<Emp>[] = [];
    clipboardPlugin<Emp>({ copy: false }).setup?.({
      api: {
        getFocusedCell: () => ({ ...focus, realm: 'body' }),
        getPagedDisplayRows: () => display,
        getVisibleColumnIds: () => columns.map((c) => c.id),
        getCellRange: () => null,
        getColumnsById: () => new Map(columns.map((c) => [c.id, c])),
        getProcessedRows: () => processed,
        resolveRowId: (row: Emp) => row.id,
        emitPaste: (event: PasteEvent<Emp>) => emitted.push(event),
        getLocale: () => ({ ...defaultGridLocale, numberLocale: 'nb-NO' }),
      } as never,
      element: host,
      injector: null as never,
      slots: { enablePaste: () => () => undefined } as never,
      capabilities: caps,
    });
    const detach = caps.getInteractions().find((i) => i.id === 'clipboard-paste')!.setup(host);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    host.dispatchEvent(event);
    detach?.();
    expect(event.defaultPrevented).toBe(true);
    return emitted[0]!;
  }

  it('skips read-only and valueGetter-only columns', () => {
    const event = paste('9\tZed\t999\t5', { rowIndex: 0, columnId: 'id' });
    expect(event.suggestedRows[0]).toEqual({ id: '1', name: 'Zed', dept: 'Eng', salary: 5 });
    expect(event.rowIds).toEqual(['1', '2', '3']);
    expect(event.targetRowIds).toEqual(['1']);
  });

  it('keeps comma decimals in one column and parses them with the grid locale', () => {
    const event = paste('1,5\r\n2,5', { rowIndex: 0, columnId: 'salary' });
    expect(event.suggestedRows.map((r) => r.salary)).toEqual([1.5, 2.5, 30]);
    expect(event.invalidCells).toEqual([]);
  });

  it('reports unparseable cells instead of writing them', () => {
    const event = paste('abc', { rowIndex: 1, columnId: 'salary' });
    expect(event.suggestedRows[1]!.salary).toBe(20);
    expect(event.invalidCells).toEqual([
      { rowId: '2', columnId: 'salary', text: 'abc', error: 'Not a valid number' },
    ]);
  });

  it('writes displayed rows under grouping, not contiguous processed rows', () => {
    const grouped = [
      { kind: 'group', id: 'g:Eng', field: 'dept', key: 'Eng', level: 0, expanded: true, childCount: 2 },
      { ...flat[0]!, level: 1 },
      { ...flat[2]!, level: 1 },
      { kind: 'group', id: 'g:Sales', field: 'dept', key: 'Sales', level: 0, expanded: false, childCount: 1 },
    ];
    const event = paste('A2\nC2\nX', { rowIndex: 1, columnId: 'name' }, grouped);
    expect(event.suggestedRows.map((r) => r.name)).toEqual(['A2', 'Bob', 'C2']);
    expect(event.targetRowIds).toEqual(['1', '3']);
    expect(event.matrix).toEqual([['A2'], ['C2']]);
  });
});
