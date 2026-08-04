import { ALShortcutPlugin } from '../shortcut.types';
import { normaliseShortcut } from '../shortcut.utils';

export interface ALShortcutRebindPlugin extends ALShortcutPlugin {
  /**
   * Set a keybind override.
   * @param defaultShortcut The default shortcut pattern (e.g. "ctrl+s")
   * @param customShortcut The custom user-defined shortcut (e.g. "ctrl+shift+s" or "" to disable it)
   */
  setOverride(defaultShortcut: string, customShortcut: string): void;
  /**
   * Get override mapping for a default shortcut.
   */
  getOverride(defaultShortcut: string): string | undefined;
  /**
   * Returns a list of all currently active configuration overrides.
   */
  getOverrides(): { defaultShortcut: string; customShortcut: string }[];
  /**
   * Clear all overrides, reverting to default layout shortcuts.
   */
  clearOverrides(): void;
  /**
   * Force dynamic rebuild of registered service shortcuts with current mapping overrides.
   */
  rebuild(): void;
}

/**
 * Functional plugin to support user-customizable shortcut keys at runtime.
 * Persists overrides in localStorage, intercepts original registrations, and automatically updates
 * all references globally so that tools like Command Palette immediately reflect changes.
 */
export function rebindPlugin(
  config: {
    storageKey?: string;
  } = {}
): ALShortcutRebindPlugin {
  const storageKey = config.storageKey || 'al-shortcut-custom-keybinds';
  const customMappings = new Map<string, string>();

  // Load from localStorage if available
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([def, cust]) => {
          customMappings.set(normaliseShortcut(def), normaliseShortcut(cust as string));
        });
      }
    } catch (e) {
      console.error('Failed to load custom shortcuts:', e);
    }
  }

  function saveToStorage() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const obj: Record<string, string> = {};
        customMappings.forEach((cust, def) => {
          obj[def] = cust;
        });
        localStorage.setItem(storageKey, JSON.stringify(obj));
      } catch (e) {
        console.error('Failed to save custom shortcuts:', e);
      }
    }
  }

  return {
    id: 'rebind',
    onInit() {},
    onDestroy() {},
    onResolveShortcut(shortcut) {
      const normShortcut = normaliseShortcut(shortcut);
      // If we pressed a custom shortcut, find what default shortcut it maps to
      for (const [def, cust] of customMappings.entries()) {
        if (cust === normShortcut) {
          return def;
        }
      }
      // If the pressed shortcut is a default shortcut that has been overridden/re-bound,
      // block it from executing as its original key.
      if (customMappings.has(normShortcut)) {
        return ''; // Block
      }
      return shortcut;
    },
    onGetDisplayShortcut(shortcut) {
      const val = customMappings.get(normaliseShortcut(shortcut));
      return val !== undefined ? val : shortcut;
    },
    setOverride(defaultShortcut, customShortcut) {
      const normDef = normaliseShortcut(defaultShortcut);
      const normCust = customShortcut ? normaliseShortcut(customShortcut) : '';
      customMappings.set(normDef, normCust);
      saveToStorage();
    },
    getOverride(defaultShortcut) {
      return customMappings.get(normaliseShortcut(defaultShortcut));
    },
    getOverrides() {
      const results: { defaultShortcut: string; customShortcut: string }[] = [];
      customMappings.forEach((customShortcut, defaultShortcut) => {
        results.push({ defaultShortcut, customShortcut });
      });
      return results;
    },
    clearOverrides() {
      customMappings.clear();
      saveToStorage();
    },
    rebuild() {
      // Dynamic resolution makes manual rebuild calls obsolete!
    }
  };
}
