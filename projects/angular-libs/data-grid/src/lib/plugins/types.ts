import {
  signal,
  type Provider,
  type Signal,
  type Type,
  type WritableSignal,
} from '@angular/core';
import type {
  DataGridState,
  FilterChangeEvent,
  SelectionChangeEvent,
  SideBarConfig,
  SortChangeEvent,
} from '../components/data-grid/data-grid.types';
import type { DataGridApi } from '../api/grid-api';
import type { GridCapabilities } from './capabilities';
import type { GridAdapterRegistry } from './adapter-registry';
import type { GridController } from '../create-grid';

/** Named UI contribution points plugins can fill. */
export type DataGridSlotId = 'toolbar' | 'statusBar' | 'sidebar';

/**
 * Params passed to toolbar action handlers.
 * - `api` — bound grid façade (selection, focus, chrome ops)
 * - `controller` — required `[controller]` from `createGrid` (rows / applyTransaction)
 * - `context` — opaque host bag only (services, notifications, held plugins)
 */
export interface DataGridToolbarActionParams<T = unknown, C = unknown> {
  api: DataGridApi<T>;
  controller: GridController<T>;
  context: C;
  /** Present for `actionClick`; may be omitted when evaluating `disabled`. */
  event?: MouseEvent;
}

/**
 * Toolbar action contributed by plugins or `[toolbarActions]`.
 *
 * Required: `id`, `icon`, `ariaLabel`, `actionClick`.
 * Useful extras: `color`, `order`, `disabled`, `title`.
 */
export interface DataGridToolbarSlotItem<T = unknown, C = unknown> {
  id: string;
  /** Glyph / short mark shown in the button (emoji, unicode, or text). */
  icon: string;
  /** Accessible name — required for icon-only buttons. */
  ariaLabel: string;
  /** Accent color (any CSS color). */
  color?: string;
  order?: number;
  /** Native tooltip. */
  title?: string;
  disabled?: boolean | ((params: DataGridToolbarActionParams<T, C>) => boolean);
  actionClick: (params: DataGridToolbarActionParams<T, C>) => void | Promise<void>;
}

export interface DataGridStatusBarSlotItem {
  id: string;
  order?: number;
  text: () => string;
  /** This item shows the row count — the pagination footer then hides its own. */
  rowCount?: boolean;
}

export interface DataGridSidebarSlotItem {
  id: string;
  label: string;
  order?: number;
  component?: Type<unknown>;
  /**
   * Bound as `[ngComponentOutletInputs]` on the panel component.
   * Prefer a factory so signal reads stay reactive while the panel is open.
   */
  inputs?: Record<string, unknown> | (() => Record<string, unknown>);
  /** Extra DI providers merged into this panel's NgComponentOutlet injector. */
  providers?: readonly Provider[];
}

export interface FindFeatureConfig {
  caseSensitive?: boolean;
}

export interface InfiniteScrollFeatureConfig {
  threshold: number;
}

/**
 * Context provided to plugin lifecycle hooks — one per plugin **per grid**
 * (a plugin instance shared by two grids gets two contexts; keep per-grid
 * state keyed by context, not in the factory closure).
 * Prefer `api` + `capabilities` over reaching into the component.
 *
 * `slots` / `capabilities` / `adapters` are scoped to the plugin: every
 * `register*` / `enable*` made through them is undone when the plugin is torn
 * down, or when its `setup` throws.
 */
export interface DataGridPluginContext<T = unknown> {
  api: DataGridApi<T>;
  element: HTMLElement;
  injector: import('@angular/core').Injector;
  slots: DataGridSlotRegistry;
  /** Register row-model / interaction / aggregate contributions. */
  capabilities: GridCapabilities<T>;
  /** Publish held adapters for discovery (`api.getAdapter(key)`). */
  adapters: GridAdapterRegistry;
}

/**
 * Contract for a data-grid plugin (dialog/store-style factories).
 */
export interface DataGridPlugin<T = unknown> {
  readonly id?: string;
  setup?(context: DataGridPluginContext<T>): (() => void) | void;
  onStateChange?(context: DataGridPluginContext<T>, state: DataGridState): void;
  onSelectionChange?(
    context: DataGridPluginContext<T>,
    selection: SelectionChangeEvent<T>,
  ): void;
  onSortChange?(context: DataGridPluginContext<T>, event: SortChangeEvent): void;
  onFilterChange?(context: DataGridPluginContext<T>, event: FilterChangeEvent): void;
}

/**
 * Chrome slot registry (toolbar / status / sidebar / find / sideBar / drag).
 * Row-model and interaction behavior register via {@link GridCapabilities}.
 */
