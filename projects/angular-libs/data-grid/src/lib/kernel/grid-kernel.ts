/**
 * GridKernel — stable non-UI core: focus, find navigation, capabilities, slots.
 * The DataGrid component binds inputs/outputs and owns Angular template state.
 */

import {
  ErrorHandler,
  Injector,
  signal,
  untracked,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { FocusController, type FocusCell, type FocusChangeReason } from '../controllers/focus';
import { FindController } from '../controllers/find';
import { DataGridApi } from '../api/grid-api';
import { GridCapabilities, type InteractionContribution } from '../plugins/capabilities';
import { GridAdapterRegistry } from '../plugins/adapter-registry';
import {
  DataGridSlotRegistry,
  dedupePlugins,
  notifyPlugin,
  setupPlugin,
  type ActivePlugin,
  type DataGridPlugin,
  type PluginHook,
  type DataGridPluginContext,
  type DataGridSidebarSlotItem,
  type DataGridStatusBarSlotItem,
  type DataGridToolbarSlotItem,
  type FindFeatureConfig,
} from '../plugins/types';
import type { SideBarConfig } from '../components/data-grid/data-grid.types';

export interface GridKernelOptions<T> {
  api: DataGridApi<T>;
  getDisplayRowCount: () => number;
  getColumnIds: () => string[];
  ensureRowVisible?: (rowIndex: number) => void;
  onFocusChange?: (cell: FocusCell | null, reason?: FocusChangeReason) => void;
  /** Stable display-row identity at `rowIndex` — focus follows the row (K4). */
  getRowKey?: (rowIndex: number) => string | undefined;
  findRowIndex?: (rowKey: string) => number;
  onStartEdit?: (cell: FocusCell, reason: 'enter' | 'f2') => void;
  onCancelEdit?: () => void;
  onToggleSelect?: (rowIndex: number) => void;
  onSelectAll?: () => boolean | void;
  onToggleGroup?: (rowIndex: number) => void;
  /** Enter on a focused cell widget — enter its nested widget (see `registerCellWidget`). */
  onEnterWidget?: (rowIndex: number) => boolean;
  isGroupRow?: (rowIndex: number) => boolean;
  isSkipRow?: (rowIndex: number) => boolean;
  getPageRowCount?: () => number;
  onHeaderActivate?: (columnId: string, multi: boolean) => void;
  onOpenColumnMenu?: (columnId: string) => void;
  hasFloatingFilters?: () => boolean;
  hasColumnGroups?: () => boolean;
  onFloatingFilterEnter?: (columnId: string) => boolean;
  onExtendRange?: (dRow: number, dCol: number) => boolean;
  onClearRange?: () => void;
  getFindMatchCount: () => number;
  getFindActiveIndex: () => number;
  setFindActiveIndex: (index: number) => void;
  onFindNavigate?: () => void;
}

/**
 * Owns plugin lifecycle + capability registry + focus/find controllers.
 */
export class GridKernel<T = unknown> {
  readonly capabilities = new GridCapabilities<T>();
  /** Held adapters published by this grid's plugins (`api.getAdapter`). */
  readonly adapters = new GridAdapterRegistry();

  readonly toolbarSlotItems: WritableSignal<DataGridToolbarSlotItem[]> = signal([]);
  readonly statusBarSlotItems: WritableSignal<DataGridStatusBarSlotItem[]> = signal([]);
  readonly sidebarSlotItems: WritableSignal<DataGridSidebarSlotItem[]> = signal([]);
  readonly findConfig: WritableSignal<FindFeatureConfig | null> = signal(null);
  readonly sideBarConfig: WritableSignal<boolean | SideBarConfig | null> = signal(null);
  readonly rowDragEnabled = signal(false);
  readonly pasteEnabled = signal(false);
  readonly copyEnabled = signal(false);

  readonly slots = new DataGridSlotRegistry(
    this.toolbarSlotItems,
    this.statusBarSlotItems,
    this.sidebarSlotItems,
    this.findConfig,
    this.sideBarConfig,
    this.rowDragEnabled,
    this.pasteEnabled,
    this.copyEnabled,
  );

  readonly focus: FocusController;
  readonly find: FindController;

  /** Set-up plugins in list order, keyed by instance identity. */
  private active = new Map<DataGridPlugin<T>, ActivePlugin<T>>();
  private readonly activeList: WritableSignal<readonly DataGridPlugin<T>[]> = signal([]);
  /** Last deduped input list — recomposition no-ops when it is unchanged. */
  private lastInput: readonly DataGridPlugin<T>[] = [];
  /** Attached interaction contributions → their cleanup. */
  private readonly attached = new Map<InteractionContribution, (() => void) | null>();
  /** Host element once the binder has mounted — required for recomposition. */
  private hostElement: HTMLElement | null = null;
  private rowDragDisplayWarn = false;

  constructor(
    private readonly options: GridKernelOptions<T>,
    private readonly injector: Injector,
  ) {
    this.focus = new FocusController({
      getRowCount: () => this.options.getDisplayRowCount(),
      getColumnIds: () => this.options.getColumnIds(),
      ensureRowVisible: (i) => this.options.ensureRowVisible?.(i),
      onFocusChange: (cell, reason) => {
        this.options.onFocusChange?.(cell, reason);
      },
      getRowKey: (i) => this.options.getRowKey?.(i),
      findRowIndex: (key) => this.options.findRowIndex?.(key) ?? -1,
      onStartEdit: (cell, reason) => this.options.onStartEdit?.(cell, reason),
      onCancelEdit: () => this.options.onCancelEdit?.(),
      onToggleSelect: (i) => this.options.onToggleSelect?.(i),
      onSelectAll: () => this.options.onSelectAll?.() ?? false,
      onToggleGroup: (i) => this.options.onToggleGroup?.(i),
      onEnterWidget: (i) => this.options.onEnterWidget?.(i) ?? false,
      isGroupRow: (i) => this.options.isGroupRow?.(i) ?? false,
      isSkipRow: (i) => this.options.isSkipRow?.(i) ?? false,
      getPageRowCount: () => this.options.getPageRowCount?.() ?? 10,
      onHeaderActivate: (columnId, multi) => this.options.onHeaderActivate?.(columnId, multi),
      onOpenColumnMenu: (columnId) => this.options.onOpenColumnMenu?.(columnId),
      hasFloatingFilters: () => this.options.hasFloatingFilters?.() ?? false,
      hasColumnGroups: () => this.options.hasColumnGroups?.() ?? false,
      onFloatingFilterEnter: (columnId) =>
        this.options.onFloatingFilterEnter?.(columnId) ?? false,
      onExtendRange: (dRow, dCol) => this.options.onExtendRange?.(dRow, dCol) ?? false,
      onClearRange: () => this.options.onClearRange?.(),
    });

    this.find = new FindController({
      getMatchCount: () => this.options.getFindMatchCount(),
      getActiveIndex: () => this.options.getFindActiveIndex(),
      setActiveIndex: (i) => this.options.setFindActiveIndex(i),
      onNavigate: () => this.options.onFindNavigate?.(),
    });
  }

  /** Plugins currently set up (deduped; excludes plugins whose `setup` threw). */
  readonly activePlugins: Signal<readonly DataGridPlugin<T>[]> = this.activeList.asReadonly();

  /** Unscoped base context — plugins receive a per-plugin scoped view of it. */
  pluginContext(element: HTMLElement): DataGridPluginContext<T> {
    return {
      api: this.options.api,
      element,
      injector: this.injector,
      slots: this.slots,
      capabilities: this.capabilities,
      adapters: this.adapters,
    };
  }

  /**
   * Imperative plugin lifecycle — never call from an `effect` that should track
   * slot/capability reads. Registry mutation runs inside `untracked` so a
   * mistaken reactive caller cannot freeze the app. Each plugin's setup /
   * cleanup / interactions are isolated: failures go to Angular's `ErrorHandler`.
   */
  activatePlugins(plugins: readonly DataGridPlugin<T>[], element: HTMLElement): void {
    this.hostElement = element;
    this.syncPlugins(plugins, element);
  }

  /**
   * Reconcile to a new list after mount (the binder calls this when the
   * controller's plugin signal changes). Keyed by instance identity: removed
   * instances are torn down, added ones set up, unchanged ones untouched.
   * No-ops until the binder has activated once, or when the list is unchanged.
   */
  recomposePlugins(plugins: readonly DataGridPlugin<T>[]): void {
    const element = this.hostElement;
    if (!element) {
      return;
    }
    this.syncPlugins(plugins, element);
  }

  /** Run a lifecycle hook on every active plugin with its own context. */
  notifyPlugins(hook: PluginHook, payload: unknown): void {
    for (const entry of this.active.values()) {
      notifyPlugin(entry.plugin, entry.context, hook, payload, this.reportPluginError);
    }
  }

  private syncPlugins(plugins: readonly DataGridPlugin<T>[], element: HTMLElement): void {
    untracked(() => {
      const next = dedupePlugins(plugins);
      const current = this.lastInput;
      if (next.length === current.length && next.every((p, i) => p === current[i])) {
        return;
      }
      this.lastInput = next;
      const keep = new Set(next);
      for (const [plugin, entry] of [...this.active].reverse()) {
        if (!keep.has(plugin)) {
          this.active.delete(plugin);
          entry.dispose();
        }
      }
      this.syncInteractions(element);
      const base = this.pluginContext(element);
      const ordered = new Map<DataGridPlugin<T>, ActivePlugin<T>>();
      for (const plugin of next) {
        const entry = this.active.get(plugin) ?? setupPlugin(plugin, base, this.reportPluginError);
        if (entry) {
          ordered.set(plugin, entry);
        }
      }
      this.active = ordered;
      this.activeList.set([...ordered.keys()]);
      this.syncInteractions(element);
      this.warnRowDragWithDisplayBuilder();
    });
  }

  /** Detach interactions no longer registered, attach new ones — each isolated. */
  private syncInteractions(element: HTMLElement): void {
    const registered = new Set(this.capabilities.getInteractions());
    for (const [interaction, cleanup] of [...this.attached].reverse()) {
      if (!registered.has(interaction)) {
        this.attached.delete(interaction);
        this.runInteractionCleanup(interaction, cleanup);
      }
    }
    for (const interaction of registered) {
      if (this.attached.has(interaction)) {
        continue;
      }
      try {
        const cleanup = interaction.setup(element);
        this.attached.set(interaction, typeof cleanup === 'function' ? cleanup : null);
      } catch (err) {
        this.attached.set(interaction, null);
        this.reportPluginError(err, 'interaction setup', interaction.id);
      }
    }
  }

  private runInteractionCleanup(
    interaction: InteractionContribution,
    cleanup: (() => void) | null,
  ): void {
    try {
      cleanup?.();
    } catch (err) {
      this.reportPluginError(err, 'interaction cleanup', interaction.id);
    }
  }

  /** Route plugin failures to Angular's `ErrorHandler` (console fallback). */
  private readonly reportPluginError = (error: unknown, phase: string, id?: string): void => {
    const wrapped = new Error(`[data-grid] plugin ${phase} failed${id ? ` (${id})` : ''}`, {
      cause: error,
    });
    const handler = this.injector.get(ErrorHandler, null);
    if (handler) {
      handler.handleError(wrapped);
    } else {
      console.error(wrapped);
    }
  };

  private warnRowDragWithDisplayBuilder(): void {
    if (this.rowDragDisplayWarn) {
      return;
    }
    if (this.rowDragEnabled() && this.capabilities.hasDisplayBuilder()) {
      this.rowDragDisplayWarn = true;
      console.warn(
        '[data-grid] rowDragPlugin is ignored while grouping/tree produces non-data display rows (idle rowGroup with empty columns still allows drag)',
      );
    }
  }

  teardownPlugins(): void {
    untracked(() => {
      for (const [interaction, cleanup] of [...this.attached].reverse()) {
        this.runInteractionCleanup(interaction, cleanup);
      }
      this.attached.clear();
      for (const entry of [...this.active.values()].reverse()) {
        entry.dispose();
      }
      this.active = new Map();
      this.activeList.set([]);
      this.lastInput = [];
      this.slots.clearAll();
      this.capabilities.clearAll();
      this.adapters.clearAll();
    });
  }

  /** Binder destroy — clears host so late `recomposePlugins` is a no-op. */
  destroy(): void {
    this.teardownPlugins();
    this.hostElement = null;
  }
}
