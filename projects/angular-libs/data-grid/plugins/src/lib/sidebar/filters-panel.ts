import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import {
  DATA_GRID_SIDEBAR_HOST,
  DataGridFilterField,
  InputDebouncer,
  type DataGridSidebarHost,
  type SetFilterOptions,
} from '@angular-libs/data-grid';

/**
 * Filter-card UI state (added cards, collapsed cards). Keyed by the sidebar
 * host so it survives panel tab switches (the panel component is recreated)
 * and dies with the sidebar — no state in the core shell.
 */
interface FilterCardState {
  added: WritableSignal<readonly string[]>;
  collapsed: WritableSignal<ReadonlySet<string>>;
}

const cardStates = new WeakMap<DataGridSidebarHost, FilterCardState>();

function cardStateFor(host: DataGridSidebarHost): FilterCardState {
  let state = cardStates.get(host);
  if (!state) {
    state = { added: signal<readonly string[]>([]), collapsed: signal<ReadonlySet<string>>(new Set()) };
    cardStates.set(host, state);
  }
  return state;
}

const panelStyles = `
  :host { display: block; height: 100%; }
  .al-dg-panel {
    display: flex; flex-direction: column; gap: 10px; height: 100%;
    padding: 12px; box-sizing: border-box; overflow: auto;
  }
  .al-dg-panel__title { font-weight: 650; font-size: 13px; }
  .al-dg-panel__hint { margin: 0; color: var(--al-dg-muted, #5f6368); font-size: 12px; }
  .al-dg-panel__field {
    display: flex; flex-direction: column; gap: 4px; font-size: 12px;
    color: var(--al-dg-muted, #5f6368);
  }
  .al-dg-panel__field input[type="search"] {
    border: 1px solid var(--al-dg-border, #babfc7); border-radius: 6px;
    padding: 6px 8px; font: inherit; color: var(--al-dg-fg, #181d1f);
    background: var(--al-dg-bg, #fff);
  }
  .al-dg-panel__divider { height: 1px; background: var(--al-dg-border, #babfc7); }
  .al-dg-panel__cards {
    display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;
  }
  .al-dg-panel__card {
    border: 1px solid var(--al-dg-border, #babfc7);
    border-radius: 8px;
    background: var(--al-dg-bg, #fff);
    overflow: hidden;
  }
  .al-dg-panel__card-header {
    display: flex; align-items: center; gap: 4px;
    width: 100%; padding: 0; border: 0; background: var(--al-dg-header-bg, #f8f8f8);
  }
  .al-dg-panel__card-toggle {
    flex: 1; display: flex; align-items: center; gap: 6px;
    border: 0; background: transparent; padding: 8px 10px;
    font: inherit; font-size: 12px; font-weight: 650; text-align: left;
    color: var(--al-dg-fg, #181d1f); cursor: pointer; min-width: 0;
  }
  .al-dg-panel__card-chevron {
    flex: 0 0 auto; color: var(--al-dg-muted, #5f6368); font-size: 10px;
  }
  .al-dg-panel__card-title {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .al-dg-panel__card-active {
    flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%;
    background: var(--al-dg-accent, #2196f3);
  }
  .al-dg-panel__card-remove {
    flex: 0 0 auto; border: 0; background: transparent;
    color: var(--al-dg-muted, #5f6368); cursor: pointer;
    padding: 8px 10px; font: inherit; font-size: 14px; line-height: 1;
  }
  .al-dg-panel__card-remove:hover { color: var(--al-dg-fg, #181d1f); }
  .al-dg-panel__card-body { padding: 8px 10px 10px; }
  .al-dg-panel__add {
    display: flex; flex-direction: column; gap: 4px; font-size: 12px;
    color: var(--al-dg-muted, #5f6368);
  }
  .al-dg-panel__add select {
    border: 1px solid var(--al-dg-border, #babfc7); border-radius: 6px;
    padding: 6px 8px; font: inherit; color: var(--al-dg-fg, #181d1f);
    background: var(--al-dg-bg, #fff);
  }
  .al-dg-panel__actions { margin-top: auto; }
  .al-dg-panel__btn {
    width: 100%; border: 1px solid var(--al-dg-border, #babfc7);
    background: var(--al-dg-header-bg, #f8f8f8); border-radius: 6px;
    padding: 6px 8px; font: inherit; cursor: pointer;
  }
`;

