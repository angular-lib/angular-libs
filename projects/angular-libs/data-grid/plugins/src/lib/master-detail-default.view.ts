import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { ColumnDef, DataGridApi } from '@angular-libs/data-grid';
import type { CustomDisplayRow } from '@angular-libs/data-grid/internals';
import type { MasterDetailPayload } from './master-detail.types';

/**
 * Default detail panel — compact HTML table over `detailColumns` + payload rows.
 * Swap via `detailComponent` for forms / nested grids / custom chrome.
 */
@Component({
  selector: 'al-dg-master-detail-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="al-data-grid__detail" data-testid="al-dg-master-detail">
      @if (!columns().length) {
        <p class="al-data-grid__detail-empty">No detail columns configured.</p>
      } @else if (!detailRows().length) {
        <p class="al-data-grid__detail-empty">No detail rows.</p>
      } @else {
        <table class="al-data-grid__detail-table">
          <thead>
            <tr>
              @for (col of columns(); track col.id ?? col.field ?? $index) {
                <th>{{ col.header ?? col.field ?? col.id }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of detailRows(); track $index) {
              <tr>
                @for (col of columns(); track col.id ?? col.field ?? $index) {
                  <td>{{ cellText(row, col, $index) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class MasterDetailDefaultView<T = unknown, D = unknown> {
  /** Display row from the binder (`pluginKind: 'masterDetail'`). */
  readonly item = input.required<CustomDisplayRow>();
  /** Bound master grid API (available to custom views; unused by the table). */
  readonly api = input<DataGridApi<T> | null>(null);

  readonly payload = computed((): MasterDetailPayload<T, D> | null => {
    const raw = this.item().payload;
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as MasterDetailPayload<T, D>;
  });

  readonly detailRows = computed(() => this.payload()?.detailRows ?? []);
  readonly columns = computed(
    (): readonly ColumnDef<D>[] => this.payload()?.detailColumns ?? [],
  );

  cellText(row: D, col: ColumnDef<D>, rowIndex: number): string {
    const value = col.valueGetter
      ? col.valueGetter(row, rowIndex)
      : col.field
        ? (row as Record<string, unknown>)[col.field]
        : undefined;
    if (col.valueFormatter) {
      return col.valueFormatter(value, row, rowIndex);
    }
    if (value == null) {
      return '';
    }
    return String(value);
  }
}
