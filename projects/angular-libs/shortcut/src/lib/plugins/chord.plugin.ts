import { ALShortcutHost, ALShortcutPlugin } from '../shortcut.types';
import { normaliseShortcut, resolveShortcutFromEvent } from '../shortcut.utils';

export interface ALShortcutChordPlugin extends ALShortcutPlugin {
  register(
    sequence: string,
    action: (event: KeyboardEvent) => void,
    options?: { description?: string; preventDefault?: boolean }
  ): () => void;
  getChords(): { sequence: string; description?: string }[];
}

/**
 * Functional plugin to allow Vim-like or VS-Code-like multi-key sequence combinations (e.g. "g d" or "ctrl+k ctrl+c").
 */
export function chordPlugin(
  config: {
    timeoutMs?: number;
    ignoreInputs?: boolean;
  } = {}
): ALShortcutChordPlugin {
  const timeoutMs = config.timeoutMs ?? 1000;
  const ignoreInputs = config.ignoreInputs ?? true;

  interface RegisteredChord {
    rawSequence: string;
    normalizedSteps: string[];
    action: (event: KeyboardEvent) => void;
    description?: string;
    preventDefault?: boolean;
  }

  const chords: RegisteredChord[] = [];
  let inputHistory: string[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let hostRef: ALShortcutHost | null = null;

  function normaliseSequence(seq: string): string[] {
    return seq
      .split(/[\s,]+/)
      .map((step) => normaliseShortcut(step))
      .filter(Boolean);
  }

  function resetHistory(): void {
    inputHistory = [];
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function handleKeyDown(event: KeyboardEvent): boolean {
    if (ignoreInputs) {
      const target = event.target as Element | null;
      if (target && 'tagName' in target) {
        const tagName = (target.tagName || '').toUpperCase();
        const isContentEditable =
          (target as HTMLElement).isContentEditable === true;
        if (
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          isContentEditable
        ) {
          resetHistory();
          return false;
        }
      }
    }

    const key = resolveShortcutFromEvent(event, hostRef?.getLayoutMap() ?? null);
    if (!key) return false;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      resetHistory();
    }, timeoutMs);

    inputHistory.push(key);

    let partialMatches = false;
    let exactMatch: RegisteredChord | null = null;

    for (const chord of chords) {
      const steps = chord.normalizedSteps;
      const historyLen = inputHistory.length;
      const isMatchSoFar = inputHistory.every((input, index) => input === steps[index]);

      if (isMatchSoFar) {
        if (historyLen === steps.length) {
          exactMatch = chord;
        } else if (historyLen < steps.length) {
          partialMatches = true;
        }
      }
    }

    if (exactMatch) {
      if (exactMatch.preventDefault ?? true) {
        event.preventDefault();
        event.stopPropagation();
      }
      exactMatch.action(event);
      resetHistory();
      return true;
    } else if (partialMatches) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        event.preventDefault();
      }
      return false;
    } else {
      resetHistory();
      return false;
    }
  }

  return {
    id: 'chord',
    onInit(host) {
      hostRef = host;
    },
    onKeyEvent(event) {
      if (event.type === 'keydown') {
        return handleKeyDown(event);
      }
      return false;
    },
    onDestroy() {
      hostRef = null;
      resetHistory();
    },
    register(sequence, action, options = {}) {
      const normalizedSteps = normaliseSequence(sequence);
      if (normalizedSteps.length === 0) {
        return () => {};
      }

      const chordEntry: RegisteredChord = {
        rawSequence: sequence,
        normalizedSteps,
        action,
        description: options.description,
        preventDefault: options.preventDefault,
      };

      chords.push(chordEntry);

      return () => {
        const index = chords.indexOf(chordEntry);
        if (index !== -1) {
          chords.splice(index, 1);
        }
      };
    },
    getChords() {
      return chords.map((c) => ({
        sequence: c.rawSequence,
        description: c.description,
      }));
    },
  };
}
