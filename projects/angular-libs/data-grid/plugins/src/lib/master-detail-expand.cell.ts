import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { defaultGridLocale, type CellRendererParams, type DataGridLocale } from '@angular-libs/data-grid';
import type { MasterDetailAdapter } from './master-detail.adapter';

type ExpandParams<T> = CellRendererParams<T> & {
  masterDetail?: MasterDetailAdapter;
  isRowMaster?: (row: T) => boolean;
  openByDefault?: (row: T) => boolean;
  getLocale?: () => DataGridLocale;
};

/**
 * Expand / collapse control for master rows.
 * Pass the held adapter via `column.cellRendererParams.masterDetail`.
 */
@Component({
  selector: 'al-dg-master-detail-expand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isMaster()) {
      <button
        type="button"
        class="al-data-grid__group-toggle"
        data-testid="al-dg-master-detail-toggle"
        [attr.aria-expanded]="expanded()"
        [attr.aria-label]="toggleLabel()"
        (click)="onToggle($event)"
      >
        {{ expanded() ? '▼' : '▶' }}
      </button>
    }
  `,
})
export class MasterDetailExpandCell<T = unknown> {
  readonly params = input.required<CellRendererParams<T>>();

  private readonly bag = computed(() => this.params() as ExpandParams<T>);

  private readonly adapter = computed(
    (): MasterDetailAdapter | null => this.bag().masterDetail ?? null,
  );

  private readonly openByDefault = computed(() => {
    const fn = this.bag().openByDefault;
    return fn ? fn(this.params().row) : false;
  });

  readonly isMaster = computed(() => {
    if (!this.adapter()) {
      return false;
    }
    const check = this.bag().isRowMaster;
    return check ? check(this.params().row) : true;
  });

  readonly expanded = computed(() => {
    const adapter = this.adapter();
    if (!adapter) {
      return false;
    }
    return adapter.isExpanded(this.params().rowId, this.openByDefault());
  });

  readonly toggleLabel = computed(() => {
    const locale = this.bag().getLocale?.() ?? defaultGridLocale;
    return this.expanded() ? locale.collapseDetailAriaLabel : locale.expandDetailAriaLabel;
  });

  onToggle(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const adapter = this.adapter();
    if (!adapter || !this.isMaster()) {
      return;
    }
    adapter.toggle(this.params().rowId, this.openByDefault());
  }
}
