import type {
  DataGridPlugin,
  DataGridPluginContext,
} from '@angular-libs/data-grid/plugin';
import {
  isDataDisplayRow,
  type DisplayRow,
} from '@angular-libs/data-grid/internals';
import {
  closeNotePopover,
  openNotePopover,
  type NotePopoverLabels,
  type NotePopoverMode,
} from './notes-popover';
import {
  noteKey,
  type Note,
  type NotesCellRef,
  type NotesMap,
  type NotesPluginOptions,
} from './notes.types';

export type {
  Note,
  NotesCellRef,
  NotesMap,
  NotesPluginOptions,
  NotesGetParams,
  NotesSetParams,
} from './notes.types';
export { noteKey } from './notes.types';

/** Held adapter — read/write notes without remounting plugins. */
export interface NotesAdapter {
  getNote(rowId: string | number, columnId: string): Note | undefined;
  setNote(
    rowId: string | number,
    columnId: string,
    note: Note | undefined,
  ): void | Promise<void>;
  /** Ask host to re-fetch (e.g. `notesResource.reload()`). */
  refreshNotes(): void;
}

export type NotesPlugin<T = unknown> = DataGridPlugin<T> & NotesAdapter;

/**
 * Lean cell notes: host owns async load (`resource`); plugin takes
 * `notesResource.value` (a `WritableSignal`) for the map.
 *
 * Requires a stable `rowId`. Not included in `defaultGridPlugins()`.
 *
 * @example
 * ```ts
 * notesResource = resource({
 *   loader: async ({ abortSignal }) => {
 *     const res = await fetch('/api/notes', { signal: abortSignal });
 *     return (await res.json()) as NotesMap;
 *   },
 * });
 *
 * const notes = notesPlugin({
 *   notes: notesResource.value,
 *   save: async ({ rowId, columnId, note }) => api.putNote(rowId, columnId, note),
 *   reload: () => notesResource.reload(),
 * });
 * ```
 */
