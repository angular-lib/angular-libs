/**
 * Edit start/stop interaction policy (OVERVIEW §5b).
 * Prefer presets; sparse overrides only for shipped keys.
 */

export type EditInteractionPreset = 'default' | 'excel';

export interface EditInteractionConfig {
  /** Pointer gesture to enter cell edit. Default: `'dblclick'`. */
  pointerStart?: 'dblclick' | 'click' | 'none';
  /** Enter when focused cell is idle. Default: `'startEdit'`. */
  enterIdle?: 'startEdit' | 'moveDown';
  /** Enter while cell editor is open. Default: `'commit'`. */
  enterEditing?: 'commit' | 'commitAndMoveDown';
  /** Built-in editor blur. Default: `'commit'`. */
  editorBlur?: 'commit' | 'cancel';
  /**
   * Tab while a cell editor is open.
   * - `'browser'` — leave navigation to the browser (forms-friendly; default preset)
   * - `'commitAndMove'` — commit and move to the next/prev cell (Shift+Tab); excel preset
   */
  tabEditing?: 'commitAndMove' | 'browser';
  /**
   * Printable key / Backspace / Delete on an idle focused cell.
   * - `'replace'` — start edit and replace the cell value with the typed char (or clear)
   * - `'off'` — ignore (Enter / F2 / pointer still edit)
   * Default: `'replace'`. Space is reserved for selection / group toggle.
   */
  typeToEdit?: 'off' | 'replace';
  /**
   * While a fullRow editor input is focused:
   * - `'caret'` — arrows stay in the field (forms-friendly; Tab moves)
   * - `'moveHorizontal'` — ←→ move to adjacent cell editor
   * Cell edit mode always uses caret. Home/End/↑↓ are never stolen.
   */
  arrowEditing?: 'caret' | 'moveHorizontal';
}

export type EditInteractionInput = EditInteractionPreset | EditInteractionConfig;

export interface ResolvedEditInteraction {
  pointerStart: 'dblclick' | 'click' | 'none';
  enterIdle: 'startEdit' | 'moveDown';
  enterEditing: 'commit' | 'commitAndMoveDown';
  editorBlur: 'commit' | 'cancel';
  tabEditing: 'commitAndMove' | 'browser';
  typeToEdit: 'off' | 'replace';
  arrowEditing: 'caret' | 'moveHorizontal';
}

const PRESETS: Record<EditInteractionPreset, ResolvedEditInteraction> = {
  default: {
    pointerStart: 'dblclick',
    enterIdle: 'startEdit',
    enterEditing: 'commit',
    editorBlur: 'commit',
    tabEditing: 'browser',
    typeToEdit: 'replace',
    arrowEditing: 'caret',
  },
  excel: {
    pointerStart: 'click',
    enterIdle: 'startEdit',
    enterEditing: 'commitAndMoveDown',
    editorBlur: 'commit',
    tabEditing: 'commitAndMove',
    typeToEdit: 'replace',
    arrowEditing: 'moveHorizontal',
  },
};

export function resolveEditInteraction(
  input?: EditInteractionInput | null,
): ResolvedEditInteraction {
  if (input == null || input === 'default') {
    return { ...PRESETS.default };
  }
  if (input === 'excel') {
    return { ...PRESETS.excel };
  }
  const base = PRESETS.default;
  return {
    pointerStart: input.pointerStart ?? base.pointerStart,
    enterIdle: input.enterIdle ?? base.enterIdle,
    enterEditing: input.enterEditing ?? base.enterEditing,
    editorBlur: input.editorBlur ?? base.editorBlur,
    tabEditing: input.tabEditing ?? base.tabEditing,
    typeToEdit: input.typeToEdit ?? base.typeToEdit,
    arrowEditing: input.arrowEditing ?? base.arrowEditing,
  };
}

/** Printable / Backspace / Delete — excluding Space (selection) and modified shortcuts. */
export function isTypeToEditKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    return true;
  }
  // Single Unicode char; exclude Space (selection / group toggle).
  return event.key.length === 1 && event.key !== ' ';
}

/** Column shape needed for type-to-edit seed resolution (no DOM / forms). */
export interface TypeToEditColumn {
  type?: string;
  filter?: unknown;
  cellEditor?: unknown;
  cellEditorParams?: { values?: unknown };
  field?: string;
  id?: string;
}

export type TypeToEditSeed =
  | { action: 'ignore' }
  | { action: 'open' }
  | { action: 'set'; value: unknown };

/**
 * Resolve how a type-to-edit key should seed the editor draft / row field.
 * `seed` is `''` for Backspace/Delete, otherwise `event.key`.
 */
export function resolveTypeToEditSeed(
  column: TypeToEditColumn,
  currentValue: unknown,
  seed: string,
  editMode: 'cell' | 'fullRow',
): TypeToEditSeed {
  const selectLike =
    column.cellEditor === 'select' || !!column.cellEditorParams?.values;
  const customEditor = typeof column.cellEditor === 'function';

  // Select / custom component: open without free-text replace.
  if (selectLike || customEditor) {
    return { action: 'open' };
  }

  const booleanLike =
    column.type === 'boolean' ||
    column.filter === 'boolean' ||
    typeof currentValue === 'boolean';
  // Cell-mode checkboxes toggle via Enter/F2 — not type-to-edit.
  if (editMode === 'cell' && booleanLike) {
    return { action: 'ignore' };
  }
  // fullRow boolean: open checkbox, don't seed a string.
  if (editMode === 'fullRow' && booleanLike) {
    return { action: 'open' };
  }

  const dateLike = column.type === 'date' || column.filter === 'date' || column.cellEditor === 'date';
  if (dateLike) {
    if (seed === '') {
      return { action: 'set', value: editMode === 'fullRow' ? null : '' };
    }
    return { action: 'open' };
  }

  const numberLike =
    column.type === 'number' || column.filter === 'number' || column.cellEditor === 'number';
  if (numberLike) {
    if (seed === '') {
      return { action: 'set', value: editMode === 'fullRow' ? null : '' };
    }
    if (editMode === 'fullRow') {
      const n = Number(seed);
      return { action: 'set', value: Number.isFinite(n) ? n : seed };
    }
    return { action: 'set', value: seed };
  }

  return { action: 'set', value: seed };
}
