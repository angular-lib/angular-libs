/**
 * GridKernel — stable non-UI core: focus, find navigation, capabilities, slots.
 * The DataGrid component binds inputs/outputs and owns Angular template state.
 */

import { Injector, signal, untracked, type WritableSignal } from '@angular/core';
import { FocusController, type FocusCell } from '../controllers/focus';
import { FindController } from '../controllers/find';
import { DataGridApi } from '../api/grid-api';
import { GridCapabilities } from '../plugins/capabilities';
import {
  activatePlugins,
  DataGridSlotRegistry,
  type DataGridPlugin,
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
  onFocusChange?: (cell: FocusCell | null) => void;
  onStartEdit?: (cell: FocusCell, reason: 'enter' | 'f2') => void;
  onCancelEdit?: () => void;
  onToggleSelect?: (rowIndex: number) => void;
  onSelectAll?: () => boolean | void;
  onToggleGroup?: (rowIndex: number) => void;
  isGroupRow?: (rowIndex: number) => boolean;
  getPageRowCount?: () => number;
  onHeaderActivate?: (columnId: string, multi: boolean) => void;
  onOpenColumnMenu?: (columnId: string) => void;
  hasFloatingFilters?: () => boolean;
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

  private pluginCleanup: (() => void) | null = null;
  private interactionCleanups: Array<() => void> = [];
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
      onFocusChange: (cell) => {
        this.options.onFocusChange?.(cell);
      },
      onStartEdit: (cell, reason) => this.options.onStartEdit?.(cell, reason),
      onCancelEdit: () => this.options.onCancelEdit?.(),
      onToggleSelect: (i) => this.options.onToggleSelect?.(i),
      onSelectAll: () => this.options.onSelectAll?.() ?? false,
      onToggleGroup: (i) => this.options.onToggleGroup?.(i),
      isGroupRow: (i) => this.options.isGroupRow?.(i) ?? false,
      getPageRowCount: () => this.options.getPageRowCount?.() ?? 10,
      onHeaderActivate: (columnId, multi) => this.options.onHeaderActivate?.(columnId, multi),
      onOpenColumnMenu: (columnId) => this.options.onOpenColumnMenu?.(columnId),
      hasFloatingFilters: () => this.options.hasFloatingFilters?.() ?? false,
    });

    this.find = new FindController({
      getMatchCount: () => this.options.getFindMatchCount(),
      getActiveIndex: () => this.options.getFindActiveIndex(),
      setActiveIndex: (i) => this.options.setFindActiveIndex(i),
      onNavigate: () => this.options.onFindNavigate?.(),
    });
  }

  pluginContext(element: HTMLElement): DataGridPluginContext<T> {
    return {
      api: this.options.api,
      element,
      injector: this.injector,
      slots: this.slots,
      capabilities: this.capabilities,
    };
  }

  /**
   * Imperative plugin lifecycle — never call from an `effect` that should track
   * slot/capability reads. Registry mutation runs inside `untracked` so a
   * mistaken reactive caller cannot freeze the app.
   */
  activatePlugins(plugins: readonly DataGridPlugin<T>[], element: HTMLElement): void {
    this.hostElement = element;
    untracked(() => {
      this.teardownPlugins();
      const ctx = this.pluginContext(element);
      this.pluginCleanup = activatePlugins(plugins, ctx);
      this.attachInteractions(element);
      this.warnRowDragWithDisplayBuilder();
    });
  }

  /**
   * Re-run setup with a new list after mount (e.g. `createGrid().setPlugins`).
   * No-ops until the binder has activated once. Prefer held-adapter toggles for chrome.
   */
  recomposePlugins(plugins: readonly DataGridPlugin<T>[]): void {
    const element = this.hostElement;
    if (!element) {
      return;
    }
    this.activatePlugins(plugins, element);
  }

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

  private attachInteractions(element: HTMLElement): void {
    for (const interaction of this.capabilities.getInteractions()) {
      const cleanup = interaction.setup(element);
      if (typeof cleanup === 'function') {
        this.interactionCleanups.push(cleanup);
      }
    }
  }

  teardownPlugins(): void {
    for (const cleanup of this.interactionCleanups.splice(0).reverse()) {
      cleanup();
    }
    this.pluginCleanup?.();
    this.pluginCleanup = null;
    this.slots.clearAll();
    this.capabilities.clearAll();
  }

  /** Binder destroy — clears host so late `recomposePlugins` is a no-op. */
  destroy(): void {
    this.teardownPlugins();
    this.hostElement = null;
  }
}
