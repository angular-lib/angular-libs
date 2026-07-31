import { ALShortcutPlugin } from '../shortcut.types';

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
  let timeoutId: any = null;
  let globalListener: ((event: KeyboardEvent) => void) | null = null;

  function normaliseStep(step: string): string {
    return step
      .toLowerCase()
      .split('+')
      .map(k => k.trim())
      .sort()
      .join('+');
  }

  function normaliseSequence(seq: string): string[] {
    return seq
      .toLowerCase()
      .split(/[\s,]+/)
      .map(step => normaliseStep(step))
      .filter(Boolean);
  }

  function getShortcutKey(event: KeyboardEvent): string {
    const keys: string[] = [];
    if (event.ctrlKey) keys.push('ctrl');
    if (event.metaKey) keys.push('meta');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');

    const key = event.key ? event.key.toLowerCase() : '';
    if (key !== 'control' && key !== 'meta' && key !== 'alt' && key !== 'shift') {
      if (key === ' ' || event.code === 'Space') {
        keys.push('space');
      } else if (key) {
        if ((event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) && event.code) {
          if (event.code.startsWith('Key')) {
            keys.push(event.code.substring(3).toLowerCase());
          } else if (event.code.startsWith('Digit')) {
            keys.push(event.code.substring(5).toLowerCase());
          } else {
            keys.push(key);
          }
        } else {
          keys.push(key);
        }
      }
    }
    return keys.sort().join('+');
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

    const key = getShortcutKey(event);
    if (!key) return false;

    // Refresh sequence reset timer
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      resetHistory();
    }, timeoutMs);

    inputHistory.push(key);

    // Deep match sequence
    let partialMatches = false;
    let exactMatch: RegisteredChord | null = null;

    for (const chord of chords) {
      const steps = chord.normalizedSteps;
      const historyLen = inputHistory.length;

      // Check if current input history matches the prefix of any chord
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
      // Only a completed chord consumes the event; partial prefixes still allow
      // registered single-key shortcuts to run (previous public behavior).
      return true;
    } else if (partialMatches) {
      // If it is a partial match, we must prevent default behavior of this sub-step
      // (e.g. pressing 'g' shouldn't do other things if we're waiting for 'd')
      if (event.ctrlKey || event.metaKey || event.altKey) {
        event.preventDefault();
      }
      return false;
    } else {
      // No match at all, clear history
      resetHistory();
      return false;
    }
  }

  return {
    id: 'chord',
    onKeyEvent(event) {
      if (event.type === 'keydown') {
        return handleKeyDown(event);
      }
      return false;
    },
    onDestroy() {
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
      return chords.map(c => ({
        sequence: c.rawSequence,
        description: c.description,
      }));
    }
  };
}
