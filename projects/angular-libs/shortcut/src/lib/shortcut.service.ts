import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  ALShortcutPlugin,
  ALShortcutConfig,
  ALShortcutConflict,
  ALShortcutDescriptor,
  ALShortcutHost,
  SHORTCUT_CONFIG,
} from './shortcut.types';
import { formatShortcut, normaliseShortcut, resolveShortcutFromEvent } from './shortcut.utils';

export type { ALShortcutDescriptor, ALShortcutConflict, ALShortcutHost };

/**
 * A highly simplified, zoneless, signal/action-based shortcut manager.
 * SSR-safe, utilizes native event listeners, and clean Injectable/Directive designs.
 */
@Injectable({ providedIn: 'root' })
export class ALShortcutService implements OnDestroy, ALShortcutHost {
  readonly document = inject(DOCUMENT, { optional: true });

  private readonly bootstrapConfig = inject(SHORTCUT_CONFIG, { optional: true });

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
      this.globalListener = (event: KeyboardEvent) => this.handleKeyEvent(event);
      this.document.addEventListener('keydown', this.globalListener, true);
      this.document.addEventListener('keyup', this.globalListener, true);

      const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }) : null;
      if (nav?.keyboard && typeof nav.keyboard.getLayoutMap === 'function') {
        nav.keyboard.getLayoutMap()
          .then((map) => {
            this.layoutMap = map;
          })
          .catch(() => {});
      }
    }

    const bootstrapPlugins = this.bootstrapConfig?.plugins;
    if (bootstrapPlugins?.length) {
      for (const plugin of bootstrapPlugins) {
        this.registerPlugin(plugin);
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
    this.plugins.forEach((p) => p.onDestroy?.());
    this.plugins.length = 0;
  }

  /**
   * Register a plugin. Hooks run in registration order.
   * If a plugin with the same `id` is already registered, returns the existing instance.
   * Prefer stable `id` values for {@link getPlugin} / {@link unregisterPlugin}.
   */
  registerPlugin<P extends ALShortcutPlugin>(plugin: P): P {
    if (plugin.id) {
      const existing = this.plugins.find((p) => p.id === plugin.id);
      if (existing) {
        return existing as P;
      }
    }
    plugin.onInit?.(this);
    this.plugins.push(plugin);
    return plugin;
  }

  /**
   * Look up a registered plugin by `id`.
   */
  getPlugin<P extends ALShortcutPlugin = ALShortcutPlugin>(id: string): P | undefined {
    return this.plugins.find((p) => p.id === id) as P | undefined;
  }

  /**
   * Unregister a plugin by `id` and call its `onDestroy` hook.
   * The plugin must unsubscribe any shortcuts it registered in `onInit`.
   * @returns `true` if a plugin was removed.
   */
  unregisterPlugin(id: string): boolean {
    const index = this.plugins.findIndex((p) => p.id === id);
    if (index === -1) return false;
    const [plugin] = this.plugins.splice(index, 1);
    plugin.onDestroy?.();
    return true;
  }

  /**
   * Register a shortcut with an action callback, or bulk register multiple shortcuts.
   */
  register(config: ALShortcutConfig | ALShortcutConfig[]): () => void {
    if (Array.isArray(config)) {
      const unsubscribes = config.map((c) => this.register(c));
      return () => unsubscribes.forEach((unsub) => unsub());
    }

    const normalisedShortcut = normaliseShortcut(config.shortcut);
    const priority = config.priority ?? 0;
    const preventDefault = config.preventDefault ?? true;
    const stopPropagation = config.stopPropagation ?? false;
    const stopImmediatePropagation = config.stopImmediatePropagation ?? false;
    const allowRepeat = config.allowRepeat ?? false;
    const type = config.type ?? 'keydown';
    const { element, action, description, id, group, when } = config;

    const list = this.registeredShortcuts.get(normalisedShortcut) || [];
    const entry: ALShortcutConfig = {
      shortcut: config.shortcut,
      action,
      element,
      priority,
      preventDefault,
      stopPropagation,
      stopImmediatePropagation,
      description,
      id,
      group,
      allowRepeat,
      type,
      when,
    };
    list.push(entry);
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

  getShortcuts(): ALShortcutDescriptor[] {
    const results: ALShortcutDescriptor[] = [];
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
        return;
      }
      list.forEach((item) => {
        results.push({
          shortcut: finalShortcut,
          defaultShortcut,
          priority: item.priority ?? 0,
          hasElementScope: !!item.element,
          description: item.description,
          id: item.id,
          group: item.group,
          type: item.type ?? 'keydown',
        });
      });
    });
    return results;
  }

  /**
   * Returns normalised shortcut keys that currently have more than one registered handler.
   */
  getConflicts(): ALShortcutConflict[] {
    const results: ALShortcutConflict[] = [];
    this.registeredShortcuts.forEach((list, shortcut) => {
      if (list.length > 1) {
        results.push({
          shortcut,
          count: list.length,
          descriptions: list.map((item) => item.description),
        });
      }
    });
    return results;
  }

  getLayoutMap(): ReadonlyMap<string, string> | null {
    return this.layoutMap;
  }

  trigger(
    target: string | Partial<ALShortcutDescriptor>,
    customEvent?: KeyboardEvent
  ): boolean {
    const keyString = typeof target === 'string'
      ? target
      : (target.defaultShortcut || target.shortcut || '');
    if (!keyString) return false;

    let normalised = normaliseShortcut(keyString);
    let list = this.registeredShortcuts.get(normalised);

    if (!list || list.length === 0) {
      for (const [defKey] of this.registeredShortcuts.entries()) {
        let displayKey = defKey;
        for (const plugin of this.plugins) {
          if (plugin.onGetDisplayShortcut) {
            const display = plugin.onGetDisplayShortcut(defKey);
            if (display !== undefined) displayKey = display;
          }
        }
        if (normaliseShortcut(displayKey) === normalised) {
          normalised = defKey;
          list = this.registeredShortcuts.get(normalised);
          break;
        }
      }
    }

    if (!list || list.length === 0) return false;

    let matchedItems = list;
    if (typeof target === 'object') {
      if (
        target.description !== undefined ||
        target.priority !== undefined ||
        target.type !== undefined ||
        target.id !== undefined ||
        target.group !== undefined
      ) {
        const filtered = list.filter((item) =>
          (target.description === undefined || item.description === target.description) &&
          (target.priority === undefined || (item.priority ?? 0) === target.priority) &&
          (target.type === undefined || (item.type ?? 'keydown') === target.type) &&
          (target.id === undefined || item.id === target.id) &&
          (target.group === undefined || item.group === target.group)
        );
        if (filtered.length > 0) {
          matchedItems = filtered;
        }
      }
    }

    const event = customEvent || new KeyboardEvent('keydown', {
      key: normalised.split('+').find((p) => !['ctrl', 'meta', 'alt', 'shift'].includes(p)) || '',
      ctrlKey: normalised.split('+').includes('ctrl'),
      metaKey: normalised.split('+').includes('meta'),
      altKey: normalised.split('+').includes('alt'),
      shiftKey: normalised.split('+').includes('shift'),
      bubbles: true,
      cancelable: true,
    });

    for (const item of matchedItems) {
      if (item.when && !item.when()) {
        continue;
      }
      this.latestTriggerDetail.set({ shortcut: normalised, event, target: null });
      item.action(event);
      for (const plugin of this.plugins) {
        plugin.onAfterExecute?.(normalised, event, null);
      }
    }

    return true;
  }

  private handleKeyEvent(event: KeyboardEvent): void {
    for (const plugin of this.plugins) {
      if (plugin.onKeyEvent?.(event) === true) {
        return;
      }
    }

    if (this.registeredShortcuts.size === 0) return;

    let activeShortcut = resolveShortcutFromEvent(event, this.layoutMap);

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

    const target = event.target as Element | null;

    for (const plugin of this.plugins) {
      if (plugin.onBeforeExecute) {
        if (plugin.onBeforeExecute(activeShortcut, event, target) === false) {
          return;
        }
      }
    }

    for (const item of list) {
      if (item.type !== event.type) {
        continue;
      }

      if (event.repeat && !item.allowRepeat) {
        continue;
      }

      if (item.when && !item.when()) {
        continue;
      }

      if (item.element) {
        const boundEl = item.element;
        const eventTarget = event.target as Element | null;

        let isInside = false;
        if (boundEl === eventTarget) {
          isInside = true;
        } else if (boundEl && 'contains' in boundEl && eventTarget) {
          isInside = (boundEl as Node).contains(eventTarget);
        }

        if (!isInside) {
          continue;
        }
      }

      if (item.preventDefault) {
        event.preventDefault();
      }
      if (item.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      } else if (item.stopPropagation) {
        event.stopPropagation();
      }

      this.latestTriggerDetail.set({ shortcut: activeShortcut, event, target });

      item.action(event);

      for (const plugin of this.plugins) {
        plugin.onAfterExecute?.(activeShortcut, event, target);
      }

      if (item.element) {
        break;
      }
    }
  }

  normaliseShortcut(shortcut: string): string {
    return normaliseShortcut(shortcut);
  }

  formatShortcut(shortcut: string): string {
    return formatShortcut(shortcut);
  }
}
