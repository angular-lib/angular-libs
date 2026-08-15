import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { CellRendererParams } from '@angular-libs/data-grid';
import type { MasterDetailAdapter } from './master-detail.adapter';

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
        [attr.aria-label]="expanded() ? 'Collapse detail' : 'Expand detail'"
        (click)="onToggle($event)"
      >
        {{ expanded() ? '▼' : '▶' }}
      </button>
    }
  `,
})
export class MasterDetailExpandCell<T = unknown> {
  readonly params = input.required<CellRendererParams<T>>();

  private readonly adapter = computed((): MasterDetailAdapter | null => {
    const bag = this.params() as CellRendererParams<T> & {
      masterDetail?: MasterDetailAdapter;
    };
    return bag.masterDetail ?? null;
  });

  readonly isMaster = computed(() => {
    const adapter = this.adapter();
    if (!adapter) {
      return false;
    }
    const bag = this.params() as CellRendererParams<T> & {
      isRowMaster?: (row: T) => boolean;
    };
    return bag.isRowMaster ? bag.isRowMaster(this.params().row) : true;
  });

  readonly expanded = computed(() => {
    const adapter = this.adapter();
    if (!adapter) {
      return false;
    }
    return adapter.isExpanded(this.params().rowId);
  });

  onToggle(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const adapter = this.adapter();
    if (!adapter || !this.isMaster()) {
      return;
    }
    adapter.toggle(this.params().rowId);
  }
}
