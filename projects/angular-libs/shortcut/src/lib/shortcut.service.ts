import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { ALShortcutPlugin, ALShortcutConfig } from './shortcut.types';

/**
 * A highly simplified, zoneless, signal/action-based shortcut manager.
 * SSR-safe, utilizes native event listeners, and clean Injectable/Directive designs.
 */
@Injectable({ providedIn: 'root' })
export class ALShortcutService implements OnDestroy {
  readonly document = inject(Document, { optional: true }) || (typeof document !== 'undefined' ? document : null);
  
  /**
   * Reactive state exposing the latest triggered shortcut execution details.
   */
  readonly latestTriggerDetail = signal<{ shortcut: string; event: KeyboardEvent; target: Element | null } | null>(null);

  private readonly registeredShortcuts = new Map<string, ALShortcutConfig[]>();
  private readonly plugins: ALShortcutPlugin[] = [];
  private globalListener: ((event: KeyboardEvent) => void) | null = null;
  private layoutMap: ReadonlyMap<string, string> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && this.document) {
      // Direct bind since we are zoneless-first (no NgZone bypass needed or legacy overhead!)
      this.globalListener = (event: KeyboardEvent) => this.handleKeyEvent(event);
      this.document.addEventListener('keydown', this.globalListener, true); // true: capture phase to catch inputs properly
      this.document.addEventListener('keyup', this.globalListener, true);

      // Query Chromium-based native physical layout translations safely
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (nav && nav.keyboard && typeof nav.keyboard.getLayoutMap === 'function') {
        nav.keyboard.getLayoutMap()
          .then((map: ReadonlyMap<string, string>) => {
            this.layoutMap = map;
          })
          .catch(() => {});
      }
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.document && this.globalListener) {
      this.document.removeEventListener('keydown', this.globalListener, true);
      this.document.removeEventListener('keyup', this.globalListener, true);
      this.globalListener = null;
    }
    this.registeredShortcuts.clear();
    this.plugins.forEach(p => p.onDestroy?.());
    this.plugins.length = 0;
  }

  /**
   * Register a plugin dynamic context.
   */
  registerPlugin<P extends ALShortcutPlugin>(plugin: P): P {
    plugin.onInit?.(this);
    this.plugins.push(plugin);
    return plugin;
  }

  /**
   * Register a shortcut with an action callback, or bulk register multiple shortcuts.
   * Accepts either a single config object or an array of configurations, returning a single teardown function.
   * @param config A single shortcut config or an array of shortcut configs.
   * @returns Unsubscribe function to release registered listeners.
   */
  register(config: ALShortcutConfig | ALShortcutConfig[]): () => void {
    if (Array.isArray(config)) {
      const unsubscribes = config.map(c => this.register(c));
      return () => unsubscribes.forEach(unsub => unsub());
    }

    const normalisedShortcut = this.normaliseShortcut(config.shortcut);
    const priority = config.priority ?? 0;
    const preventDefault = config.preventDefault ?? true;
    const allowRepeat = config.allowRepeat ?? false;
    const type = config.type ?? 'keydown';
    const { element, action, description } = config;

    const list = this.registeredShortcuts.get(normalisedShortcut) || [];
    const entry: ALShortcutConfig = { shortcut: config.shortcut, action, element, priority, preventDefault, description, allowRepeat, type };
    list.push(entry);
    // Sort descending by priority so higher priorities execute first
    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.registeredShortcuts.set(normalisedShortcut, list);

    return () => {
      const activeList = this.registeredShortcuts.get(normalisedShortcut);
      if (activeList) {
        const index = activeList.indexOf(entry);
        if (index !== -1) {
          activeList.splice(index, 1);
        }
        if (activeList.length === 0) {
          this.registeredShortcuts.delete(normalisedShortcut);
        }
      }
    };
  }

  /**
   * Returns a list of registered shortcuts for programmatic inspection.
   */
  getShortcuts(): { shortcut: string; defaultShortcut: string; priority: number; hasElementScope: boolean; description?: string; type: 'keydown' | 'keyup' }[] {
    const results: { shortcut: string; defaultShortcut: string; priority: number; hasElementScope: boolean; description?: string; type: 'keydown' | 'keyup' }[] = [];
    this.registeredShortcuts.forEach((list, defaultShortcut) => {
      let finalShortcut = defaultShortcut;
      for (const plugin of this.plugins) {
        if (plugin.onGetDisplayShortcut) {
          const display = plugin.onGetDisplayShortcut(defaultShortcut);
          if (display !== undefined) {
            finalShortcut = display;
          }
        }
      }
      if (finalShortcut === '') {
        return; // Skip disabled shortcuts
      }
      list.forEach(item => {
        results.push({
          shortcut: finalShortcut,
          defaultShortcut: defaultShortcut,
          priority: item.priority ?? 0,
          hasElementScope: !!item.element,
          description: item.description,
          type: item.type ?? 'keydown',
        });
      });
    });
    return results;
  }

  /**
   * Programmatically trigger/execute registered shortcut actions for a given shortcut key or descriptor.
   * @param target The shortcut string (e.g. 'ctrl+s') or a descriptor object from `getShortcuts()`.
   * @param customEvent Optional KeyboardEvent to pass to the action callback.
   * @returns `true` if a matching action was triggered, `false` otherwise.
   */
  trigger(
    target: string | { shortcut?: string; defaultShortcut?: string; description?: string; priority?: number; type?: 'keydown' | 'keyup' },
    customEvent?: KeyboardEvent
  ): boolean {
    const keyString = typeof target === 'string'
      ? target
      : (target.defaultShortcut || target.shortcut || '');
    if (!keyString) return false;

    let normalised = this.normaliseShortcut(keyString);
    let list = this.registeredShortcuts.get(normalised);

    // If not found directly, check if target is a display shortcut that maps to a default shortcut
    if (!list || list.length === 0) {
      for (const [defKey] of this.registeredShortcuts.entries()) {
        let displayKey = defKey;
        for (const plugin of this.plugins) {
          if (plugin.onGetDisplayShortcut) {
            const display = plugin.onGetDisplayShortcut(defKey);
            if (display !== undefined) displayKey = display;
          }
        }
        if (this.normaliseShortcut(displayKey) === normalised) {
          normalised = defKey;
          list = this.registeredShortcuts.get(normalised);
          break;
        }
      }
    }

    if (!list || list.length === 0) return false;

    let matchedItems = list;
    if (typeof target === 'object') {
      if (target.description !== undefined || target.priority !== undefined || target.type !== undefined) {
        const filtered = list.filter(item =>
          (target.description === undefined || item.description === target.description) &&
          (target.priority === undefined || (item.priority ?? 0) === target.priority) &&
          (target.type === undefined || (item.type ?? 'keydown') === target.type)
        );
        if (filtered.length > 0) {
          matchedItems = filtered;
        }
      }
    }

    const matchedKey = typeof target === 'object' ? (target.shortcut || keyString) : keyString;
    const event = customEvent || new KeyboardEvent('keydown', {
      key: matchedKey.split('+').pop() || '',
      ctrlKey: matchedKey.includes('ctrl'),
      metaKey: matchedKey.includes('meta'),
      altKey: matchedKey.includes('alt'),
      shiftKey: matchedKey.includes('shift'),
      bubbles: true,
      cancelable: true,
    });

    for (const item of matchedItems) {
      this.latestTriggerDetail.set({ shortcut: normalised, event, target: null });
      item.action(event);
      for (const plugin of this.plugins) {
        plugin.onAfterExecute?.(normalised, event, null);
      }
    }

    return true;
  }

  private handleKeyEvent(event: KeyboardEvent): void {
    // Run plugins onKeyEvent interceptor first — a true return consumes the event.
    for (const plugin of this.plugins) {
      if (plugin.onKeyEvent?.(event) === true) {
        return;
      }
    }

    if (this.registeredShortcuts.size === 0) return;

    let activeShortcut = this.getShortcutFromEvent(event);
    
    // Resolve active shortcut through plugins
    for (const plugin of this.plugins) {
      if (plugin.onResolveShortcut) {
        const resolved = plugin.onResolveShortcut(activeShortcut, event);
        if (resolved !== undefined) {
          activeShortcut = resolved;
        }
      }
    }

    const list = this.registeredShortcuts.get(activeShortcut);
    if (!list || list.length === 0) return;

    // Resolve event target safely
    const target = event.target as Element | null;

    // Run plugins before hook
    for (const plugin of this.plugins) {
      if (plugin.onBeforeExecute) {
        if (plugin.onBeforeExecute(activeShortcut, event, target) === false) {
          return;
        }
      }
    }

    // Execute active listeners matching the current event elements/priority
    for (const item of list) {
      // Clean stage execution: match corresponding trigger phase config ('keydown' | 'keyup')
      if (item.type !== event.type) {
        continue;
      }

      // UX protection: by default, auto-repeat events when holding keys are suppressed
      if (event.repeat && !item.allowRepeat) {
        continue;
      }

      if (item.element) {
        // Element-level scoped shortcut check: matches only if event target is within that element or if clicked inside
        const boundEl = item.element;
        const target = event.target as Element | null;
        
        let isInside = false;
        if (boundEl === target) {
          isInside = true;
        } else if (boundEl && 'contains' in boundEl && target) {
          isInside = (boundEl as Node).contains(target);
        }
        
        if (!isInside) {
          continue; // Skip because target is outside bounded element
        }
      }

      // Execute matched action
      if (item.preventDefault) {
        event.preventDefault();
      }
      
      // Update reactive latest info
      this.latestTriggerDetail.set({ shortcut: activeShortcut, event, target });

      item.action(event);

      // Run plugins after hook
      for (const plugin of this.plugins) {
        plugin.onAfterExecute?.(activeShortcut, event, target);
      }

      // Normally, multiple global commands mapped to the same key execute sequentially (unless they are bounded).
      // We should check: if it is bound to an element scope, we break after first match. If it's a global listener,
      // we let execution continue across all registered global listeners matching the prioritised list sequence,
      // or optionally configure propagation stop. Here we change to let all global matches run unless prevented or
      // if it's the element-scoped match.
      if (item.element) {
        break;
      }
    }
  }

  private normaliseShortcut(shortcut: string): string {
    return shortcut
      .toLowerCase()
      .split('+')
      .map((k) => {
        const token = k.trim();
        if (token === 'cmd' || token === 'command' || token === '⌘') return 'meta';
        if (token === 'control' || token === 'ctl') return 'ctrl';
        if (token === 'option' || token === '⌥') return 'alt';
        if (token === 'esc') return 'escape';
        if (token === '' || token === ' ') return 'space';
        return token;
      })
      .filter(Boolean)
      .sort()
      .join('+');
  }

  private getShortcutFromEvent(event: KeyboardEvent): string {
    const keys: string[] = [];
    if (event.ctrlKey) keys.push('ctrl');
    if (event.metaKey) keys.push('meta');
    if (event.altKey) keys.push('alt');
    if (event.shiftKey) keys.push('shift');

    let key = event.key ? event.key.toLowerCase() : '';

    // If key itself is a modifier, do not append it a second time
    if (key !== 'control' && key !== 'meta' && key !== 'alt' && key !== 'shift') {
      if (key === ' ' || event.code === 'Space') {
        keys.push('space');
      } else if (key) {
        const hasModifiers = event.altKey || event.metaKey || event.ctrlKey || event.shiftKey;

        if (hasModifiers && event.code) {
          let resolvedKey: string | undefined = '';
          if (this.layoutMap) {
            resolvedKey = this.layoutMap.get(event.code);
          }

          if (resolvedKey) {
            keys.push(resolvedKey.toLowerCase());
          } else {
            // Fallback lookup when layout map is not yet resolved, or on unsupported browsers (Firefox/Safari)
            if (event.code.startsWith('Key')) {
              const physicalKey = event.code.substring(3).toLowerCase();
              keys.push(physicalKey);
            } else if (event.code.startsWith('Digit')) {
              const physicalDigit = event.code.substring(5).toLowerCase();
              keys.push(physicalDigit);
            } else {
              keys.push(key);
            }
          }
        } else {
          keys.push(key);
        }
      }
    }

    return keys.sort().join('+');
  }
}
