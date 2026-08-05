import { signal } from '@angular/core';
import { createGrid } from './create-grid';
import { resolveEditInteraction } from './editing/edit-interaction';
import { FocusController } from './controllers/focus';

describe('Wave 3 policies', () => {
  describe('resolveEditInteraction', () => {
    it('resolves default and excel presets', () => {
      expect(resolveEditInteraction('default').pointerStart).toBe('dblclick');
      expect(resolveEditInteraction('excel')).toEqual({
        pointerStart: 'click',
        enterIdle: 'startEdit',
        enterEditing: 'commitAndMoveDown',
        editorBlur: 'commit',
      });
    });

    it('merges sparse overrides onto default', () => {
      expect(resolveEditInteraction({ pointerStart: 'none', enterIdle: 'moveDown' })).toEqual({
        pointerStart: 'none',
        enterIdle: 'moveDown',
        enterEditing: 'commit',
        editorBlur: 'commit',
      });
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
});