export class DataGridSlotRegistry {
  readonly toolbarItems: WritableSignal<DataGridToolbarSlotItem[]>;
  readonly statusBarItems: WritableSignal<DataGridStatusBarSlotItem[]>;
  readonly sidebarItems: WritableSignal<DataGridSidebarSlotItem[]>;
  readonly findConfig: WritableSignal<FindFeatureConfig | null>;
  readonly sideBarConfig: WritableSignal<boolean | SideBarConfig | null>;
  readonly rowDragEnabled: WritableSignal<boolean>;
  readonly pasteEnabled: WritableSignal<boolean>;
  readonly copyEnabled: WritableSignal<boolean>;

  constructor(
    toolbarItems: WritableSignal<DataGridToolbarSlotItem[]>,
    statusBarItems: WritableSignal<DataGridStatusBarSlotItem[]>,
    sidebarItems: WritableSignal<DataGridSidebarSlotItem[]>,
    findConfig = signal<FindFeatureConfig | null>(null),
    sideBarConfig = signal<boolean | SideBarConfig | null>(null),
    rowDragEnabled = signal(false),
    pasteEnabled = signal(false),
    copyEnabled = signal(false),
  ) {
    this.toolbarItems = toolbarItems;
    this.statusBarItems = statusBarItems;
    this.sidebarItems = sidebarItems;
    this.findConfig = findConfig;
    this.sideBarConfig = sideBarConfig;
    this.rowDragEnabled = rowDragEnabled;
    this.pasteEnabled = pasteEnabled;
    this.copyEnabled = copyEnabled;
  }

  registerToolbar(item: DataGridToolbarSlotItem): () => void {
    this.toolbarItems.update((list) => sortByOrder([...list.filter((i) => i.id !== item.id), item]));
    return () => this.toolbarItems.update((list) => list.filter((i) => i.id !== item.id));
  }

  registerStatusBar(item: DataGridStatusBarSlotItem): () => void {
    this.statusBarItems.update((list) =>
      sortByOrder([...list.filter((i) => i.id !== item.id), item]),
    );
    return () => this.statusBarItems.update((list) => list.filter((i) => i.id !== item.id));
  }

  registerSidebar(item: DataGridSidebarSlotItem): () => void {
    this.sidebarItems.update((list) => sortByOrder([...list.filter((i) => i.id !== item.id), item]));
    return () => this.sidebarItems.update((list) => list.filter((i) => i.id !== item.id));
  }

  enableFind(config: FindFeatureConfig = {}): () => void {
    this.findConfig.set(config);
    return () => {
      if (this.findConfig() === config) {
        this.findConfig.set(null);
      }
    };
  }

  enableSideBar(config: boolean | SideBarConfig = true): () => void {
    this.sideBarConfig.set(config);
    return () => {
      if (this.sideBarConfig() === config) {
        this.sideBarConfig.set(null);
      }
    };
  }

  enableRowDrag(): () => void {
    this.rowDragEnabled.set(true);
    return () => this.rowDragEnabled.set(false);
  }

  /** @deprecated Prefer capabilities.interaction — kept for chrome gating. */
  enablePaste(): () => void {
    this.pasteEnabled.set(true);
    return () => this.pasteEnabled.set(false);
  }

  /** @deprecated Prefer capabilities.interaction — kept for chrome gating. */
  enableCopy(): () => void {
    this.copyEnabled.set(true);
    return () => this.copyEnabled.set(false);
  }

  clearAll(): void {
    this.toolbarItems.set([]);
    this.statusBarItems.set([]);
    this.sidebarItems.set([]);
    this.findConfig.set(null);
    this.sideBarConfig.set(null);
    this.rowDragEnabled.set(false);
    this.pasteEnabled.set(false);
    this.copyEnabled.set(false);
  }
}

