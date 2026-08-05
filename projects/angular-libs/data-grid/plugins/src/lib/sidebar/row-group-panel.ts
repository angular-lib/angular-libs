import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DATA_GRID_SIDEBAR_HOST } from '@angular-libs/data-grid';

@Component({
  selector: 'al-data-grid-row-group-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="al-dg-panel" data-testid="al-dg-row-group-panel">
      <div class="al-dg-panel__title">{{ host.locale().groupsPanelLabel }}</div>
      <p class="al-dg-panel__hint">Group rows by column values. Order is outer → inner.</p>
      <ul class="al-dg-panel__list" role="list">
        @for (col of host.columns(); track col.id) {
          <li class="al-dg-panel__item">
            <label class="al-dg-panel__check">
              <input
                type="checkbox"
                [checked]="isGrouped(col.id)"
                (change)="toggle(col.id, $any($event.target).checked)"
              />
              <span>{{ col.header }}</span>
            </label>
            @if (isGrouped(col.id)) {
              <span class="al-dg-panel__level">L{{ levelOf(col.id) + 1 }}</span>
              <div class="al-dg-panel__move">
                <button
                  type="button"
                  class="al-dg-panel__icon-btn"
                  [disabled]="levelOf(col.id) <= 0"
                  (click)="move(col.id, -1)"
                  aria-label="Move group up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="al-dg-panel__icon-btn"
                  [disabled]="levelOf(col.id) >= host.groupColumnIds().length - 1"
                  (click)="move(col.id, 1)"
                  aria-label="Move group down"
                >
                  ↓
                </button>
              </div>
            }
          </li>
        }
      </ul>
      <div class="al-dg-panel__actions">
        <button
          type="button"
          class="al-dg-panel__btn"
          [disabled]="!host.groupColumnIds().length"
          (click)="host.setGroupColumns([])"
          data-testid="al-dg-ungroup"
        >
          Ungroup
        </button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .al-dg-panel {
      display: flex; flex-direction: column; gap: 8px; height: 100%;
      padding: 12px; box-sizing: border-box;
    }
    .al-dg-panel__title { font-weight: 650; font-size: 13px; }
    .al-dg-panel__hint { margin: 0; color: var(--al-dg-muted, #5f6368); font-size: 12px; }
    .al-dg-panel__list {
      list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1;
      display: flex; flex-direction: column; gap: 4px;
    }
    .al-dg-panel__item {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid var(--al-dg-border, #babfc7); border-radius: 6px;
      padding: 6px 8px; background: var(--al-dg-bg, #fff);
    }
    .al-dg-panel__check {
      display: flex; align-items: center; gap: 8px; font-size: 13px;
      cursor: pointer; flex: 1; min-width: 0;
    }
    .al-dg-panel__level {
      font-size: 11px; color: var(--al-dg-muted, #5f6368); font-weight: 650;
    }
    .al-dg-panel__move { display: inline-flex; gap: 2px; }
    .al-dg-panel__icon-btn {
      border: 1px solid var(--al-dg-border, #babfc7);
      background: var(--al-dg-header-bg, #f8f8f8); border-radius: 4px;
      width: 24px; height: 24px; font: inherit; cursor: pointer; padding: 0;
    }
    .al-dg-panel__icon-btn:disabled { opacity: 0.4; cursor: default; }
    .al-dg-panel__actions { display: flex; gap: 8px; }
    .al-dg-panel__btn {
      flex: 1; border: 1px solid var(--al-dg-border, #babfc7);
      background: var(--al-dg-header-bg, #f8f8f8); border-radius: 6px;
      padding: 6px 8px; font: inherit; cursor: pointer;
    }
    .al-dg-panel__btn:disabled { opacity: 0.45; cursor: default; }
  `,
})
export class DataGridRowGroupPanel {
  readonly host = inject(DATA_GRID_SIDEBAR_HOST);

  isGrouped(columnId: string): boolean {
    return this.host.groupColumnIds().includes(columnId);
  }

  levelOf(columnId: string): number {
    return this.host.groupColumnIds().indexOf(columnId);
  }

  toggle(columnId: string, checked: boolean): void {
    const current = [...this.host.groupColumnIds()];
    if (checked) {
      if (!current.includes(columnId)) {
        this.host.setGroupColumns([...current, columnId]);
      }
      return;
    }
    this.host.setGroupColumns(current.filter((id) => id !== columnId));
  }

  move(columnId: string, delta: number): void {
    const current = [...this.host.groupColumnIds()];
    const from = current.indexOf(columnId);
    if (from < 0) {
      return;
    }
    const to = from + delta;
    if (to < 0 || to >= current.length) {
      return;
    }
    const next = [...current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    this.host.setGroupColumns(next);
  }
}
