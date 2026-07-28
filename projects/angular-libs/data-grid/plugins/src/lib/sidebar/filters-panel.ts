import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DATA_GRID_SIDEBAR_HOST, DataGridFilterField } from '@angular-libs/data-grid';

const panelStyles = `
  :host { display: block; height: 100%; }
  .al-dg-panel {
    display: flex; flex-direction: column; gap: 10px; height: 100%;
    padding: 12px; box-sizing: border-box; overflow: auto;
  }
  .al-dg-panel__title { font-weight: 650; font-size: 13px; }
  .al-dg-panel__hint { margin: 0; color: var(--al-dg-muted, #6b7280); font-size: 12px; }
  .al-dg-panel__field {
    display: flex; flex-direction: column; gap: 4px; font-size: 12px;
    color: var(--al-dg-muted, #6b7280);
  }
  .al-dg-panel__field input[type="search"] {
    border: 1px solid var(--al-dg-border, #e5e7eb); border-radius: 6px;
    padding: 6px 8px; font: inherit; color: var(--al-dg-fg, #111827);
    background: var(--al-dg-bg, #fff);
  }
  .al-dg-panel__divider { height: 1px; background: var(--al-dg-border, #e5e7eb); }
  .al-dg-panel__cards {
    display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;
  }
  .al-dg-panel__card {
    border: 1px solid var(--al-dg-border, #e5e7eb);
    border-radius: 8px;
    background: var(--al-dg-bg, #fff);
    overflow: hidden;
  }
  .al-dg-panel__card-header {
    display: flex; align-items: center; gap: 4px;
    width: 100%; padding: 0; border: 0; background: var(--al-dg-header-bg, #f9fafb);
  }
  .al-dg-panel__card-toggle {
    flex: 1; display: flex; align-items: center; gap: 6px;
    border: 0; background: transparent; padding: 8px 10px;
    font: inherit; font-size: 12px; font-weight: 650; text-align: left;
    color: var(--al-dg-fg, #111827); cursor: pointer; min-width: 0;
  }
  .al-dg-panel__card-chevron {
    flex: 0 0 auto; color: var(--al-dg-muted, #6b7280); font-size: 10px;
  }
  .al-dg-panel__card-title {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .al-dg-panel__card-active {
    flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%;
    background: var(--al-dg-accent, #2563eb);
  }
  .al-dg-panel__card-remove {
    flex: 0 0 auto; border: 0; background: transparent;
    color: var(--al-dg-muted, #6b7280); cursor: pointer;
    padding: 8px 10px; font: inherit; font-size: 14px; line-height: 1;
  }
  .al-dg-panel__card-remove:hover { color: var(--al-dg-fg, #111827); }
  .al-dg-panel__card-body { padding: 8px 10px 10px; }
  .al-dg-panel__add {
    display: flex; flex-direction: column; gap: 4px; font-size: 12px;
    color: var(--al-dg-muted, #6b7280);
  }
  .al-dg-panel__add select {
    border: 1px solid var(--al-dg-border, #e5e7eb); border-radius: 6px;
    padding: 6px 8px; font: inherit; color: var(--al-dg-fg, #111827);
    background: var(--al-dg-bg, #fff);
  }
  .al-dg-panel__actions { margin-top: auto; }
  .al-dg-panel__btn {
    width: 100%; border: 1px solid var(--al-dg-border, #e5e7eb);
    background: var(--al-dg-header-bg, #f9fafb); border-radius: 6px;
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
          (input)="host.setQuickFilter($any($event.target).value)"
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
                (click)="host.toggleFilterColumnExpanded(col.id)"
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
                (click)="host.removeFilterColumn(col.id)"
              >
                ×
              </button>
            </div>
            @if (isExpanded(col.id)) {
              <div class="al-dg-panel__card-body">
                <al-data-grid-filter-field
                  [column]="$any(col)"
                  [value]="host.filters()[col.id] ?? ''"
                  [setOptions]="host.getSetFilterOptions(col.id)"
                  [ariaLabel]="host.locale().filterColumnAriaLabel + ' ' + col.header"
                  variant="panel"
                  (valueChange)="host.setFilter(col.id, $event)"
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

  readonly openColumns = computed(() => {
    const byId = new Map(this.host.filterableColumns().map((c) => [c.id, c]));
    return this.host
      .openFilterColumnIds()
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c);
  });

  readonly addableColumns = computed(() => {
    const open = new Set(this.host.openFilterColumnIds());
    return this.host.filterableColumns().filter((c) => !open.has(c.id));
  });

  isExpanded(columnId: string): boolean {
    return this.host.expandedFilterColumnIds().has(columnId);
  }

  onAddFilter(columnId: string): void {
    if (!columnId) {
      return;
    }
    this.host.addFilterColumn(columnId);
  }
}
