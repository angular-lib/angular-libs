/**
 * Lean cell-notes contracts — host owns async (`resource`); plugin takes resource.value.
 */

export interface Note {
  text: string;
}

/** Canonical notes bag keyed by {@link noteKey}. */
export type NotesMap = Readonly<Record<string, Note>>;

export interface NotesCellRef {
  rowId: string | number;
  columnId: string;
}

export interface NotesGetParams extends NotesCellRef {}

export interface NotesSetParams extends NotesCellRef {
  /** Pass `undefined` to remove the note. */
  note: Note | undefined;
}

export function noteKey(rowId: string | number, columnId: string): string {
  return `${rowId}:${columnId}`;
}

/**
 * Writable notes bag — satisfied by `notesResource.value` or `signal<NotesMap>()`.
 * Structural so both `WritableSignal<NotesMap>` and `… | undefined` work.
 */
export interface NotesSignal {
  (): NotesMap | undefined;
  set(value: NotesMap): void;
}

export interface NotesPluginOptions {
  /**
   * Writable host notes map. Prefer `notesResource.value` directly
   * (`undefined` while loading is treated as `{}`).
   */
  notes: NotesSignal;
  /** Persist create/update/delete after optimistic `notes.set`. */
  save: (params: NotesSetParams) => void | Promise<void>;
  /** After failed save — e.g. `() => notesResource.reload()`. */
  reload?: () => void;
  /** Delay before showing an existing note preview on hover (ms). Default 180. */
  showDelay?: number;
  /** Delay before hiding the preview after pointer leaves the cell (ms). Default 220. */
  hideDelay?: number;
}
