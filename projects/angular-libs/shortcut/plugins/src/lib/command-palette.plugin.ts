import { signal } from '@angular/core';
import type {
  ALShortcutDescriptor,
  ALShortcutHost,
  ALShortcutPlugin,
} from '@angular-libs/shortcut';
import { formatShortcut } from '@angular-libs/shortcut';

/**
 * @experimental Interactive command palette overlay. DOM markup and CSS class names
 * are not a stable contract in 0.0.x — prefer `open` / `close` / `toggle` / `getPlugin('command-palette')`.
 * See README “Experimental UI plugins”.
 */
export interface ALShortcutCommandPalettePlugin extends ALShortcutPlugin {
  readonly visible: () => boolean;
  toggle(): void;
  open(): void;
  close(): void;
  getShortcuts(): ALShortcutDescriptor[];
}

/**
 * Functional plugin to display an interactive Command Palette overlay in the UI.
 *
 * @experimental Browser-only DOM overlay. API surface beyond open/close/toggle may change.
 */
export function commandPalettePlugin(
  config: {
    triggerShortcut?: string;
    preventDefault?: boolean;
    placeholder?: string;
  } = {}
): ALShortcutCommandPalettePlugin {
  const visible = signal(false);
  let hostRef: ALShortcutHost | null = null;
  let unsubToggle: (() => void) | null = null;
  let containerEl: HTMLElement | null = null;
  let query = '';
  let selectedIndex = 0;
  let filteredShortcuts: ALShortcutDescriptor[] = [];

  const triggerKeys = config.triggerShortcut || 'ctrl+shift+p';
  const placeholderText = config.placeholder || 'Type a command or search shortcuts...';

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getMatchingShortcuts(): ALShortcutDescriptor[] {
    const list = hostRef?.getShortcuts() || [];
    const executable = list.filter((item) => item.type !== 'keyup');

    if (!query) {
      return executable;
    }

    const lowercaseQuery = query.toLowerCase();
    return executable.filter((item) => {
      const shortcutMatch = item.shortcut.toLowerCase().includes(lowercaseQuery);
      const descMatch = (item.description || '').toLowerCase().includes(lowercaseQuery);
      const groupMatch = (item.group || '').toLowerCase().includes(lowercaseQuery);
      return shortcutMatch || descMatch || groupMatch;
    });
  }

  function handleCommandTrigger(item: ALShortcutDescriptor): void {
    if (!hostRef) return;
    try {
      hostRef.trigger(item);
    } catch (e) {
      console.error('Failed to trigger action:', e);
    }
    closePalette();
  }

  function updateFocus(): void {
    if (!containerEl) return;
    const items = containerEl.querySelectorAll('.al-pal-item');
    items.forEach((el, index) => {
      const selected = index === selectedIndex;
      el.classList.toggle('al-pal-item-focused', selected);
      el.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) {
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function renderListHTML(): string {
    if (filteredShortcuts.length === 0) {
      return `<div class="al-pal-no-results" role="status">No commands found for "${escapeHtml(query)}"</div>`;
    }
    return filteredShortcuts
      .map((item, index) => {
        const display = formatShortcut(item.shortcut);
        const keysHtml = display
          ? `<span class="al-pal-kbd">${escapeHtml(display)}</span>`
          : item.shortcut
              .split('+')
              .map((k) => `<span class="al-pal-kbd">${escapeHtml(k)}</span>`)
              .join('');
        const focusedClass = index === selectedIndex ? 'al-pal-item-focused' : '';
        const desc = escapeHtml(item.description || `Trigger ${item.shortcut}`);
        const selected = index === selectedIndex ? 'true' : 'false';
        return `
        <li class="al-pal-item ${focusedClass}" role="option" id="al-pal-option-${index}" data-index="${index}" aria-selected="${selected}">
          <span class="al-pal-item-desc">${desc}</span>
          <div class="al-pal-keys">${keysHtml}</div>
        </li>
      `;
      })
      .join('');
  }

  function bindListInteractions(): void {
    if (!containerEl) return;
    const items = containerEl.querySelectorAll('.al-pal-item');
    items.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-index') || '0', 10);
        if (selectedIndex !== idx) {
          selectedIndex = idx;
          updateFocus();
        }
      });

      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index') || '0', 10);
        if (filteredShortcuts[idx]) {
          handleCommandTrigger(filteredShortcuts[idx]);
        }
      });
    });
  }

  function renderDOM(): void {
    const doc = hostRef?.document || (typeof document !== 'undefined' ? document : null);
    if (typeof window === 'undefined' || !doc) {
      return;
    }

    if (!visible()) {
      if (containerEl) {
        containerEl.remove();
        containerEl = null;
      }
      return;
    }

    filteredShortcuts = getMatchingShortcuts();
    if (selectedIndex >= filteredShortcuts.length) {
      selectedIndex = Math.max(0, filteredShortcuts.length - 1);
    }

    const existingList = containerEl?.querySelector('#al-pal-items-list');
    if (containerEl && existingList) {
      existingList.innerHTML = renderListHTML();
      bindListInteractions();
      updateFocus();
      return;
    }

    if (!containerEl) {
      containerEl = doc.createElement('div');
      containerEl.id = 'al-command-palette-container';
      doc.body.appendChild(containerEl);
    }

    const styleMarkup = `
      <style>
        .al-pal-backdrop {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: var(--al-pal-backdrop, rgba(15, 23, 42, 0.45));
          display: flex; align-items: flex-start; justify-content: center;
          z-index: 999999; backdrop-filter: blur(4px);
          font-family: system-ui, -apple-system, sans-serif;
          padding-top: 10vh; box-sizing: border-box;
        }
        .al-pal-modal {
          background: var(--al-pal-bg, #ffffff);
          color: var(--al-pal-fg, #1e293b);
          border-radius: var(--al-pal-radius, 12px);
          max-width: 600px; width: 95%;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
          border: 1px solid var(--al-pal-border, #e2e8f0);
          animation: alPalSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden;
        }
        .al-pal-search-wrapper {
          display: flex; align-items: center; padding: 14px 18px;
          border-bottom: 1px solid var(--al-pal-border, #f1f5f9);
          background: var(--al-pal-bg, #ffffff); gap: 12px;
        }
        .al-pal-search-icon { font-size: 1.25rem; color: var(--al-pal-muted, #94a3b8); }
        .al-pal-input {
          border: none; outline: none; font-size: 1rem; width: 100%;
          color: var(--al-pal-fg, #1e293b); background: transparent; font-family: inherit;
        }
        .al-pal-list {
          max-height: 330px; overflow-y: auto; padding: 8px 0;
          background: var(--al-pal-bg, #ffffff); margin: 0; list-style: none;
        }
        .al-pal-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 18px; cursor: pointer; font-size: 0.9rem;
          color: var(--al-pal-fg, #334155); transition: background 0.1s, color 0.1s;
        }
        .al-pal-item-desc { display: flex; align-items: center; gap: 8px; color: var(--al-pal-muted-fg, #475569); font-weight: 500; }
        .al-pal-item-focused {
          background: var(--al-pal-accent, #3b82f6);
          color: var(--al-pal-accent-fg, #ffffff) !important;
        }
        .al-pal-item-focused .al-pal-item-desc { color: var(--al-pal-accent-fg, #ffffff) !important; }
        .al-pal-item-focused .al-pal-kbd {
          background-color: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.4);
          color: var(--al-pal-accent-fg, #ffffff);
        }
        .al-pal-keys { display: flex; gap: 4px; }
        .al-pal-kbd {
          background-color: var(--al-pal-kbd-bg, #f1f5f9);
          border-radius: 4px; border: 1px solid var(--al-pal-border, #e2e8f0);
          color: var(--al-pal-muted-fg, #475569); display: inline-block;
          font-size: 0.75rem; font-weight: 700; padding: 2px 6px; font-family: monospace;
          box-shadow: 0 1px 0 rgba(0,0,0,0.05);
        }
        .al-pal-no-results {
          padding: 24px 18px; text-align: center;
          color: var(--al-pal-muted, #64748b); font-size: 0.9rem;
          background: var(--al-pal-bg, #ffffff);
        }
        .al-pal-footer {
          display: flex; align-items: center; justify-content: flex-end;
          padding: 10px 18px; background: var(--al-pal-footer-bg, #f8fafc);
          border-top: 1px solid var(--al-pal-border, #f1f5f9);
          font-size: 0.75rem; color: var(--al-pal-muted, #64748b); gap: 14px;
        }
        .al-pal-tip { display: flex; align-items: center; gap: 4px; }
        .al-pal-tip kbd {
          font-weight: bold; background: var(--al-pal-kbd-bg, #e2e8f0);
          border-radius: 3px; padding: 1px 4px; font-family: monospace; font-size: 0.7rem;
        }
        @keyframes alPalSlideIn {
          from { transform: translateY(-10px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      </style>
    `;

    containerEl.innerHTML = `
      ${styleMarkup}
      <div class="al-pal-backdrop">
        <div
          class="al-pal-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="al-pal-title"
        >
          <h2 id="al-pal-title" class="al-pal-sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Command palette</h2>
          <div class="al-pal-search-wrapper">
            <span class="al-pal-search-icon" aria-hidden="true">🔍</span>
            <label for="al-pal-search-input" class="al-pal-sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;">Search commands</label>
            <input
              type="text"
              class="al-pal-input"
              id="al-pal-search-input"
              value="${escapeHtml(query)}"
              placeholder="${escapeHtml(placeholderText)}"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="al-pal-items-list"
              aria-expanded="true"
              aria-activedescendant="${filteredShortcuts.length ? `al-pal-option-${selectedIndex}` : ''}"
            />
          </div>
          <ul class="al-pal-list" id="al-pal-items-list" role="listbox" aria-label="Commands">
            ${renderListHTML()}
          </ul>
          <div class="al-pal-footer">
            <span class="al-pal-tip"><kbd>↑↓</kbd> Navigate</span>
            <span class="al-pal-tip"><kbd>↵</kbd> Select</span>
            <span class="al-pal-tip"><kbd>esc</kbd> Close</span>
          </div>
        </div>
      </div>
    `;

    const input = containerEl.querySelector('#al-pal-search-input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);

      input.addEventListener('input', (e) => {
        query = (e.target as HTMLInputElement).value;
        selectedIndex = 0;
        renderDOM();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredShortcuts.length > 0) {
            selectedIndex = (selectedIndex + 1) % filteredShortcuts.length;
            updateFocus();
            input.setAttribute('aria-activedescendant', `al-pal-option-${selectedIndex}`);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredShortcuts.length > 0) {
            selectedIndex = (selectedIndex - 1 + filteredShortcuts.length) % filteredShortcuts.length;
            updateFocus();
            input.setAttribute('aria-activedescendant', `al-pal-option-${selectedIndex}`);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredShortcuts[selectedIndex]) {
            handleCommandTrigger(filteredShortcuts[selectedIndex]);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closePalette();
        }
      });
    }

    bindListInteractions();

    const backdrop = containerEl.querySelector('.al-pal-backdrop');
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closePalette();
      }
    });
  }

  function setVisible(v: boolean): void {
    if (visible() === v) return;
    visible.set(v);
    if (!v) {
      query = '';
      selectedIndex = 0;
    }
    renderDOM();
  }

  function closePalette(): void {
    setVisible(false);
  }

  return {
    id: 'command-palette',
    visible: visible.asReadonly(),
    toggle() {
      setVisible(!visible());
    },
    open() {
      setVisible(true);
    },
    close() {
      setVisible(false);
    },
    getShortcuts() {
      return hostRef?.getShortcuts() || [];
    },
    onInit(host) {
      hostRef = host;
      unsubToggle = host.register({
        shortcut: triggerKeys,
        action: () => setVisible(!visible()),
        preventDefault: config.preventDefault ?? true,
        description: 'Open Command Palette',
      });
    },
    onDestroy() {
      unsubToggle?.();
      closePalette();
      hostRef = null;
    },
  };
}
