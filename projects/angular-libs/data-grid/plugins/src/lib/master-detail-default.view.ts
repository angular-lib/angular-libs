import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  DataGrid,
  createGrid,
  type DataGridApi,
  type GridController,
} from '@angular-libs/data-grid';
import type { CustomDisplayRow } from '@angular-libs/data-grid/internals';
import type {
  MasterDetailGridOptions,
  MasterDetailPayload,
} from './master-detail.types';

/**
 * Default detail panel — nested `<al-data-grid>` (AG detail grid spirit).
 * Override with `detailComponent` for forms / custom chrome.
 */
@Component({
  selector: 'al-dg-master-detail-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGrid],
  template: `
    <div
      class="al-data-grid__detail al-data-grid__detail--nested"
      data-testid="al-dg-master-detail"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      @if (detailGrid(); as cfg) {
        @if (detailController(); as ctrl) {
          <al-data-grid
            class="al-data-grid__detail-grid"
            [controller]="ctrl"
            [data]="detailRows()"
            [emptyMessage]="'No detail rows.'"
          />
        } @else {
          <p class="al-data-grid__detail-empty">Preparing detail grid…</p>
        }
      } @else {
        <p class="al-data-grid__detail-empty">No detail grid configured.</p>
      }
    </div>
  `,
})
export class MasterDetailDefaultView<T = unknown, D = unknown> {
  /** Display row from the binder (`pluginKind: 'masterDetail'`). */
  readonly item = input.required<CustomDisplayRow>();
  /** Bound master grid API (available to custom views). */
  readonly api = input<DataGridApi<T> | null>(null);

  readonly payload = computed((): MasterDetailPayload<T, D> | null => {
    const raw = this.item().payload;
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as MasterDetailPayload<T, D>;
  });

  readonly detailRows = computed(() => this.payload()?.detailRows ?? []);

  readonly detailGrid = computed((): MasterDetailGridOptions<D> | null => {
    const p = this.payload();
    if (!p) {
      return null;
    }
    if (p.detailGrid?.columns?.length) {
      return p.detailGrid;
    }
    if (p.detailColumns?.length) {
      return { columns: p.detailColumns };
    }
    return null;
  });

  /** One controller per expanded detail instance (own sort/filter/selection). */
  readonly detailController = signal<GridController<D> | null>(null);

  constructor() {
    effect(() => {
      const cfg = this.detailGrid();
      if (!cfg?.columns?.length) {
        this.detailController.set(null);
        return;
      }
      untracked(() => {
        if (this.detailController()) {
          return;
        }
        this.detailController.set(
          createGrid<D>({
            columns: cfg.columns,
            rowId: cfg.rowId,
            plugins: cfg.plugins ?? [],
            selection: cfg.selection ?? 'none',
            viewport: {
              virtual: false,
              rowHeight: 32,
              ...cfg.viewport,
            },
            chrome: {
              showToolbar: false,
              floatingFilters: false,
              stripe: true,
              columnReorder: false,
              contextMenu: false,
              ...cfg.chrome,
            },
          }),
        );
      });
    });
  }
}
