/**
 * Platform-aware primary modifier: Meta on Apple, Ctrl elsewhere.
 */
export function getModKey(): 'meta' | 'ctrl' {
  if (typeof navigator !== 'undefined') {
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      ?? navigator.platform
      ?? '';
    if (/mac|iphone|ipad|ipod/i.test(platform)) {
      return 'meta';
    }
  }
  return 'ctrl';
}

/**
 * Normalise a shortcut string for map lookup (synonyms, mod, sorted tokens).
 * Examples: `Cmd+S` → `meta+s`, `mod+s` → `meta+s` | `ctrl+s`, `esc` → `escape`.
 * Empty / whitespace-only input returns `''` (used by rebind to disable a binding).
 */
export function normaliseShortcut(shortcut: string): string {
  if (!shortcut.trim()) {
    return '';
  }

  const mod = getModKey();
  return shortcut
    .toLowerCase()
    .split('+')
    .map((k) => {
      const token = k.trim();
      if (token === 'cmd' || token === 'command' || token === '⌘') return 'meta';
      if (token === 'control' || token === 'ctl') return 'ctrl';
      if (token === 'option' || token === '⌥') return 'alt';
      if (token === 'esc') return 'escape';
      if (token === 'mod') return mod;
      if (token === '' || token === ' ') return 'space';
      return token;
    })
    .filter(Boolean)
    .sort()
    .join('+');
}

/**
 * Format a normalised or raw shortcut for display (platform glyphs on Apple).
 */
export function formatShortcut(shortcut: string): string {
  const normalised = normaliseShortcut(shortcut);
  if (!normalised) return '';

  const isApple = getModKey() === 'meta';
  const parts = normalised.split('+');

  if (!isApple) {
    return parts
      .map((p) => {
        if (p === 'ctrl') return 'Ctrl';
        if (p === 'meta') return 'Meta';
        if (p === 'alt') return 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'escape') return 'Esc';
        if (p === 'space') return 'Space';
        return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join('+');
  }

  const modifiers: string[] = [];
  const keys: string[] = [];
  for (const p of parts) {
    if (p === 'ctrl') modifiers.push('⌃');
    else if (p === 'alt') modifiers.push('⌥');
    else if (p === 'shift') modifiers.push('⇧');
    else if (p === 'meta') modifiers.push('⌘');
    else if (p === 'escape') keys.push('Esc');
    else if (p === 'space') keys.push('Space');
    else keys.push(p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1));
  }
  return [...modifiers, ...keys].join('');
}

/**
 * Resolve a keyboard event to the same normalised shortcut string used by the core service.
 * Pass `layoutMap` from {@link ALShortcutHost.getLayoutMap} when available.
 */
export function resolveShortcutFromEvent(
  event: KeyboardEvent,
  layoutMap: ReadonlyMap<string, string> | null = null
): string {
  const keys: string[] = [];
  if (event.ctrlKey) keys.push('ctrl');
  if (event.metaKey) keys.push('meta');
  if (event.altKey) keys.push('alt');
  if (event.shiftKey) keys.push('shift');

  let key = event.key ? event.key.toLowerCase() : '';

  if (key !== 'control' && key !== 'meta' && key !== 'alt' && key !== 'shift') {
    if (key === ' ' || event.code === 'Space') {
      keys.push('space');
    } else if (key) {
      const hasModifiers = event.altKey || event.metaKey || event.ctrlKey || event.shiftKey;

      if (hasModifiers && event.code) {
        let resolvedKey: string | undefined = '';
        if (layoutMap) {
          resolvedKey = layoutMap.get(event.code);
        }

        if (resolvedKey) {
          keys.push(resolvedKey.toLowerCase());
        } else if (event.code.startsWith('Key')) {
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
