import { computed, type Signal } from '@angular/core';
import { isDataDisplayRow } from '../utils/row-display';
import { rowsToCsv } from '../utils/csv';
import type { SelectionDeps } from './binder-surface';
import type {
  DataGridQuery,
  RowClickEvent,
} from '../components/data-grid/data-grid.types';

/** Owns row selection behavior + derived selection UI computeds. */
export class SelectionHost<T> {
  readonly showSelection: Signal<boolean> = computed(
    () => this.s.effectiveSelectionMode() !== 'none',
  );

  readonly visibleDataRowIds: Signal<Array<string | number>> = computed(() => {
    const ids: Array<string | number> = [];
    for (const item of this.s.pagedDisplayRows()) {
      if (isDataDisplayRow(item)) {
        ids.push(item.rowId);
      }
    }
    return ids;
  });

  readonly allVisibleSelected: Signal<boolean> = computed(() => {
    const ids = this.visibleDataRowIds();
    if (!ids.length) {
      return false;
    }
    const selected = new Set(this.s.selectedIds());
    return ids.every((id) => selected.has(id));
  });

  readonly someVisibleSelected: Signal<boolean> = computed(() => {
    const selected = new Set(this.s.selectedIds());
    return this.visibleDataRowIds().some((id) => selected.has(id));
  });

  constructor(private readonly s: SelectionDeps<T>) {}

  isSelected(id: string | number): boolean {
    return this.s.selectedIds().includes(id);
  }

  /** §5d — host may exclude rows from checkbox / Space / click-select. */
  isRowSelectable(row: T, rowId: string | number): boolean {
    const fn = this.s.isRowSelectableFn();
    return fn ? fn(row, rowId) : true;
  }

  toggleRowSelection(id: string | number, event: Event): void {
    const row = this.findDataRowById(id);
    if (row && !this.isRowSelectable(row, id)) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    if (this.s.effectiveSelectionMode() === 'single') {
      const next = checked ? [id] : [];
      this.s.selectedIds.set(next);
      this.s.publishSelectionChange(next);
      this.s.notifyPlugins('onSelectionChange', next);
      return;
    }
    const set = new Set(this.s.selectedIds());
    if (checked) {
      set.add(id);
    } else {
      set.delete(id);
    }
    const next = [...set];
    this.s.selectedIds.set(next);
    this.s.publishSelectionChange(next);
    this.s.notifyPlugins('onSelectionChange', next);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!checked) {
      this.s.selectedIds.set([]);
      this.s.publishSelectionChange([]);
      this.s.notifyPlugins('onSelectionChange', []);
      return;
    }
    const ids = this.visibleDataRowIds().filter((id) => {
      const row = this.findDataRowById(id);
      return !row || this.isRowSelectable(row, id);
    });
    this.s.selectedIds.set(ids);
    this.s.publishSelectionChange(ids);
    this.s.notifyPlugins('onSelectionChange', ids);
  }

  onRowClick(row: T, rowId: string | number, rowIndex: number, event: MouseEvent): void {
    if (
      this.s.effectiveRowClickSelects() &&
      this.s.effectiveSelectionMode() !== 'none' &&
      this.isRowSelectable(row, rowId) &&
      !(event.target instanceof HTMLElement && event.target.closest('input,button,a,select,textarea'))
    ) {
      const selected = this.isSelected(rowId);
      const fake = {
        target: { checked: !selected },
      } as unknown as Event;
      this.toggleRowSelection(rowId, fake);
    }
    this.s.publishRowClick({ row, rowId, rowIndex, event } as RowClickEvent<T>);
  }

  toggleSelectionAtIndex(rowIndex: number): void {
    if (this.s.effectiveSelectionMode() === 'none') {
      return;
    }
    const item = this.s.pagedDisplayRows()[rowIndex];
    if (!item || !isDataDisplayRow(item)) {
      return;
    }
    if (!this.isRowSelectable(item.row, item.rowId)) {
      return;
    }
    const selected = this.isSelected(item.rowId);
    const fake = {
      target: { checked: !selected },
    } as unknown as Event;
    this.toggleRowSelection(item.rowId, fake);
  }

  selectAllVisible(): void {
    if (this.s.effectiveSelectionMode() !== 'multi') {
      return;
    }
    const ids = this.visibleDataRowIds().filter((id) => {
      const row = this.findDataRowById(id);
      return !row || this.isRowSelectable(row, id);
    });
    this.setSelectedIds(ids);
  }

  getSelectedIds(): Array<string | number> {
    return [...this.s.selectedIds()];
  }

  setSelectedIds(ids: Array<string | number>): void {
    const next = [...ids];
    this.s.selectedIds.set(next);
    this.s.publishSelectionChange(next);
    this.s.notifyPlugins('onSelectionChange', next);
  }

  getDisplayedRowCount(): number {
    return this.s.displayRows().length;
  }

  getProcessedRows(): readonly T[] {
    return this.s.processedRows();
  }

  getSourceRows(): readonly T[] {
    return this.s.data();
  }

  getQuery(): DataGridQuery {
    return this.s.getQuery();
  }

  getSelectionClipboardText(): string | null {
    if (!this.s.copyEnabled()) {
      return null;
    }
    const selected = new Set(this.s.selectedIds());
    if (!selected.size) {
      return null;
    }
    const rows = this.s.processedRows().filter((row, index) =>
      selected.has(this.s.effectiveRowId()(row, index)),
    );
    if (!rows.length) {
      return null;
    }
    return rowsToCsv(rows, this.s.visibleColumns(), { includeHeaders: false });
  }

  findDataRowById(id: string | number): T | null {
    const getId = this.s.effectiveRowId();
    const data = this.s.data();
    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;
      if (getId(row, i) === id) {
        return row;
      }
    }
    return null;
  }
}
