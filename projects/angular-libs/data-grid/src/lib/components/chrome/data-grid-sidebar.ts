import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { DataGridApi } from '../../api/grid-api';
import type { ResolvedColumn } from '../data-grid/data-grid.types';
import type { DataGridSidebarSlotItem } from '../../plugins/types';
import {
  DATA_GRID_SIDEBAR_HOST,
  type DataGridSidebarHost,
} from './sidebar-host';

/**
 * Generic sidebar shell — panels come only from slot registry (`registerSidebar`).
 * Built-in columns/filters/groups panels live in `@angular-libs/data-grid/plugins`.
 */
@Component({
  selector: 'al-data-grid-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet],
  template: `
    <aside
      class="al-dg-sidebar"
      [class.al-dg-sidebar--left]="position() === 'left'"
      [class.al-dg-sidebar--collapsed]="!openPanel()"
      data-testid="al-dg-sidebar"
    >
      <div class="al-dg-sidebar__tabs" role="tablist" aria-label="Grid tool panels">
        @for (panel of panels(); track panel.id) {
          <button
            type="button"
            class="al-dg-sidebar__tab"
            role="tab"
            [class.al-dg-sidebar__tab--active]="openPanel() === panel.id"
            [attr.aria-selected]="openPanel() === panel.id"
            [attr.data-testid]="'al-dg-sidebar-tab-' + panel.id"
            (click)="togglePanel(panel.id)"
          >
            {{ panel.label }}
          </button>
        }
      </div>
      @if (openPanel(); as panelId) {
        <div class="al-dg-sidebar__body" role="tabpanel">
          @if (panelComponent(panelId); as Comp) {
            <ng-container
              [ngComponentOutlet]="Comp"
              [ngComponentOutletInjector]="panelInjectorFor(panelId)"
              [ngComponentOutletInputs]="activePanelInputs()"
            />
          }
        </div>
      }
    </aside>
  `,
  styles: `
    :host {
      display: flex;
      flex: 0 0 auto;
      align-self: stretch;
      min-height: 0;
    }
    .al-dg-sidebar {
      display: flex;
      flex-direction: row;
      border-left: 1px solid var(--al-dg-border, #babfc7);
      background: var(--al-dg-header-bg, #f8f8f8);
      min-width: 44px;
      height: 100%;
      min-height: 0;
    }
    .al-dg-sidebar--left {
      flex-direction: row-reverse;
      border-left: 0;
      border-right: 1px solid var(--al-dg-border, #babfc7);
    }
    .al-dg-sidebar__tabs {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 6px;
      border-right: 1px solid var(--al-dg-border, #babfc7);
    }
    .al-dg-sidebar--left .al-dg-sidebar__tabs {
      border-right: 0;
      border-left: 1px solid var(--al-dg-border, #babfc7);
    }
    .al-dg-sidebar__tab {
      writing-mode: vertical-rl;
      border: 1px solid transparent;
      background: transparent;
      color: var(--al-dg-muted, #5f6368);
      border-radius: 6px;
      padding: 10px 4px;
      font: inherit;
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .al-dg-sidebar__tab--active {
      background: var(--al-dg-bg, #fff);
      border-color: var(--al-dg-border, #babfc7);
      color: var(--al-dg-accent, #2196f3);
    }
    .al-dg-sidebar__body {
      width: 280px;
      min-height: 0;
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-sidebar--collapsed .al-dg-sidebar__body {
      display: none;
    }
  `,
})
export class DataGridSidebar {
  private readonly parentInjector = inject(Injector);

  /** Slot-registered panels only. */
  readonly panels = input<readonly DataGridSidebarSlotItem[]>([]);
  readonly position = input<'left' | 'right'>('right');
  readonly openPanel = input<string | null>(null);
  /** Bound grid API — exposed to panels via {@link DATA_GRID_SIDEBAR_HOST}. */
  readonly api = input.required<DataGridApi<any>>();
  /** Required `[controller]` — exposed to panels via {@link DATA_GRID_SIDEBAR_HOST}. */
  readonly controller = input.required<import('../../create-grid').GridController<any>>();
  /** Host `[context]` — same bag as toolbar actions. */
  readonly context = input<unknown>(null);

  readonly columns = input.required<readonly ResolvedColumn<any>[]>();
  readonly filterableColumns = input.required<readonly ResolvedColumn<any>[]>();
  readonly hiddenColumnIds = input<readonly string[]>([]);
  readonly filters = input<Record<string, string>>({});
  readonly quickFilter = input('');
  readonly groupColumnIds = input<readonly string[]>([]);
  readonly locale = input.required<import('../../locale/default-locale').DataGridLocale>();
  /** Precomputed set-filter option lists keyed by column id. */
  readonly setFilterOptionsById = input<ReadonlyMap<string, readonly string[]>>(
    new Map(),
  );

  readonly openPanelChange = output<string | null>();
  readonly visibilityChange = output<{ columnId: string; visible: boolean }>();
  readonly reorder = output<{ fromIndex: number; toIndex: number }>();
  readonly showAll = output<void>();
  readonly autoSize = output<void>();
  readonly filterChange = output<{ columnId: string; value: string }>();
  readonly quickFilterChange = output<string>();
  readonly clearAll = output<void>();
  readonly groupColumnsChange = output<string[]>();

