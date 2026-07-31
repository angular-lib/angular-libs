import { ALShortcutPlugin } from '../shortcut.types';

export interface ALShortcutTwicePlugin extends ALShortcutPlugin {
  /**
   * Register a shortcut to run when a single key is typed/pressed twice rapidly.
   * Accepts keys like "shift", "ctrl", "alt", "meta", "escape", "space", "a", etc.
   */
  register(
    sequence: string,
    action: (event: KeyboardEvent) => void,
    options?: { description?: string; preventDefault?: boolean }
  ): () => void;

  /**
   * Return list of active registered double-presses.
   */
  getTwiceRegistrations(): { sequence: string; description?: string }[];
}

/**
 * Functional plugin to allow action triggers when a modifier or standard key is tapped rapidly twice.
 * Handy for patterns like double-pressing 'Shift' or 'Escape'.
 */
export function twicePlugin(
  config: {
    delayMs?: number;
    ignoreInputs?: boolean;
  } = {}
): ALShortcutTwicePlugin {
  const delayMs = config.delayMs ?? 300;
  const ignoreInputs = config.ignoreInputs ?? true;

  interface RegisteredTwice {
    key: string;
    action: (event: KeyboardEvent) => void;
    description?: string;
    preventDefault?: boolean;
  }

  const registrations: RegisteredTwice[] = [];
  let lastKey = '';
  let lastTime = 0;
  let count = 0;
  let globalListener: ((event: KeyboardEvent) => void) | null = null;

  function normaliseKey(k: string): string {
    const val = k.toLowerCase().trim();
    if (val === 'control' || val === 'ctrl') return 'control';
    if (val === 'meta' || val === 'cmd') return 'meta';
    if (val === 'alt') return 'alt';
    if (val === 'shift') return 'shift';
    if (val === 'escape' || val === 'esc') return 'escape';
    if (val === 'space' || val === ' ') return ' ';
    return val;
  }

  function handleKeyUp(event: KeyboardEvent): boolean {
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
          lastKey = '';
          count = 0;
          return false;
        }
      }
    }

    const currentKey = event.key ? event.key.toLowerCase() : '';
    if (!currentKey) return false;

    const normCurrent = currentKey === 'control' ? 'control' : currentKey;

    const now = Date.now();
    if (normCurrent === lastKey && (now - lastTime) <= delayMs) {
      count++;
    } else {
      count = 1;
    }

    lastKey = normCurrent;
    lastTime = now;

    if (count === 2) {
      const matched = registrations.filter(r => r.key === normCurrent);
      if (matched.length > 0) {
        if (matched[0].preventDefault ?? true) {
          event.preventDefault();
          event.stopPropagation();
        }
        matched.forEach(entry => entry.action(event));
        lastKey = '';
        count = 0;
        return true;
      }
    }
    return false;
  }

  return {
    id: 'twice',
    onKeyEvent(event) {
      if (event.type === 'keyup') {
        return handleKeyUp(event);
      }
      return false;
    },
    onDestroy() {
      registrations.length = 0;
    },
    register(sequence, action, options = {}) {
      const targetKey = normaliseKey(sequence);
      const entry: RegisteredTwice = {
        key: targetKey,
        action,
        description: options.description,
        preventDefault: options.preventDefault,
      };
      registrations.push(entry);

      return () => {
        const idx = registrations.indexOf(entry);
        if (idx !== -1) {
          registrations.splice(idx, 1);
        }
      };
    },
    getTwiceRegistrations() {
      return registrations.map(r => ({
        sequence: r.key === ' ' ? 'space' : r.key,
        description: r.description,
      }));
    }
  };
}
