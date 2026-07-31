import { signal } from '@angular/core';
import { ALShortcutPlugin } from '../shortcut.types';
import { ALShortcutService } from '../shortcut.service';

export interface ALShortcutCommandPalettePlugin extends ALShortcutPlugin {
  readonly visible: () => boolean;
  toggle(): void;
  open(): void;
  close(): void;
  getShortcuts(): ReturnType<ALShortcutService['getShortcuts']>;
}

/**
 * Functional plugin to display an interactive Command Palette overlay in the UI.
 * Allows searching shortcuts, navigating via arrow keys/mouse, and triggering commands directly.
 */
export function commandPalettePlugin(
  config: {
    triggerShortcut?: string;
    preventDefault?: boolean;
    placeholder?: string;
  } = {}
): ALShortcutCommandPalettePlugin {
  const visible = signal(false);
  let serviceRef: ALShortcutService | null = null;
  let unsubToggle: (() => void) | null = null;
  let containerEl: HTMLElement | null = null;
  let query = '';
  let selectedIndex = 0;
  let filteredShortcuts: ReturnType<ALShortcutService['getShortcuts']> = [];

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

  function getMatchingShortcuts(): ReturnType<ALShortcutService['getShortcuts']> {
    const list = serviceRef?.getShortcuts() || [];
    // Deduplicate / filter out our own command palette toggle trigger if wanted, or keep it.
    // Also skip keyup entries to keep the command palette clean for executions.
    const executable = list.filter(item => item.type !== 'keyup');
    
    if (!query) {
      return executable;
    }
    
    const lowercaseQuery = query.toLowerCase();
    return executable.filter(item => {
      const shortcutMatch = item.shortcut.toLowerCase().includes(lowercaseQuery);
      const descMatch = (item.description || '').toLowerCase().includes(lowercaseQuery);
      return shortcutMatch || descMatch;
    });
  }

  function handleCommandTrigger(item: any): void {
    if (!serviceRef) return;
    try {
      serviceRef.trigger(item);
    } catch (e) {
      console.error('Failed to trigger action:', e);
    }
    closePalette();
  }

  function updateFocus(): void {
    if (!containerEl) return;
    const items = containerEl.querySelectorAll('.al-pal-item');
    items.forEach((el, index) => {
      if (index === selectedIndex) {
        el.classList.add('al-pal-item-focused');
        el.scrollIntoView({ block: 'nearest' });
      } else {
        el.classList.remove('al-pal-item-focused');
      }
    });
  }

  function renderListHTML(): string {
    if (filteredShortcuts.length === 0) {
      return `<div class="al-pal-no-results">No commands found for "${escapeHtml(query)}"</div>`;
    }
    return filteredShortcuts.map((item, index) => {
      const keysHtml = item.shortcut
        .split('+')
        .map((k) => `<span class="al-pal-kbd">${escapeHtml(k)}</span>`)
        .join('');
      const focusedClass = index === selectedIndex ? 'al-pal-item-focused' : '';
      const desc = escapeHtml(item.description || `Trigger ${item.shortcut}`);
      return `
        <li class="al-pal-item ${focusedClass}" data-index="${index}">
          <span class="al-pal-item-desc">${desc}</span>
          <div class="al-pal-keys">${keysHtml}</div>
        </li>
      `;
    }).join('');
  }

  function bindListInteractions(): void {
    if (!containerEl) return;
    const items = containerEl.querySelectorAll('.al-pal-item');
    items.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-index') || '0', 10);
        if (selectedIndex !== idx) {
          selectedIndex = idx;
          items.forEach(itemEl => itemEl.classList.remove('al-pal-item-focused'));
          el.classList.add('al-pal-item-focused');
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
    const doc = serviceRef?.document || (typeof document !== 'undefined' ? document : null);
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

    // Dynamic partial update optimization to completely resolve navigation flashing/flickering!
    const existingList = containerEl?.querySelector('#al-pal-items-list');
    if (containerEl && existingList) {
      existingList.innerHTML = renderListHTML();
      bindListInteractions();
      return;
    }

    if (!containerEl) {
      containerEl = doc.createElement('div');
      containerEl.id = 'al-command-palette-container';
      doc.body.appendChild(containerEl);
    }

    const styleMarkup = `
      <style>
        .al-pal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.45); display: flex; align-items: flex-start; justify-content: center; z-index: 999999; backdrop-filter: blur(4px); font-family: system-ui, -apple-system, sans-serif; padding-top: 10vh; box-sizing: border-box; }
        .al-pal-modal { background: #ffffff; border-radius: 12px; max-width: 600px; width: 95%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; animation: alPalSlideIn 0.15s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }
        .al-pal-search-wrapper { display: flex; align-items: center; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; background: #ffffff; gap: 12px; }
        .al-pal-search-icon { font-size: 1.25rem; color: #94a3b8; }
        .al-pal-input { border: none; outline: none; font-size: 1rem; width: 100%; color: #1e293b; background: transparent; font-family: inherit; }
        .al-pal-list { max-height: 330px; overflow-y: auto; padding: 8px 0; background: #ffffff; margin: 0; list-style: none; }
        .al-pal-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; cursor: pointer; font-size: 0.9rem; color: #334155; transition: background 0.1s, color 0.1s; }
        .al-pal-item-desc { display: flex; align-items: center; gap: 8px; color: #475569; font-weight: 500; }
        .al-pal-item-focused { background: #3b82f6; color: #ffffff !important; }
        .al-pal-item-focused .al-pal-item-desc { color: #ffffff !important; }
        .al-pal-item-focused .al-pal-kbd { background-color: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.4); color: #ffffff; }
        .al-pal-keys { display: flex; gap: 4px; }
        .al-pal-kbd { background-color: #f1f5f9; border-radius: 4px; border: 1px solid #e2e8f0; color: #475569; display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 6px; font-family: monospace; box-shadow: 0 1px 0 rgba(0,0,0,0.05); }
        .al-pal-no-results { padding: 24px 18px; text-align: center; color: #64748b; font-size: 0.9rem; background: #ffffff; }
        .al-pal-footer { display: flex; align-items: center; justify-content: flex-end; padding: 10px 18px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 0.75rem; color: #64748b; gap: 14px; }
        .al-pal-tip { display: flex; align-items: center; gap: 4px; }
        .al-pal-tip kbd { font-weight: bold; background: #e2e8f0; border-radius: 3px; padding: 1px 4px; font-family: monospace; font-size: 0.7rem; }
        @keyframes alPalSlideIn {
          from { transform: translateY(-10px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      </style>
    `;

    containerEl.innerHTML = `
      ${styleMarkup}
      <div class="al-pal-backdrop">
        <div class="al-pal-modal">
          <div class="al-pal-search-wrapper">
            <span class="al-pal-search-icon">🔍</span>
            <input type="text" class="al-pal-input" id="al-pal-search-input" value="${escapeHtml(query)}" placeholder="${escapeHtml(placeholderText)}" autocomplete="off" />
          </div>
          <ul class="al-pal-list" id="al-pal-items-list">
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
        selectedIndex = 0; // Reset index on search
        renderDOM();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredShortcuts.length > 0) {
            selectedIndex = (selectedIndex + 1) % filteredShortcuts.length;
            updateFocus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredShortcuts.length > 0) {
            selectedIndex = (selectedIndex - 1 + filteredShortcuts.length) % filteredShortcuts.length;
            updateFocus();
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
    toggle() { setVisible(!visible()); },
    open() { setVisible(true); },
    close() { setVisible(false); },
    getShortcuts() { return serviceRef?.getShortcuts() || []; },
    onInit(service) {
      serviceRef = service;
      unsubToggle = service.register({
        shortcut: triggerKeys,
        action: () => setVisible(!visible()),
        preventDefault: config.preventDefault ?? true,
        description: 'Open Command Palette'
      });
    },
    onDestroy() {
      unsubToggle?.();
      closePalette();
    }
  };
}