function sortByOrder<T extends { id: string; order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

export function dedupePlugins<T>(plugins: readonly DataGridPlugin<T>[]): DataGridPlugin<T>[] {
  const map = new Map<string, DataGridPlugin<T>>();
  const anonymous: DataGridPlugin<T>[] = [];
  for (const plugin of plugins) {
    if (plugin.id) {
      map.set(plugin.id, plugin);
    } else {
      anonymous.push(plugin);
    }
  }
  return [...map.values(), ...anonymous];
}

/** Reports a plugin failure (`phase` = `setup` / `cleanup` / hook name). */
export type PluginErrorReporter = (error: unknown, phase: string, pluginId?: string) => void;

const consoleReporter: PluginErrorReporter = (error, phase, pluginId) =>
  console.error(`[data-grid] plugin ${phase} failed${pluginId ? ` (${pluginId})` : ''}`, error);

/** One set-up plugin: its scoped context and a teardown that undoes everything. */
export interface ActivePlugin<T = unknown> {
  readonly plugin: DataGridPlugin<T>;
  readonly context: DataGridPluginContext<T>;
  /** Plugin cleanup, then every registration it made (each error reported, never thrown). */
  dispose(): void;
}

const REGISTRATION_METHOD = /^(register|enable)([A-Z]|$)/;

/**
 * View of a registry whose `register*` / `enable*` methods record the returned
 * cleanup via `record` (prototype methods only; own fields such as signals pass through).
 */
function scopeRegistrations<R extends object>(
  target: R,
  record: (cleanup: () => void) => () => void,
): R {
  if (!target || typeof target !== 'object') {
    return target;
  }
  return new Proxy(target, {
    get(t, key) {
      const value = Reflect.get(t, key, t) as unknown;
      if (
        typeof key !== 'string' ||
        typeof value !== 'function' ||
        Object.prototype.hasOwnProperty.call(t, key)
      ) {
        return value;
      }
      const method = value as (...args: unknown[]) => unknown;
      if (!REGISTRATION_METHOD.test(key)) {
        return method.bind(t);
      }
      return (...args: unknown[]) => {
        const out = method.apply(t, args);
        return typeof out === 'function' ? record(out as () => void) : out;
      };
    },
  });
}

/**
 * Run one plugin's `setup` against a scoped view of `base`. When `setup` throws,
 * its partial registrations are rolled back, the error is reported and `null`
 * is returned — other plugins are unaffected.
 */
export function setupPlugin<T>(
  plugin: DataGridPlugin<T>,
  base: DataGridPluginContext<T>,
  report: PluginErrorReporter = consoleReporter,
): ActivePlugin<T> | null {
  const registrations: Array<() => void> = [];
  const record = (cleanup: () => void): (() => void) => {
    let done = false;
    const once = (): void => {
      if (!done) {
        done = true;
        cleanup();
      }
    };
    registrations.push(once);
    return once;
  };
  const rollback = (): void => {
    for (const cleanup of registrations.splice(0).reverse()) {
      try {
        cleanup();
      } catch (err) {
        report(err, 'cleanup', plugin.id);
      }
    }
  };
  const context: DataGridPluginContext<T> = {
    ...base,
    slots: scopeRegistrations(base.slots, record),
    capabilities: scopeRegistrations(base.capabilities, record),
    adapters: scopeRegistrations(base.adapters, record),
  };
  let cleanup: (() => void) | null = null;
  try {
    const out = plugin.setup?.(context);
    cleanup = typeof out === 'function' ? out : null;
  } catch (err) {
    report(err, 'setup', plugin.id);
    rollback();
    return null;
  }
  return {
    plugin,
    context,
    dispose: () => {
      try {
        cleanup?.();
      } catch (err) {
        report(err, 'cleanup', plugin.id);
      }
      cleanup = null;
      rollback();
    },
  };
}

/**
 * Set up a plugin list (deduped) with per-plugin isolation — see {@link setupPlugin}.
 * Returns a teardown for all of them (reverse order).
 */
export function activatePlugins<T>(
  plugins: readonly DataGridPlugin<T>[],
  context: DataGridPluginContext<T>,
  report: PluginErrorReporter = consoleReporter,
): () => void {
  const active: ActivePlugin<T>[] = [];
  for (const plugin of dedupePlugins(plugins)) {
    const entry = setupPlugin(plugin, context, report);
    if (entry) {
      active.push(entry);
    }
  }
  return () => {
    for (const entry of active.splice(0).reverse()) {
      entry.dispose();
    }
  };
}

export type PluginHook = keyof Pick<
  DataGridPlugin,
  'onStateChange' | 'onSelectionChange' | 'onSortChange' | 'onFilterChange'
>;

/** Call `hook` on every plugin; a throwing hook is reported and skipped. */
export function notifyPlugins<T>(
  plugins: readonly DataGridPlugin<T>[],
  context: DataGridPluginContext<T>,
  hook: PluginHook,
  payload: unknown,
  report: PluginErrorReporter = consoleReporter,
): void {
  for (const plugin of dedupePlugins(plugins)) {
    notifyPlugin(plugin, context, hook, payload, report);
  }
}

/** @internal Single-plugin notify used by the kernel (per-plugin context). */
export function notifyPlugin<T>(
  plugin: DataGridPlugin<T>,
  context: DataGridPluginContext<T>,
  hook: PluginHook,
  payload: unknown,
  report: PluginErrorReporter = consoleReporter,
): void {
  try {
    const fn = plugin[hook] as
      | ((ctx: DataGridPluginContext<T>, payload: unknown) => void)
      | undefined;
    fn?.call(plugin, context, payload);
  } catch (err) {
    report(err, hook, plugin.id);
  }
}

export type SlotSignals = {
  toolbar: Signal<DataGridToolbarSlotItem[]>;
  statusBar: Signal<DataGridStatusBarSlotItem[]>;
  sidebar: Signal<DataGridSidebarSlotItem[]>;
};