export function notesPlugin<T = unknown>(options: NotesPluginOptions): NotesPlugin<T> {
  const notesSignal = options.notes;
  const save = options.save;
  const reload = options.reload;
  const showDelay = options.showDelay ?? 180;
  const hideDelay = options.hideDelay ?? 220;

  const readMap = (): NotesMap => notesSignal() ?? {};

  const adapter: NotesAdapter = {
    getNote(rowId, columnId) {
      return readMap()[noteKey(rowId, columnId)];
    },
    async setNote(rowId, columnId, note) {
      const key = noteKey(rowId, columnId);
      const next: Record<string, Note> = { ...readMap() };
      if (note === undefined) {
        delete next[key];
      } else {
        next[key] = note;
      }
      notesSignal.set(next);
      try {
        await save({ rowId, columnId, note });
      } catch (err) {
        reload?.();
        console.error('[data-grid] notes save failed', err);
        throw err;
      }
    },
    refreshNotes() {
      reload?.();
    },
  };

  const plugin: NotesPlugin<T> = {
    id: 'notes',
    getNote: (rowId, columnId) => adapter.getNote(rowId, columnId),
    setNote: (rowId, columnId, note) => adapter.setNote(rowId, columnId, note),
    refreshNotes: () => adapter.refreshNotes(),

    setup(context: DataGridPluginContext<T>): () => void {
      let popoverEl: HTMLElement | null = null;
      let activeCell: NotesCellRef | null = null;
      let activeMode: NotePopoverMode | null = null;
      let showTimer: ReturnType<typeof setTimeout> | null = null;
      let hideTimer: ReturnType<typeof setTimeout> | null = null;

      const clearShow = (): void => {
        if (showTimer) {
          clearTimeout(showTimer);
          showTimer = null;
        }
      };
      const clearHide = (): void => {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
      };

      const destroyActivePopover = (): void => {
        clearShow();
        clearHide();
        closeNotePopover(popoverEl);
        popoverEl = null;
        activeCell = null;
        activeMode = null;
      };

      const scheduleHide = (): void => {
        if (activeMode === 'edit') {
          return;
        }
        clearHide();
        hideTimer = setTimeout(() => destroyActivePopover(), hideDelay);
      };

      const sameCell = (a: NotesCellRef, b: NotesCellRef): boolean =>
        String(a.rowId) === String(b.rowId) && a.columnId === b.columnId;

      const openAt = (
        cell: NotesCellRef,
        anchorEl: HTMLElement,
        mode: NotePopoverMode,
        forceNew = false,
      ): void => {
        if (anchorEl.classList.contains('al-data-grid__td--editing')) {
          return;
        }
        clearShow();
        clearHide();
        const existing = adapter.getNote(cell.rowId, cell.columnId);
        if (mode === 'preview' && !existing) {
          return;
        }
        if (mode === 'edit' && !forceNew && !existing) {
          return;
        }

        closeNotePopover(popoverEl);
        activeCell = cell;
        activeMode = mode;
        popoverEl = openNotePopover({
          anchor: anchorEl.getBoundingClientRect(),
          note: existing,
          isNew: mode === 'edit' && (forceNew || !existing),
          mode,
          container: context.element,
          labels: noteLabels(context),
          handlers: {
            onSave: (text) => {
              const trimmed = text.trim();
              void adapter.setNote(
                cell.rowId,
                cell.columnId,
                trimmed ? { text: trimmed } : undefined,
              );
              destroyActivePopover();
            },
            onRemove: () => {
              void adapter.setNote(cell.rowId, cell.columnId, undefined);
              destroyActivePopover();
            },
            onClose: () => destroyActivePopover(),
            onPointerEnter: () => clearHide(),
            onPointerLeave: () => scheduleHide(),
          },
        });
      };

      const openEditor = (cell: NotesCellRef, forceNew: boolean): void => {
        const td =
          findCellElement(context.element, cell.rowId, cell.columnId) ??
          syntheticAnchor();
        openAt(cell, td, 'edit', forceNew);
      };

      const cleanDecorator = context.capabilities.registerCellDecorator({
        id: 'notes-marker',
        className: ({ rowId, columnId }) => {
          notesSignal();
          return adapter.getNote(rowId, columnId) ? 'al-dg-cell--has-note' : null;
        },
      });

      const cleanMenu = context.capabilities.registerContextMenuItems({
        id: 'notes-menu',
        order: 5,
        items: (ctx) => {
          const locale = context.api.getLocale();
          const existing = adapter.getNote(ctx.rowId, ctx.columnId);
          if (existing) {
            return [
              {
                id: 'note-edit',
                label: locale.noteEdit,
                shortcut: '⇧F2',
                separator: true,
                action: () =>
                  openEditor({ rowId: ctx.rowId, columnId: ctx.columnId }, false),
              },
              {
                id: 'note-remove',
                label: locale.noteRemove,
                action: () => {
                  void adapter.setNote(ctx.rowId, ctx.columnId, undefined);
                  destroyActivePopover();
                },
              },
            ];
          }
          return [
            {
              id: 'note-add',
              label: locale.noteAdd,
              shortcut: '⇧F2',
              separator: true,
              action: () =>
                openEditor({ rowId: ctx.rowId, columnId: ctx.columnId }, true),
            },
          ];
        },
      });

      const cleanInteraction = context.capabilities.registerInteraction({
        id: 'notes-ui',
        setup: (element) => {
          const onPointerOver = (event: Event): void => {
            if (activeMode === 'edit') {
              return;
            }
            const td = (event.target as HTMLElement | null)?.closest?.(
              '[data-row-id][data-column-id]',
            ) as HTMLElement | null;
            if (!td || !element.contains(td)) {
              return;
            }
            if (td.classList.contains('al-data-grid__td--editing')) {
              return;
            }
            const rowIdAttr = td.getAttribute('data-row-id');
            const columnId = td.getAttribute('data-column-id');
            if (rowIdAttr == null || columnId == null) {
              return;
            }
            const cell = { rowId: coerceId(rowIdAttr), columnId };
            if (activeCell && sameCell(activeCell, cell) && activeMode === 'preview') {
              clearHide();
              return;
            }
            if (!adapter.getNote(cell.rowId, cell.columnId)) {
              return;
            }
            clearShow();
            clearHide();
            showTimer = setTimeout(() => openAt(cell, td, 'preview'), showDelay);
          };

          const onPointerOut = (event: Event): void => {
            if (activeMode === 'edit') {
              return;
            }
            const related = (event as PointerEvent).relatedTarget as Node | null;
            if (popoverEl && related && popoverEl.contains(related)) {
              return;
            }
            const td = (event.target as HTMLElement | null)?.closest?.(
              '[data-row-id][data-column-id]',
            );
            if (!td) {
              return;
            }
            clearShow();
            scheduleHide();
          };

          const onKeydown = (event: KeyboardEvent): void => {
            if (event.key !== 'F2' || !event.shiftKey) {
              return;
            }
            event.preventDefault();
            const focus = context.api.getFocusedCell();
            if (!focus) {
              return;
            }
            const rows = context.api.getPagedDisplayRows?.() ?? [];
            const display = rows[focus.rowIndex] as DisplayRow<T> | undefined;
            if (!display || !isDataDisplayRow(display)) {
              return;
            }
            const rowId = display.rowId;
            const td = findCellElement(element, rowId, focus.columnId);
            if (!td) {
              return;
            }
            const existing = adapter.getNote(rowId, focus.columnId);
            openAt({ rowId, columnId: focus.columnId }, td, 'edit', !existing);
          };

          const onContextMenu = (): void => {
            clearShow();
            if (activeMode === 'preview') {
              destroyActivePopover();
            }
          };

          element.addEventListener('pointerover', onPointerOver);
          element.addEventListener('pointerout', onPointerOut);
          element.addEventListener('keydown', onKeydown);
          // Capture: cell handler calls stopPropagation(), so bubble never reaches us.
          element.addEventListener('contextmenu', onContextMenu, true);
          return () => {
            element.removeEventListener('pointerover', onPointerOver);
            element.removeEventListener('pointerout', onPointerOut);
            element.removeEventListener('keydown', onKeydown);
            element.removeEventListener('contextmenu', onContextMenu, true);
            destroyActivePopover();
          };
        },
      });

      return () => {
        cleanInteraction();
        cleanMenu();
        cleanDecorator();
        destroyActivePopover();
      };
    },
  };

  return plugin;
}

