import { GridCapabilities } from './capabilities';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import {
  flashCellsPlugin,
  flashKey,
} from '@angular-libs/data-grid/plugins';

interface Person {
  id: number;
  name: string;
  city: string;
}

describe('flashCellsPlugin', () => {
  const col = { id: 'name', field: 'name' } as ColumnDef<Person>;

  function decoratorClass(
    caps: GridCapabilities<Person>,
    rowId: number,
    columnId: string,
  ): string {
    return caps.resolveCellDecoratorClasses({
      row: { id: rowId, name: 'Ada', city: 'Oslo' },
      rowId,
      rowIndex: 0,
      columnId,
      column: col,
      value: 'Ada',
    });
  }

  it('adds decorator class for flashCells targets and clearFlash removes it', () => {
    const flash = flashCellsPlugin<Person>();
    const caps = new GridCapabilities<Person>();
    const element = document.createElement('div');
    const cleanup = flash.setup!({
      api: {
        getVisibleColumnIds: () => ['name', 'city'],
      } as never,
      element,
      injector: null as never,
      slots: {} as never,
      capabilities: caps,
    });

    expect(decoratorClass(caps, 1, 'name')).not.toContain('al-dg-cell--flash');

    flash.flashCells({
      cells: [{ rowId: 1, columnId: 'name' }],
      color: '#ffe082',
      duration: 5000,
    });

    expect(decoratorClass(caps, 1, 'name')).toContain('al-dg-cell--flash');
    expect(decoratorClass(caps, 1, 'city')).not.toContain('al-dg-cell--flash');
    expect(element.style.getPropertyValue('--al-dg-flash-color')).toBe('#ffe082');
    expect(element.style.getPropertyValue('--al-dg-flash-duration')).toBe('5000ms');

    flash.clearFlash();
    expect(decoratorClass(caps, 1, 'name')).not.toContain('al-dg-cell--flash');

    cleanup?.();
  });

  it('expands rowIds against visible columns when columnIds omitted', () => {
    const flash = flashCellsPlugin<Person>();
    const caps = new GridCapabilities<Person>();
    const element = document.createElement('div');
    const cleanup = flash.setup!({
      api: {
        getVisibleColumnIds: () => ['name', 'city'],
      } as never,
      element,
      injector: null as never,
      slots: {} as never,
      capabilities: caps,
    });

    flash.flashCells({
      rowIds: [1],
      duration: 5000,
    });

    expect(decoratorClass(caps, 1, 'name')).toContain('al-dg-cell--flash');
    expect(decoratorClass(caps, 1, 'city')).toContain('al-dg-cell--flash');
    expect(decoratorClass(caps, 2, 'name')).not.toContain('al-dg-cell--flash');

    cleanup?.();
  });

  it('expands rowIds × columnIds intersection', () => {
    const flash = flashCellsPlugin<Person>();
    const caps = new GridCapabilities<Person>();
    const element = document.createElement('div');
    const cleanup = flash.setup!({
      api: {
        getVisibleColumnIds: () => ['name', 'city'],
      } as never,
      element,
      injector: null as never,
      slots: {} as never,
      capabilities: caps,
    });

    flash.flashCells({
      rowIds: [1, 2],
      columnIds: ['city'],
      duration: 5000,
    });

    expect(decoratorClass(caps, 1, 'city')).toContain('al-dg-cell--flash');
    expect(decoratorClass(caps, 2, 'city')).toContain('al-dg-cell--flash');
    expect(decoratorClass(caps, 1, 'name')).not.toContain('al-dg-cell--flash');

    cleanup?.();
  });

  it('clears flash after duration', () => {
    vi.useFakeTimers();
    try {
      const flash = flashCellsPlugin<Person>({ duration: 400 });
      const caps = new GridCapabilities<Person>();
      const element = document.createElement('div');
      const cleanup = flash.setup!({
        api: { getVisibleColumnIds: () => ['name'] } as never,
        element,
        injector: null as never,
        slots: {} as never,
        capabilities: caps,
      });

      flash.flashCells({ cells: [{ rowId: 1, columnId: 'name' }] });
      expect(decoratorClass(caps, 1, 'name')).toContain('al-dg-cell--flash');

      vi.advanceTimersByTime(399);
      expect(decoratorClass(caps, 1, 'name')).toContain('al-dg-cell--flash');

      vi.advanceTimersByTime(1);
      expect(decoratorClass(caps, 1, 'name')).not.toContain('al-dg-cell--flash');

      cleanup?.();
    } finally {
      vi.useRealTimers();
    }
  });

  it('exports flashKey matching notes-style key', () => {
    expect(flashKey(1, 'name')).toBe('1:name');
  });
});
