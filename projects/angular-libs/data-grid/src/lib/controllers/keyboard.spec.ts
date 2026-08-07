/**
 * Executable KEYBOARD.md matrix for FocusController (P1b D1).
 */
import { FocusController } from './focus';

function key(
  name: string,
  mods: Partial<Pick<KeyboardEventInit, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>> = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, ...mods });
}

describe('FocusController keyboard matrix (KEYBOARD.md)', () => {
  function createFocus(
    overrides: Partial<ConstructorParameters<typeof FocusController>[0]> = {},
  ): FocusController {
    return new FocusController({
      getRowCount: () => 10,
      getColumnIds: () => ['a', 'b', 'c'],
      getPageRowCount: () => 3,
      ...overrides,
    });
  }

  describe('Body', () => {
    it('Arrow keys move focus', () => {
      const focus = createFocus();
      focus.focusCell(2, 'b');
      expect(focus.handleKeydown(key('ArrowRight'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 2, columnId: 'c', realm: 'body' });
      expect(focus.handleKeydown(key('ArrowDown'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 3, columnId: 'c', realm: 'body' });
      expect(focus.handleKeydown(key('ArrowLeft'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 3, columnId: 'b', realm: 'body' });
      expect(focus.handleKeydown(key('ArrowUp'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 2, columnId: 'b', realm: 'body' });
    });

    it('Home/End move to first/last column', () => {
      const focus = createFocus();
      focus.focusCell(1, 'b');
      expect(focus.handleKeydown(key('Home'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 1, columnId: 'a', realm: 'body' });
      expect(focus.handleKeydown(key('End'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 1, columnId: 'c', realm: 'body' });
    });

    it('Ctrl/Cmd+Home/End move to first/last row', () => {
      const focus = createFocus();
      focus.focusCell(4, 'b');
      expect(focus.handleKeydown(key('Home', { ctrlKey: true }))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'b', realm: 'body' });
      expect(focus.handleKeydown(key('End', { metaKey: true }))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 9, columnId: 'b', realm: 'body' });
    });

    it('PageUp/PageDown jump by getPageRowCount', () => {
      const focus = createFocus({ getPageRowCount: () => 4 });
      focus.focusCell(5, 'a');
      expect(focus.handleKeydown(key('PageDown'))).toBe(true);
      expect(focus.getFocus()?.rowIndex).toBe(9);
      focus.focusCell(5, 'a');
      expect(focus.handleKeydown(key('PageUp'))).toBe(true);
      expect(focus.getFocus()?.rowIndex).toBe(1);
    });

    it('Enter/F2 call onStartEdit', () => {
      const starts: Array<{ key: string; reason: string }> = [];
      const focus = createFocus({
        onStartEdit: (cell, reason) => starts.push({ key: cell.columnId, reason }),
      });
      focus.focusCell(1, 'b');
      expect(focus.handleKeydown(key('Enter'))).toBe(true);
      expect(focus.handleKeydown(key('F2'))).toBe(true);
      expect(starts).toEqual([
        { key: 'b', reason: 'enter' },
        { key: 'b', reason: 'f2' },
      ]);
    });

    it('Space toggles selection; group Space toggles group', () => {
      const selected: number[] = [];
      const groups: number[] = [];
      const focus = createFocus({
        isGroupRow: (i) => i === 0,
        onToggleSelect: (i) => selected.push(i),
        onToggleGroup: (i) => groups.push(i),
      });
      focus.focusCell(2, 'a');
      expect(focus.handleKeydown(key(' '))).toBe(true);
      expect(selected).toEqual([2]);
      focus.focusCell(0, 'a');
      expect(focus.handleKeydown(key(' '))).toBe(true);
      expect(groups).toEqual([0]);
    });

    it('Escape calls onCancelEdit', () => {
      let cancelled = 0;
      const focus = createFocus({ onCancelEdit: () => cancelled++ });
      focus.focusCell(0, 'a');
      expect(focus.handleKeydown(key('Escape'))).toBe(true);
      expect(cancelled).toBe(1);
    });

    it('Ctrl/Cmd+A calls onSelectAll', () => {
      let selectAll = 0;
      const focus = createFocus({
        onSelectAll: () => {
          selectAll++;
          return true;
        },
      });
      focus.focusCell(0, 'a');
      expect(focus.handleKeydown(key('a', { ctrlKey: true }))).toBe(true);
      expect(focus.handleKeydown(key('a', { metaKey: true }))).toBe(true);
      expect(selectAll).toBe(2);
    });

    it('Tab is NOT handled (page citizen — default browser Tab)', () => {
      const focus = createFocus();
      focus.focusCell(1, 'b');
      expect(focus.handleKeydown(key('Tab'))).toBe(false);
      expect(focus.handleKeydown(key('Tab', { shiftKey: true }))).toBe(false);
      expect(focus.getFocus()).toEqual({ rowIndex: 1, columnId: 'b', realm: 'body' });
    });
  });

  describe('Header continuum', () => {
    it('ArrowUp from body row 0 → header', () => {
      const focus = createFocus({ hasFloatingFilters: () => false });
      focus.focusCell(0, 'b');
      expect(focus.handleKeydown(key('ArrowUp'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'b', realm: 'header' });
    });

    it('ArrowDown from header → body (or floatingFilter)', () => {
      const toBody = createFocus({ hasFloatingFilters: () => false });
      toBody.setFocus({ rowIndex: 0, columnId: 'a', realm: 'header' });
      expect(toBody.handleKeydown(key('ArrowDown'))).toBe(true);
      expect(toBody.getFocus()).toEqual({ rowIndex: 0, columnId: 'a', realm: 'body' });

      const toFf = createFocus({ hasFloatingFilters: () => true });
      toFf.setFocus({ rowIndex: 0, columnId: 'c', realm: 'header' });
      expect(toFf.handleKeydown(key('ArrowDown'))).toBe(true);
      expect(toFf.getFocus()).toEqual({
        rowIndex: 0,
        columnId: 'c',
        realm: 'floatingFilter',
      });
    });

    it('PageDown from header → body row 0', () => {
      const focus = createFocus();
      focus.setFocus({ rowIndex: 0, columnId: 'b', realm: 'header' });
      expect(focus.handleKeydown(key('PageDown'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'b', realm: 'body' });
    });

    it('PageUp from body row 0 → header', () => {
      const focus = createFocus({ hasFloatingFilters: () => false });
      focus.focusCell(0, 'c');
      expect(focus.handleKeydown(key('PageUp'))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'c', realm: 'header' });
    });

    it('Enter on header → onHeaderActivate', () => {
      const activated: Array<{ id: string; multi: boolean }> = [];
      const focus = createFocus({
        onHeaderActivate: (id, multi) => activated.push({ id, multi }),
      });
      focus.setFocus({ rowIndex: 0, columnId: 'b', realm: 'header' });
      expect(focus.handleKeydown(key('Enter'))).toBe(true);
      expect(focus.handleKeydown(key('Enter', { shiftKey: true }))).toBe(true);
      expect(activated).toEqual([
        { id: 'b', multi: false },
        { id: 'b', multi: true },
      ]);
    });

    it('Alt+ArrowDown → onOpenColumnMenu', () => {
      const menus: string[] = [];
      const focus = createFocus({
        onOpenColumnMenu: (id) => menus.push(id),
      });
      focus.setFocus({ rowIndex: 0, columnId: 'a', realm: 'header' });
      expect(focus.handleKeydown(key('ArrowDown', { altKey: true }))).toBe(true);
      expect(menus).toEqual(['a']);
      expect(focus.getFocus()?.realm).toBe('header');
    });
  });

  describe('Shift+arrows', () => {
    it('calls onExtendRange when provided; skips move when it returns true', () => {
      const deltas: Array<[number, number]> = [];
      const focus = createFocus({
        onExtendRange: (dRow, dCol) => {
          deltas.push([dRow, dCol]);
          return true;
        },
      });
      focus.focusCell(2, 'b');
      expect(focus.handleKeydown(key('ArrowDown', { shiftKey: true }))).toBe(true);
      expect(focus.handleKeydown(key('ArrowLeft', { shiftKey: true }))).toBe(true);
      expect(deltas).toEqual([
        [1, 0],
        [0, -1],
      ]);
      expect(focus.getFocus()).toEqual({ rowIndex: 2, columnId: 'b', realm: 'body' });
    });

    it('falls through to move when onExtendRange returns false', () => {
      const focus = createFocus({
        onExtendRange: () => false,
      });
      focus.focusCell(2, 'b');
      expect(focus.handleKeydown(key('ArrowRight', { shiftKey: true }))).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 2, columnId: 'c', realm: 'body' });
    });
  });
});
