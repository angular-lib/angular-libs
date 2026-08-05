import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DATA_GRID_SIDEBAR_HOST } from '@angular-libs/data-grid';

const panelStyles = `
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
    border: 1px solid var(--al-dg-border, #babfc7); border-radius: 6px;
    padding: 6px 8px; background: var(--al-dg-bg, #fff); cursor: grab;
  }
  .al-dg-panel__check {
    display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;
  }
  .al-dg-panel__actions { display: flex; gap: 8px; }
  .al-dg-panel__btn {
    flex: 1; border: 1px solid var(--al-dg-border, #babfc7);
    background: var(--al-dg-header-bg, #f8f8f8); border-radius: 6px;
    padding: 6px 8px; font: inherit; cursor: pointer;
  }
`;

@Component({
  selector: 'al-data-grid-columns-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="al-dg-panel" data-testid="al-dg-columns-panel">
      <div class="al-dg-panel__title">{{ host.locale().columnsPanelTitle }}</div>
      <p class="al-dg-panel__hint">{{ host.locale().columnsPanelHint }}</p>
      <ul class="al-dg-panel__list" role="list">
        @for (col of host.columns(); track col.id; let index = $index) {
          <li
            class="al-dg-panel__item"
            draggable="true"
            (dragstart)="onDragStart(index, $event)"
            (dragover)="$event.preventDefault()"
            (drop)="onDrop(index, $event)"
          >
            <label class="al-dg-panel__check">
              <input
                type="checkbox"
                [checked]="!isHidden(col.id)"
                (change)="host.setColumnVisible(col.id, $any($event.target).checked)"
              />
              <span>{{ col.header }}</span>
            </label>
          </li>
        }
      </ul>
      <div class="al-dg-panel__actions">
        <button type="button" class="al-dg-panel__btn" (click)="host.showAllColumns()">{{ host.locale().columnsShowAll }}</button>
        <button type="button" class="al-dg-panel__btn" (click)="host.autoSizeColumns()">{{ host.locale().columnsAutosize }}</button>
      </div>
    </div>
  `,
  styles: panelStyles,
})
export class DataGridColumnsPanel {
  readonly host = inject(DATA_GRID_SIDEBAR_HOST);
  private dragFrom: number | null = null;

  isHidden(columnId: string): boolean {
    return this.host.hiddenColumnIds().includes(columnId);
  }

  onDragStart(index: number, event: DragEvent): void {
    this.dragFrom = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  onDrop(toIndex: number, event: DragEvent): void {
    event.preventDefault();
    const from = this.dragFrom ?? Number(event.dataTransfer?.getData('text/plain'));
    this.dragFrom = null;
    if (Number.isFinite(from) && from !== toIndex) {
      this.host.reorderColumns(from, toIndex);
    }
  }
}