  /** Filter cards open in the filters tool panel (survives panel tab switches). */
  private readonly openFilterIds = signal<string[]>([]);
  private readonly expandedFilterIds = signal<ReadonlySet<string>>(new Set());

  /** Shared host object — getters close over inputs. */
  private readonly host: DataGridSidebarHost;
  private readonly injectorCache = new Map<string, Injector>();

  /**
   * Inputs for the open panel — factory form tracks signals so outlet
   * bindings update without AG-style refresh().
   */
  readonly activePanelInputs = computed((): Record<string, unknown> => {
    const id = this.openPanel();
    if (!id) {
      return {};
    }
    const panel = this.panels().find((p) => p.id === id);
    const raw = panel?.inputs;
    if (!raw) {
      return {};
    }
    return typeof raw === 'function' ? raw() : raw;
  });

  constructor() {
    // Auto-include filter cards when a filter value is set outside the panel.
    effect(() => {
      const filters = this.filters();
      const filterable = new Set(this.filterableColumns().map((c) => c.id));
      untracked(() => {
        this.openFilterIds.update((ids) => {
          let next = ids.filter((id) => filterable.has(id));
          let changed = next.length !== ids.length;
          const toExpand: string[] = [];
          for (const [id, value] of Object.entries(filters)) {
            if (value && filterable.has(id) && !next.includes(id)) {
              next = [...next, id];
              toExpand.push(id);
              changed = true;
            }
          }
          if (toExpand.length) {
            this.expandedFilterIds.update((set) => {
              const copy = new Set(set);
              for (const id of toExpand) {
                copy.add(id);
              }
              return copy;
            });
          }
          return changed ? next : ids;
        });
      });
    });

    // Drop cached injectors when the panel registry identity changes.
    effect(() => {
      this.panels();
      untracked(() => this.injectorCache.clear());
    });

    const self = this;
    this.host = {
      get api() {
        return self.api();
      },
      get controller() {
        return self.controller();
      },
      get context() {
        return self.context();
      },
      columns: computed(() => this.columns()),
      filterableColumns: computed(() => this.filterableColumns()),
      hiddenColumnIds: computed(() => this.hiddenColumnIds()),
      filters: computed(() => this.filters()),
      quickFilter: computed(() => this.quickFilter()),
      groupColumnIds: computed(() => this.groupColumnIds()),
      openFilterColumnIds: this.openFilterIds.asReadonly(),
      expandedFilterColumnIds: this.expandedFilterIds.asReadonly(),
      locale: computed(() => this.locale()),
      setColumnVisible: (columnId, visible) =>
        this.visibilityChange.emit({ columnId, visible }),
      reorderColumns: (fromIndex, toIndex) => this.reorder.emit({ fromIndex, toIndex }),
      showAllColumns: () => this.showAll.emit(),
      autoSizeColumns: () => this.autoSize.emit(),
      setFilter: (columnId, value) => this.filterChange.emit({ columnId, value }),
      setQuickFilter: (value) => this.quickFilterChange.emit(value),
      clearFilters: () => this.clearAll.emit(),
      setGroupColumns: (columnIds) => this.groupColumnsChange.emit([...columnIds]),
      getSetFilterOptions: (columnId) => this.setFilterOptionsById().get(columnId) ?? [],
      addFilterColumn: (columnId) => this.addFilterColumn(columnId),
      removeFilterColumn: (columnId) => this.removeFilterColumn(columnId),
      toggleFilterColumnExpanded: (columnId) => this.toggleFilterColumnExpanded(columnId),
    };
  }

  panelComponent(panelId: string) {
    return this.panels().find((p) => p.id === panelId)?.component ?? null;
  }

  panelInjectorFor(panelId: string): Injector {
    const cached = this.injectorCache.get(panelId);
    if (cached) {
      return cached;
    }
    const panel = this.panels().find((p) => p.id === panelId);
    const injector = Injector.create({
      providers: [
        { provide: DATA_GRID_SIDEBAR_HOST, useValue: this.host },
        ...(panel?.providers ?? []),
      ],
      parent: this.parentInjector,
    });
    this.injectorCache.set(panelId, injector);
    return injector;
  }

  togglePanel(panel: string): void {
    this.openPanelChange.emit(this.openPanel() === panel ? null : panel);
  }

  private addFilterColumn(columnId: string): void {
    const filterable = this.filterableColumns().some((c) => c.id === columnId);
    if (!filterable) {
      return;
    }
    this.openFilterIds.update((ids) => (ids.includes(columnId) ? ids : [...ids, columnId]));
    this.expandedFilterIds.update((set) => {
      if (set.has(columnId)) {
        return set;
      }
      const copy = new Set(set);
      copy.add(columnId);
      return copy;
    });
  }

  private removeFilterColumn(columnId: string): void {
    this.openFilterIds.update((ids) => ids.filter((id) => id !== columnId));
    this.expandedFilterIds.update((set) => {
      if (!set.has(columnId)) {
        return set;
      }
      const copy = new Set(set);
      copy.delete(columnId);
      return copy;
    });
    this.filterChange.emit({ columnId, value: '' });
  }

  private toggleFilterColumnExpanded(columnId: string): void {
    this.expandedFilterIds.update((set) => {
      const copy = new Set(set);
      if (copy.has(columnId)) {
        copy.delete(columnId);
      } else {
        copy.add(columnId);
      }
      return copy;
    });
  }
}
