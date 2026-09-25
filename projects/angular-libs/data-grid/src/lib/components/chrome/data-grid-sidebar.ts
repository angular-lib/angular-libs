import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { DataGridApi } from '../../api/grid-api';
import type { DataGridFilterState, ResolvedColumn } from '../data-grid/data-grid.types';
import type { ColumnFilterModel } from '../../utils/filter-model';
import { EMPTY_SET_FILTER_OPTIONS, type SetFilterOptions } from '../../utils/filter-rows';
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
      <div class="al-dg-sidebar__tabs" role="tablist" [attr.aria-label]="locale().sidebarAriaLabel">
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
  readonly filters = input<DataGridFilterState>({});
  readonly quickFilter = input('');
  readonly locale = input.required<import('../../locale/default-locale').DataGridLocale>();
  /** Lazy set-filter option getter factory (column-layout host). */
  readonly setFilterOptions = input<(columnId: string) => () => SetFilterOptions>(
    () => () => EMPTY_SET_FILTER_OPTIONS,
  );

  readonly openPanelChange = output<string | null>();
  readonly visibilityChange = output<{ columnId: string; visible: boolean }>();
  readonly reorder = output<{ fromIndex: number; toIndex: number }>();
  readonly showAll = output<void>();
  readonly autoSize = output<void>();
  readonly filterChange = output<{ columnId: string; model: ColumnFilterModel | null }>();
  readonly quickFilterChange = output<string>();
  readonly clearAll = output<void>();

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
      filterDebounceMs: computed(() => this.controller().chrome.filterDebounceMs()),
      locale: computed(() => this.locale()),
      setColumnVisible: (columnId, visible) =>
        this.visibilityChange.emit({ columnId, visible }),
      reorderColumns: (fromIndex, toIndex) => this.reorder.emit({ fromIndex, toIndex }),
      showAllColumns: () => this.showAll.emit(),
      autoSizeColumns: () => this.autoSize.emit(),
      setFilter: (columnId, model) => this.filterChange.emit({ columnId, model }),
      setQuickFilter: (value) => this.quickFilterChange.emit(value),
      clearFilters: () => this.clearAll.emit(),
      getSetFilterOptions: (columnId) => this.setFilterOptions()(columnId)(),
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
}
