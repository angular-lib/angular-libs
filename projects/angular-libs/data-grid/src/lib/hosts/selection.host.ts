import { computed, type Signal } from '@angular/core';
import { countDisplayedDataRows, isDataDisplayRow } from '../utils/row-display';
import { formatCellValue, getCellValue } from '../utils/cell-value';
import { rowsToCsv } from '../utils/csv';
import { selectRowAriaLabelOf } from './binder-template.helpers';
import type { SelectionDeps } from './binder-surface';
import type {
  DataGridQuery,
  RowClickEvent,
  SelectionChangeEvent,
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

  /** O(1) membership for per-row / per-cell bindings. */
  readonly selectedIdSet: Signal<ReadonlySet<string | number>> = computed(
    () => new Set(this.s.selectedIds()),
  );

  /**
   * Source rows indexed both ways. `rowId` receives the row's index in the
   * bound source `data()`.
   */
  private readonly sourceIndex: Signal<{
    rowById: ReadonlyMap<string | number, T>;
    idByRow: ReadonlyMap<T, string | number>;
  }> = computed(() => {
    const getId = this.s.effectiveRowId();
    const rowById = new Map<string | number, T>();
    const idByRow = new Map<T, string | number>();
    const data = this.s.data();
    for (let i = 0; i < data.length; i++) {
      const row = data[i]!;
      const id = getId(row, i);
      rowById.set(id, row);
      idByRow.set(row, id);
    }
    return { rowById, idByRow };
  });

  /**
   * Selectable row ids the header checkbox / Ctrl+A act on
   * (`createGrid({ selectAll })`: filtered rows, current page, or all rows).
   */
  readonly selectAllScopeIds: Signal<Array<string | number>> = computed(() => {
    const scope = this.s.selectAllScope();
    const { rowById, idByRow } = this.sourceIndex();
    let ids: Array<string | number>;
    if (scope === 'page') {
      ids = this.visibleDataRowIds();
    } else if (scope === 'all') {
      ids = [...rowById.keys()];
    } else {
      const getId = this.s.effectiveRowId();
      ids = this.s.processedRows().map((row, i) => idByRow.get(row) ?? getId(row, i));
    }
    return ids.filter((id) => {
      const row = rowById.get(id);
      return row === undefined || this.isRowSelectable(row, id);
    });
  });

  /** Header checkbox state over the selectable ids in scope. */
  readonly selectAllState: Signal<{ checked: boolean; indeterminate: boolean }> = computed(() => {
    const ids = this.selectAllScopeIds();
    const selected = this.selectedIdSet();
    let count = 0;
    for (const id of ids) {
      if (selected.has(id)) {
        count++;
      }
    }
    return {
      checked: ids.length > 0 && count === ids.length,
      indeterminate: count > 0 && count < ids.length,
    };
  });

  constructor(private readonly s: SelectionDeps<T>) {}

  isSelected(id: string | number): boolean {
    return this.selectedIdSet().has(id);
  }

  /** Selection lookup by source row object (CSV `onlySelected`). */
  isRowSelectedByRef(row: T): boolean {
    const id = this.sourceIndex().idByRow.get(row);
    return id !== undefined && this.selectedIdSet().has(id);
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
      this.commitSelection(checked ? [id] : []);
      return;
    }
    const set = new Set(this.s.selectedIds());
    if (checked) {
      set.add(id);
    } else {
      set.delete(id);
    }
    this.commitSelection([...set]);
  }

  /** Header checkbox: add / remove the scoped ids; selection outside the scope is kept. */
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const scope = this.selectAllScopeIds();
    if (!checked) {
      const remove = new Set(scope);
      this.commitSelection(this.s.selectedIds().filter((id) => !remove.has(id)));
      return;
    }
    this.selectAllInScope();
  }

  private selectAllInScope(): void {
    const set = new Set(this.s.selectedIds());
    for (const id of this.selectAllScopeIds()) {
      set.add(id);
    }
    this.commitSelection([...set]);
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

  /** Ctrl+A — same scope as the header checkbox; adds to the current selection. */
  selectAllVisible(): void {
    if (this.s.effectiveSelectionMode() !== 'multi') {
      return;
    }
    this.selectAllInScope();
  }

  getSelectedIds(): Array<string | number> {
    return [...this.s.selectedIds()];
  }

  setSelectedIds(ids: Array<string | number>): void {
    this.commitSelection([...ids]);
  }

  getDisplayedRowCount(): number {
    return countDisplayedDataRows(this.s.displayRows());
  }

  getDisplayRowCount(): number {
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
    return this.sourceIndex().rowById.get(id) ?? null;
  }

  private commitSelection(ids: Array<string | number>): void {
    this.s.selectedIds.set(ids);
    const payload: SelectionChangeEvent<T> = {
      selectedIds: ids,
      selected: this.resolveSelected(ids),
    };
    this.s.publishSelectionChange(payload);
    this.s.notifyPlugins('onSelectionChange', payload);
  }

  private resolveSelected(ids: Array<string | number>): SelectionChangeEvent<T>['selected'] {
    const getId = this.s.effectiveRowId();
    const { rowById, idByRow } = this.sourceIndex();
    const processed = this.s.processedRows();
    const indexById = new Map<string | number, number>();
    for (let i = 0; i < processed.length; i++) {
      const row = processed[i]!;
      indexById.set(idByRow.get(row) ?? getId(row, i), i);
    }
    const selected: SelectionChangeEvent<T>['selected'] = [];
    for (const rowId of ids) {
      const row = rowById.get(rowId) ?? null;
      if (row === null) {
        continue;
      }
      selected.push({
        rowId,
        row,
        rowIndex: indexById.get(rowId) ?? null,
      });
    }
    return selected;
  }

  selectRowAriaLabel(row: T, dataIndex: number, selectRowAriaLabel: string): string {
    for (const col of this.s.visibleColumns()) {
      if (!col.field && col.cellRenderer) {
        continue;
      }
      const text = formatCellValue(getCellValue(row, col, dataIndex), row, col, dataIndex);
      if (text.trim()) {
        return selectRowAriaLabelOf(selectRowAriaLabel, dataIndex, text);
      }
    }
    return selectRowAriaLabelOf(selectRowAriaLabel, dataIndex);
  }
}