@Component({
  selector: 'al-data-grid-filters-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGridFilterField],
  template: `
    <div class="al-dg-panel" data-testid="al-dg-filters-panel">
      <div class="al-dg-panel__title">{{ host.locale().filtersPanelTitle }}</div>
      <label class="al-dg-panel__field">
        <span>{{ host.locale().filtersQuickFilterLabel }}</span>
        <input
          type="search"
          [value]="host.quickFilter()"
          (input)="quickFilterInput.push($any($event.target).value)"
          (keydown.enter)="quickFilterInput.flush()"
          (blur)="quickFilterInput.flush()"
          [placeholder]="host.locale().quickFilterPlaceholder"
          data-testid="al-dg-quick-filter"
        />
      </label>
      <div class="al-dg-panel__divider"></div>

      @if (addableColumns().length) {
        <label class="al-dg-panel__add">
          <span>{{ host.locale().filtersAddFilter }}</span>
          <select
            data-testid="al-dg-filters-add"
            [value]="''"
            (change)="onAddFilter($any($event.target).value); $any($event.target).value = ''"
          >
            <option value="" disabled>{{ host.locale().filtersAddFilterPlaceholder }}</option>
            @for (col of addableColumns(); track col.id) {
              <option [value]="col.id">{{ col.header }}</option>
            }
          </select>
        </label>
      }

      <div class="al-dg-panel__cards">
        @for (col of openColumns(); track col.id) {
          <div
            class="al-dg-panel__card"
            [attr.data-testid]="'al-dg-filter-card-' + col.id"
          >
            <div class="al-dg-panel__card-header">
              <button
                type="button"
                class="al-dg-panel__card-toggle"
                [attr.aria-expanded]="isExpanded(col.id)"
                (click)="toggleExpanded(col.id)"
              >
                <span class="al-dg-panel__card-chevron" aria-hidden="true">
                  {{ isExpanded(col.id) ? '▼' : '▶' }}
                </span>
                <span class="al-dg-panel__card-title">{{ col.header }}</span>
                @if (host.filters()[col.id]) {
                  <span class="al-dg-panel__card-active" aria-hidden="true"></span>
                }
              </button>
              <button
                type="button"
                class="al-dg-panel__card-remove"
                [attr.aria-label]="host.locale().filtersRemoveFilter + ' ' + col.header"
                [attr.title]="host.locale().filtersRemoveFilter"
                data-testid="al-dg-filter-card-remove"
                (click)="removeCard(col.id)"
              >
                ×
              </button>
            </div>
            @if (isExpanded(col.id)) {
              <div class="al-dg-panel__card-body">
                <al-data-grid-filter-field
                  [column]="$any(col)"
                  [model]="host.filters()[col.id] ?? null"
                  [setOptions]="setOptionsFor(col.id)"
                  [ariaLabel]="host.locale().filterColumnAriaLabel + ' ' + col.header"
                  [locale]="host.locale()"
                  [debounceMs]="host.filterDebounceMs()"
                  variant="panel"
                  (modelChange)="host.setFilter(col.id, $event)"
                />
              </div>
            }
          </div>
        } @empty {
          <p class="al-dg-panel__hint">{{ host.locale().filtersNoFilters }}</p>
        }
      </div>

      <div class="al-dg-panel__actions">
        <button
          type="button"
          class="al-dg-panel__btn"
          data-testid="al-dg-filters-clear-all"
          (click)="host.clearFilters()"
        >
          {{ host.locale().filtersClearAll }}
        </button>
      </div>
    </div>
  `,
  styles: panelStyles,
})
export class DataGridFiltersPanel {
  readonly host = inject(DATA_GRID_SIDEBAR_HOST);
  private readonly cards = cardStateFor(this.host);
  private readonly setOptionGetters = new Map<string, () => SetFilterOptions>();

  /** Typed quick filter — debounced like the toolbar field. */
  readonly quickFilterInput = new InputDebouncer<string>(
    (value) => this.host.setQuickFilter(value),
    () => this.host.filterDebounceMs(),
  );

  /** Cards: explicitly added columns, then any column with an active filter. */
  readonly openColumns = computed(() => {
    const filterable = this.host.filterableColumns();
    const byId = new Map(filterable.map((c) => [c.id, c]));
    const filters = this.host.filters();
    const ids = [...this.cards.added()];
    for (const col of filterable) {
      if (filters[col.id] && !ids.includes(col.id)) {
        ids.push(col.id);
      }
    }
    return ids.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  });

  readonly addableColumns = computed(() => {
    const open = new Set(this.openColumns().map((c) => c.id));
    return this.host.filterableColumns().filter((c) => !open.has(c.id));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.quickFilterInput.cancel());
  }

  isExpanded(columnId: string): boolean {
    return !this.cards.collapsed().has(columnId);
  }

  toggleExpanded(columnId: string): void {
    this.cards.collapsed.update((set) => {
      const copy = new Set(set);
      if (!copy.delete(columnId)) {
        copy.add(columnId);
      }
      return copy;
    });
  }

  onAddFilter(columnId: string): void {
    if (!columnId || !this.host.filterableColumns().some((c) => c.id === columnId)) {
      return;
    }
    this.cards.added.update((ids) => (ids.includes(columnId) ? ids : [...ids, columnId]));
    this.cards.collapsed.update((set) => {
      if (!set.has(columnId)) {
        return set;
      }
      const copy = new Set(set);
      copy.delete(columnId);
      return copy;
    });
  }

  /** Remove the card and clear that column's filter. */
  removeCard(columnId: string): void {
    this.cards.added.update((ids) => ids.filter((id) => id !== columnId));
    this.host.setFilter(columnId, null);
  }

  setOptionsFor(columnId: string): () => SetFilterOptions {
    let getter = this.setOptionGetters.get(columnId);
    if (!getter) {
      getter = () => this.host.getSetFilterOptions(columnId);
      this.setOptionGetters.set(columnId, getter);
    }
    return getter;
  }
}
