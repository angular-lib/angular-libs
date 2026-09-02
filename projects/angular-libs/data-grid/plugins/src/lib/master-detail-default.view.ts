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
 * Stable key for nested `createGrid` identity.
 * Replacing `detailGrid.columns` (even on the same options object) must recreate
 * the nested controller — `createGrid` stores `columns` as a plain field.
 */
export function detailGridConfigKey(cfg: {
  columns: readonly {
    id?: string;
    field?: string;
    header?: string;
    children?: unknown;
  }[];
  selection?: string;
  plugins?: readonly unknown[];
  viewport?: { virtual?: boolean; rowHeight?: number };
  chrome?: { showToolbar?: boolean; floatingFilters?: boolean };
}): string {
  const cols = cfg.columns
    .map((c) => {
      if ('children' in c && c.children) {
        return `g:${String(c.header ?? '')}`;
      }
      return String(c.id ?? c.field ?? '');
    })
    .join(',');
  return [
    cols,
    `sel:${cfg.selection ?? ''}`,
    `plug:${cfg.plugins?.length ?? 0}`,
    `virt:${cfg.viewport?.virtual ?? ''}`,
    `rh:${cfg.viewport?.rowHeight ?? ''}`,
    `chrome:${cfg.chrome?.showToolbar ?? ''}:${cfg.chrome?.floatingFilters ?? ''}`,
  ].join('|');
}

/**
 * Default detail panel — nested `<al-data-grid>` (AG detail grid spirit).
 * Override with `detailComponent` for forms / custom chrome.
 */
@Component({
  selector: 'al-dg-master-detail-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGrid],
  host: {
    class: 'al-dg-master-detail-view',
  },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      min-width: 0;
      height: 100%;
      box-sizing: border-box;
      padding: 8px 12px 10px;
      background: color-mix(in srgb, var(--al-dg-header-bg, #f5f7f7) 65%, var(--al-dg-bg, #fff));
    }

    .al-dg-master-detail__body {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      min-width: 0;
    }

    .al-dg-master-detail__grid {
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      min-height: 0;
      border: 1px solid var(--al-dg-border, #dde2eb);
      border-radius: var(--al-dg-radius, 3px);
      background: var(--al-dg-bg, #fff);
      /* Compact nested chrome */
      --al-dg-header-height: 36px;
    }

    .al-dg-master-detail__empty {
      margin: 0;
      color: var(--al-dg-muted, #5f6368);
      font-size: 12.5px;
    }
  `,
  template: `
    <div
      class="al-dg-master-detail__body"
      data-testid="al-dg-master-detail"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      @if (detailGrid(); as cfg) {
        @if (detailRows().length === 0) {
          <p class="al-dg-master-detail__empty">No detail rows.</p>
        } @else if (detailController(); as ctrl) {
          <al-data-grid
            class="al-dg-master-detail__grid"
            [controller]="ctrl"
            [data]="detailRows()"
            [emptyMessage]="'No detail rows.'"
          />
        } @else {
          <p class="al-dg-master-detail__empty">Preparing detail grid…</p>
        }
      } @else {
        <p class="al-dg-master-detail__empty">No detail grid configured.</p>
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

  private readonly controllerKey = signal<string | null>(null);

  constructor() {
    effect(() => {
      // Payload is a new object each display pass — read it so column swaps on
      // the same `detailGrid` options object still recreate the nested grid.
      const payload = this.payload();
      const cfg = this.detailGrid();
      void payload;

      if (!cfg?.columns?.length) {
        untracked(() => {
          this.detailController.set(null);
          this.controllerKey.set(null);
        });
        return;
      }

      const key = detailGridConfigKey(cfg);
      untracked(() => {
        if (this.controllerKey() === key && this.detailController()) {
          return;
        }
        this.controllerKey.set(key);
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
