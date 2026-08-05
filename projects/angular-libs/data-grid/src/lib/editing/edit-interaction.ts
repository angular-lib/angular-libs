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
}

export type EditInteractionInput = EditInteractionPreset | EditInteractionConfig;

export interface ResolvedEditInteraction {
  pointerStart: 'dblclick' | 'click' | 'none';
  enterIdle: 'startEdit' | 'moveDown';
  enterEditing: 'commit' | 'commitAndMoveDown';
  editorBlur: 'commit' | 'cancel';
}

const PRESETS: Record<EditInteractionPreset, ResolvedEditInteraction> = {
  default: {
    pointerStart: 'dblclick',
    enterIdle: 'startEdit',
    enterEditing: 'commit',
    editorBlur: 'commit',
  },
  excel: {
    pointerStart: 'click',
    enterIdle: 'startEdit',
    enterEditing: 'commitAndMoveDown',
    editorBlur: 'commit',
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
  };
}