function noteLabels<T>(context: DataGridPluginContext<T>): NotePopoverLabels {
  const locale = context.api.getLocale();
  return {
    title: locale.noteTitle,
    add: locale.noteAdd,
    edit: locale.noteEdit,
    remove: locale.noteRemove,
    placeholder: locale.notePlaceholder,
    save: locale.save,
    cancel: locale.cancel,
  };
}

function findCellElement(
  root: HTMLElement,
  rowId: string | number,
  columnId: string,
): HTMLElement | null {
  return root.querySelector(
    `[data-row-id="${cssEscape(String(rowId))}"][data-column-id="${cssEscape(columnId)}"]`,
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/"/g, '\\"');
}

function coerceId(raw: string): string | number {
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) {
      return n;
    }
  }
  return raw;
}

function syntheticAnchor(): HTMLElement {
  const fake = document.createElement('div');
  fake.getBoundingClientRect = () =>
    ({
      left: window.innerWidth / 2 - 140,
      top: window.innerHeight / 3,
      right: window.innerWidth / 2 + 140,
      bottom: window.innerHeight / 3 + 36,
      width: 280,
      height: 36,
      x: window.innerWidth / 2 - 140,
      y: window.innerHeight / 3,
      toJSON: () => ({}),
    }) as DOMRect;
  return fake;
}
