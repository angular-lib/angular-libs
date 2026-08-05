import { signal } from '@angular/core';
import { createGrid } from './create-grid';
import {
  resolveEditInteraction,
  resolveTypeToEditSeed,
} from './editing/edit-interaction';
import { FocusController } from './controllers/focus';

describe('Wave 3 policies', () => {
  describe('resolveEditInteraction', () => {
    it('resolves default and excel presets', () => {
      expect(resolveEditInteraction('default').pointerStart).toBe('dblclick');
      expect(resolveEditInteraction('default').tabEditing).toBe('browser');
      expect(resolveEditInteraction('default').arrowEditing).toBe('caret');
      expect(resolveEditInteraction('excel')).toEqual({
        pointerStart: 'click',
        enterIdle: 'startEdit',
        enterEditing: 'commitAndMoveDown',
        editorBlur: 'commit',
        tabEditing: 'commitAndMove',
        typeToEdit: 'replace',
        arrowEditing: 'moveHorizontal',
      });
    });

    it('merges sparse overrides onto default', () => {
      expect(
        resolveEditInteraction({
          pointerStart: 'none',
          enterIdle: 'moveDown',
          tabEditing: 'commitAndMove',
          arrowEditing: 'moveHorizontal',
        }),
      ).toEqual({
        pointerStart: 'none',
        enterIdle: 'moveDown',
        enterEditing: 'commit',
        editorBlur: 'commit',
        tabEditing: 'commitAndMove',
        typeToEdit: 'replace',
        arrowEditing: 'moveHorizontal',
      });
    });

    it('allows typeToEdit off', () => {
      expect(resolveEditInteraction({ typeToEdit: 'off' }).typeToEdit).toBe('off');
      expect(resolveEditInteraction('default').typeToEdit).toBe('replace');
    });
  });

  describe('resolveTypeToEditSeed', () => {
    it('ignores boolean columns in cell mode', () => {
      expect(
        resolveTypeToEditSeed({ type: 'boolean' }, true, 'a', 'cell'),
      ).toEqual({ action: 'ignore' });
    });

    it('opens boolean columns in fullRow without seeding', () => {
      expect(
        resolveTypeToEditSeed({ type: 'boolean' }, true, 'a', 'fullRow'),
      ).toEqual({ action: 'open' });
    });

    it('replaces text with the typed char', () => {
      expect(
        resolveTypeToEditSeed({ field: 'name' }, 'Alice', 'Z', 'cell'),
      ).toEqual({ action: 'set', value: 'Z' });
    });

    it('clears on Backspace for text and number', () => {
      expect(
        resolveTypeToEditSeed({ field: 'name' }, 'Alice', '', 'cell'),
      ).toEqual({ action: 'set', value: '' });
      expect(
        resolveTypeToEditSeed({ type: 'number' }, 10, '', 'fullRow'),
      ).toEqual({ action: 'set', value: null });
    });

    it('opens date on printable, clears on Backspace', () => {
      expect(
        resolveTypeToEditSeed({ type: 'date' }, '2020-01-01', '2', 'cell'),
      ).toEqual({ action: 'open' });
      expect(
        resolveTypeToEditSeed({ type: 'date' }, '2020-01-01', '', 'fullRow'),
      ).toEqual({ action: 'set', value: null });
    });

    it('coerces number seed in fullRow', () => {
      expect(
        resolveTypeToEditSeed({ type: 'number' }, 10, '7', 'fullRow'),
      ).toEqual({ action: 'set', value: 7 });
    });

    it('opens select without seeding', () => {
      expect(
        resolveTypeToEditSeed({ cellEditor: 'select' }, 'a', 'b', 'cell'),
      ).toEqual({ action: 'open' });
    });
  });

  describe('createGrid rows', () => {
    it('applies transactions and setRows on owned signal', () => {
      type Row = { id: number; name: string };
      const rows = signal<Row[]>([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
      const grid = createGrid<Row>({
        columns: [{ field: 'name' }],
        rowId: (r) => r.id,
        rows,
        editInteraction: 'excel',
      });

      expect(grid.editInteraction.pointerStart).toBe('click');
      expect(grid.editInteraction.tabEditing).toBe('commitAndMove');
      expect(grid.editInteraction.typeToEdit).toBe('replace');
      expect(grid.editInteraction.arrowEditing).toBe('moveHorizontal');
      expect(grid.rows?.()).toEqual(rows());

      const added = grid.applyTransaction({
        add: [{ id: 3, name: 'C' }],
        update: [{ id: 1, name: 'A1' }],
        remove: [{ id: 2 } as Row],
      });
      expect(added.rows.map((r) => r.id)).toEqual([1, 3]);
      expect(rows().map((r) => r.name)).toEqual(['A1', 'C']);

      grid.setRows([{ id: 9, name: 'Z' }]);
      expect(rows()).toEqual([{ id: 9, name: 'Z' }]);
    });

    it('throws applyTransaction without rows option', () => {
      const grid = createGrid({ columns: [{ field: 'name' }] });
      expect(() => grid.applyTransaction({ add: [] })).toThrow(/rows/);
    });
  });

  describe('FocusController PageDown from header', () => {
    it('moves header focus into body row 0', () => {
      const focus = new FocusController({
        getRowCount: () => 5,
        getColumnIds: () => ['a', 'b'],
        hasFloatingFilters: () => false,
      });
      focus.setFocus({ rowIndex: 0, columnId: 'b', realm: 'header' });
      const event = new KeyboardEvent('keydown', { key: 'PageDown' });
      expect(focus.handleKeydown(event)).toBe(true);
      expect(focus.getFocus()).toEqual({ rowIndex: 0, columnId: 'b', realm: 'body' });
    });

    it('PageUp from body row 0 returns to header', () => {
      const focus = new FocusController({
        getRowCount: () => 5,
        getColumnIds: () => ['a', 'b'],
        hasFloatingFilters: () => false,
      });
      focus.setFocus({ rowIndex: 0, columnId: 'a', realm: 'body' });
      expect(focus.handleKeydown(new KeyboardEvent('keydown', { key: 'PageUp' }))).toBe(true);
      expect(focus.getFocus()?.realm).toBe('header');
    });
  });

  describe('FocusController.moveHorizontalWrap', () => {
    it('wraps to the next row after the last column', () => {
      const focus = new FocusController({
        getRowCount: () => 3,
        getColumnIds: () => ['a', 'b'],
      });
      focus.setFocus({ rowIndex: 0, columnId: 'b', realm: 'body' });
      expect(focus.moveHorizontalWrap(1)).toEqual({
        rowIndex: 1,
        columnId: 'a',
        realm: 'body',
      });
    });

    it('wraps to the previous row before the first column', () => {
      const focus = new FocusController({
        getRowCount: () => 3,
        getColumnIds: () => ['a', 'b'],
      });
      focus.setFocus({ rowIndex: 1, columnId: 'a', realm: 'body' });
      expect(focus.moveHorizontalWrap(-1)).toEqual({
        rowIndex: 0,
        columnId: 'b',
        realm: 'body',
      });
    });

    it('stays put at the grid edges', () => {
      const focus = new FocusController({
        getRowCount: () => 2,
        getColumnIds: () => ['a', 'b'],
      });
      focus.setFocus({ rowIndex: 1, columnId: 'b', realm: 'body' });
      expect(focus.moveHorizontalWrap(1)).toEqual({
        rowIndex: 1,
        columnId: 'b',
        realm: 'body',
      });
      focus.setFocus({ rowIndex: 0, columnId: 'a', realm: 'body' });
      expect(focus.moveHorizontalWrap(-1)).toEqual({
        rowIndex: 0,
        columnId: 'a',
        realm: 'body',
      });
    });
  });
});
