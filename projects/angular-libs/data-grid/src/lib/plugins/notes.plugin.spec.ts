import { signal } from '@angular/core';
import { GridCapabilities } from './capabilities';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import {
  noteKey,
  notesPlugin,
  type Note,
  type NotesMap,
} from '@angular-libs/data-grid/plugins';

interface Person {
  id: number;
  name: string;
}

describe('notesPlugin', () => {
  it('adapter round-trips notes via WritableSignal and updates decorator class', async () => {
    const backend = new Map<string, Note>();
    const notesMap = signal<NotesMap | undefined>({});
    let reloadCount = 0;
    const notes = notesPlugin<Person>({
      notes: notesMap,
      save: async ({ rowId, columnId, note }) => {
        const key = noteKey(rowId, columnId);
        if (note === undefined) {
          backend.delete(key);
        } else {
          backend.set(key, note);
        }
      },
      reload: () => {
        reloadCount += 1;
        notesMap.set(Object.fromEntries(backend));
      },
    });

    expect(notes.getNote(1, 'name')).toBeUndefined();
    await notes.setNote(1, 'name', { text: 'hello' });
    expect(notes.getNote(1, 'name')).toEqual({ text: 'hello' });
    expect(backend.get(noteKey(1, 'name'))).toEqual({ text: 'hello' });

    const caps = new GridCapabilities<Person>();
    const element = document.createElement('div');
    const cleanup = notes.setup!({
      api: {} as never,
      element,
      injector: null as never,
      slots: {} as never,
      capabilities: caps,
    });

    const col = { id: 'name', field: 'name' } as ColumnDef<Person>;
    const withNote = caps.resolveCellDecoratorClasses({
      row: { id: 1, name: 'Ada' },
      rowId: 1,
      rowIndex: 0,
      columnId: 'name',
      column: col,
      value: 'Ada',
    });
    expect(withNote).toContain('al-dg-cell--has-note');

    await notes.setNote(1, 'name', undefined);
    const cleared = caps.resolveCellDecoratorClasses({
      row: { id: 1, name: 'Ada' },
      rowId: 1,
      rowIndex: 0,
      columnId: 'name',
      column: col,
      value: 'Ada',
    });
    expect(cleared).not.toContain('al-dg-cell--has-note');

    expect(caps.hasContextMenuItems()).toBe(true);
    const menu = caps.resolveContextMenuItems({
      row: { id: 1, name: 'Ada' },
      rowId: 1,
      rowIndex: 0,
      column: col as never,
      columnId: 'name',
      value: 'Ada',
      event: new MouseEvent('contextmenu'),
      selectedIds: [],
      form: null,
      close: () => undefined,
    });
    expect(menu.some((i) => i.id === 'note-add')).toBe(true);

    await notes.setNote(1, 'name', { text: 'again' });
    notes.refreshNotes();
    expect(reloadCount).toBe(1);
    const menuEdit = caps.resolveContextMenuItems({
      row: { id: 1, name: 'Ada' },
      rowId: 1,
      rowIndex: 0,
      column: col as never,
      columnId: 'name',
      value: 'Ada',
      event: new MouseEvent('contextmenu'),
      selectedIds: [],
      form: null,
      close: () => undefined,
    });
    expect(menuEdit.some((i) => i.id === 'note-edit')).toBe(true);
    expect(menuEdit.some((i) => i.id === 'note-remove')).toBe(true);

    cleanup?.();
  });

  it('calls reload when save fails after optimistic write', async () => {
    const notesMap = signal<NotesMap | undefined>({
      [noteKey(1, 'name')]: { text: 'kept' },
    });
    let reloaded = false;
    const notes = notesPlugin<Person>({
      notes: notesMap,
      save: async () => {
        throw new Error('boom');
      },
      reload: () => {
        reloaded = true;
      },
    });

    await expect(notes.setNote(1, 'city', { text: 'x' })).rejects.toThrow('boom');
    expect(reloaded).toBe(true);
  });
});
