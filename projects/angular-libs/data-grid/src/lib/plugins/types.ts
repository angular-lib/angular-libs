import { signal, type Signal, type Type, type WritableSignal } from '@angular/core';
import type {
  DataGridFilterState,
  DataGridState,
  SideBarConfig,
  SortState,
} from '../components/data-grid/data-grid.types';
import type { DataGridApi } from '../api/grid-api';
import type { GridCapabilities } from './capabilities';
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
}

export interface DataGridSidebarSlotItem {
  id: string;
  label: string;
  order?: number;
  component?: Type<unknown>;
}

export interface FindFeatureConfig {
  caseSensitive?: boolean;
}

export interface InfiniteScrollFeatureConfig {
  threshold: number;
}

/**
 * Context provided to plugin lifecycle hooks.
 * Prefer `api` + `capabilities` over reaching into the component.
 */
export interface DataGridPluginContext<T = unknown> {
  api: DataGridApi<T>;
  element: HTMLElement;
  injector: import('@angular/core').Injector;
  slots: DataGridSlotRegistry;
  /** Register row-model / interaction / aggregate contributions. */
  capabilities: GridCapabilities<T>;
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
    selectedIds: Array<string | number>,
  ): void;
  onSortChange?(context: DataGridPluginContext<T>, sorts: SortState[]): void;
  onFilterChange?(context: DataGridPluginContext<T>, filters: DataGridFilterState): void;
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

export function activatePlugins<T>(
  plugins: readonly DataGridPlugin<T>[],
  context: DataGridPluginContext<T>,
): () => void {
  const cleanups: Array<() => void> = [];
  for (const plugin of dedupePlugins(plugins)) {
    try {
      const cleanup = plugin.setup?.(context);
      if (typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
    } catch (err) {
      console.error(`[data-grid] plugin setup failed${plugin.id ? ` (${plugin.id})` : ''}`, err);
    }
  }
  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (err) {
        console.error('[data-grid] plugin cleanup failed', err);
      }
    }
  };
}

export function notifyPlugins<T>(
  plugins: readonly DataGridPlugin<T>[],
  context: DataGridPluginContext<T>,
  hook: keyof Pick<
    DataGridPlugin<T>,
    'onStateChange' | 'onSelectionChange' | 'onSortChange' | 'onFilterChange'
  >,
  payload: unknown,
): void {
  for (const plugin of dedupePlugins(plugins)) {
    try {
      const fn = plugin[hook] as
        | ((ctx: DataGridPluginContext<T>, payload: unknown) => void)
        | undefined;
      fn?.(context, payload);
    } catch (err) {
      console.error(
        `[data-grid] plugin ${hook} failed${plugin.id ? ` (${plugin.id})` : ''}`,
        err,
      );
    }
  }
}

export type SlotSignals = {
  toolbar: Signal<DataGridToolbarSlotItem[]>;
  statusBar: Signal<DataGridStatusBarSlotItem[]>;
  sidebar: Signal<DataGridSidebarSlotItem[]>;
};
