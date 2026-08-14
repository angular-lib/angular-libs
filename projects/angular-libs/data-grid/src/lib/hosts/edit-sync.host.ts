import { signal, type WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { focusRealmOf, type FocusCell } from '../controllers/focus';
import {
  isTypeToEditKey,
  resolveTypeToEditSeed,
  type TypeToEditSeed,
} from '../editing/edit-interaction';
import { coerceCellEditValue } from '../utils/coerce-cell-value';
import { isCustomEditorComponent, isSelectEditor } from '../utils/editors';
import { isDataDisplayRow } from '../utils/row-display';
import {
  getCellValue,
  isBooleanColumn,
  isDateColumn,
} from '../utils/cell-value';
import { formFieldForColumn } from '../utils/row-edit';
import { toDateKey } from '../utils/filter-rows';
import { RowEditSession } from '../editing/row-edit-session';
import type { RowEditAdapter } from '../editing/cell-editor-registry';
import type { EditSyncDeps } from './binder-surface';
import type { ColumnDef, ResolvedColumn } from '../components/data-grid/data-grid.types';
import {
  activateFloatingFilter as activateFloatingFilterOf,
  focusEditorInCell as focusEditorInCellOf,
  isEditorEventTarget as isEditorEventTargetOf,
  syncDomFocus as syncDomFocusOf,
} from './edit-focus';

/**
 * Owns cell / full-row edit sessions and editor DOM focus sync.
 * Constructs {@link RowEditSession} from rowForm model bridges.
 * LOC may sit over the default host ceiling while edit state lives here (F2); cap: 600.
 */
export class EditSyncHost<T> {
  readonly editingCell: WritableSignal<{ rowId: string | number; columnId: string } | null> =
    signal(null);
  readonly editDraft: WritableSignal<string> = signal('');
  readonly rowEditMgr: RowEditSession<T>;
  /** Imperative adapter for full-row edit (optional DX sugar). */
  readonly rowEditAdapter: RowEditAdapter<T>;

  constructor(private readonly s: EditSyncDeps<T>) {
    this.rowEditMgr = new RowEditSession<T>({
      getHostForm: () => this.s.rowForm(),
      setHostForm: (tree) => this.s.rowForm.set(tree),
      getSchema: () => this.s.effectiveRowEditSchema(),
      getFactory: () => this.s.effectiveCreateRowForm(),
      resolveColumn: (key) =>
        this.s.columnsById().get(key) ?? this.s.resolvedColumns().find((c) => c.field === key),
      parentInjector: this.s.parentInjector(),
      onSession: (ctx) => this.s.rowEditSession.set(ctx),
      onDraft: (draft) => this.s.rowEditDraft.set(draft),
      onStart: (ctx) => this.s.publishRowEditStart(ctx),
      onCommit: (event) => this.s.publishRowEdit(event),
      onCancel: (payload) => this.s.publishRowEditCancel(payload),
    });
    this.rowEditAdapter = this.rowEditMgr;
  }

  isEditorEventTarget(target: EventTarget | null): boolean {
    return isEditorEventTargetOf(target);
  }

  isEditing(rowId: string | number, columnId: string): boolean {
    if (this.s.effectiveEditMode() === 'fullRow') {
      return this.isRowEditing(rowId);
    }
    const cell = this.editingCell();
    return !!cell && cell.rowId === rowId && cell.columnId === columnId;
  }

  isRowEditing(rowId: string | number): boolean {
    return this.rowEditMgr.isEditing(rowId);
  }

  activeRowForm(): FieldTree<T> | null {
    return this.s.rowForm();
  }

  rowFormInvalid(): boolean {
    const id = this.rowEditMgr.editingId();
    const tree = this.s.rowForm();
    return id != null && !!tree && tree().invalid();
  }

  formFieldFor(column: ColumnDef<T>): FieldTree<unknown> | null {
    if (!this.rowEditMgr.editingId()) {
      return null;
    }
    return formFieldForColumn(this.s.rowForm(), column);
  }

  fieldInvalid(field: FieldTree<unknown> | null): boolean {
    return !!field && field().invalid();
  }

  fieldError(field: FieldTree<unknown> | null): string | null {
    if (!field) {
      return null;
    }
    const errors = field().errors();
    const first = errors[0];
    return first?.message ?? (first ? first.kind : null);
  }

  cellTemplateContext(
    row: T,
    rowId: string | number,
    rowIndex: number,
    col: ResolvedColumn<T>,
    value: unknown,
    editing: boolean,
  ) {
    const formTree = this.isRowEditing(rowId) ? this.s.rowForm() : null;
    return {
      $implicit: row,
      row,
      value,
      rowIndex,
      columnId: col.id,
      editing,
      form: formTree,
      field: formFieldForColumn(formTree, col),
      rowEdit: this.isRowEditing(rowId) ? this.s.rowEditSession() : null,
    };
  }

  startEdit(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ColumnDef<T>,
    value: unknown,
    opts?: { seed?: TypeToEditSeed },
  ): void {
    if (!column.editable) {
      return;
    }
    const columnId = column.id ?? column.field ?? '';
    const seed = opts?.seed;

    if (this.s.effectiveEditMode() === 'fullRow') {
      this.editingCell.set(null);
      this.rowEditMgr.start(row, rowId, rowIndex);
      if (seed?.action === 'set') {
        const key = column.field ?? column.id;
        if (key) {
          this.rowEditMgr.patchField(key, seed.value);
        }
      }
      this.s.syncDomFocusAfterEdit();
      return;
    }
    if (isBooleanColumn(column, value) && !isSelectEditor(column) && !isCustomEditorComponent(column)) {
      const resolved =
        'minWidth' in column
          ? (column as ResolvedColumn<T>)
          : this.s.columnsById().get(column.id ?? column.field ?? '');
      if (resolved) {
        this.toggleBoolean(row, rowId, rowIndex, resolved, !Boolean(value));
      }
      return;
    }
    this.rowEditMgr.destroy();
    this.editingCell.set({ rowId, columnId });
    if (seed?.action === 'set') {
      this.editDraft.set(seed.value == null ? '' : String(seed.value));
    } else if (isDateColumn(column) || column.cellEditor === 'date') {
      this.editDraft.set(toDateKey(value) ?? '');
    } else {
      this.editDraft.set(value == null ? '' : String(value));
    }
    this.s.syncDomFocusAfterEdit();
  }

  startEditAtFocus(
    rowIndex: number,
    columnId: string,
    reason: 'enter' | 'f2' = 'enter',
  ): void {
    const focus = this.s.kernel().focus.getFocus();
    if (focus && focusRealmOf(focus) !== 'body') {
      return;
    }
    if (reason === 'enter' && this.s.effectiveEditInteraction().enterIdle === 'moveDown') {
      this.s.kernel().focus.move(1, 0);
      return;
    }
    const item = this.s.pagedDisplayRows()[rowIndex];
    const col = this.s.columnsById().get(columnId);
    if (!item || !isDataDisplayRow(item) || !col?.editable) {
      return;
    }
    this.startEdit(
      item.row,
      item.rowId,
      item.dataIndex,
      col,
      this.s.cellValue(item.row, col, item.dataIndex),
    );
  }

  startRowEdit(row: T, rowId: string | number, rowIndex: number): void {
    if (this.s.effectiveEditMode() !== 'fullRow') {
      return;
    }
    this.editingCell.set(null);
    this.rowEditMgr.start(row, rowId, rowIndex);
    this.s.syncDomFocusAfterEdit();
  }

  startRowEditById(rowId: string | number): void {
    const rows = this.s.processedRows();
    const index = rows.findIndex((row, i) => this.s.effectiveRowId()(row, i) === rowId);
    if (index < 0) {
      return;
    }
    this.startRowEdit(rows[index]!, rowId, index);
  }

  startEditingCell(rowId: string | number, columnId: string): void {
    const rows = this.s.processedRows();
    const dataIndex = rows.findIndex((row, i) => this.s.effectiveRowId()(row, i) === rowId);
    const col = this.s.columnsById().get(columnId);
    if (dataIndex < 0 || !col) {
      return;
    }
    const displayIndex = this.s.pagedDisplayRows().findIndex(
      (item) => isDataDisplayRow(item) && item.rowId === rowId,
    );
    if (displayIndex >= 0) {
      this.s.kernel().focus.focusCell(displayIndex, columnId, 'body');
    }
    this.startEdit(
      rows[dataIndex]!,
      rowId,
      dataIndex,
      col,
      this.s.cellValue(rows[dataIndex]!, col, dataIndex),
    );
  }

  commitRowEdit(): boolean {
    const ok = this.rowEditMgr.commit();
    if (ok) {
      this.s.syncDomFocusAfterEdit();
    }
    return ok;
  }

  cancelRowEdit(): void {
    this.rowEditMgr.cancel();
    this.s.syncDomFocusAfterEdit();
  }

  destroyRowEditSession(): void {
    this.rowEditMgr.destroy();
  }

  toggleBoolean(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    checked: boolean,
  ): void {
    const previousValue = getCellValue(row, column, rowIndex);
    this.s.publishCellEdit({
      row,
      rowId,
      column,
      columnId: column.id,
      previousValue,
      value: checked,
      form: this.isRowEditing(rowId) ? this.s.rowForm() : null,
    });
  }

  commitEdit(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    const cell = this.editingCell();
    if (!cell || cell.rowId !== rowId || cell.columnId !== column.id) {
      return;
    }
    const previousValue = getCellValue(row, column, rowIndex);
    const value = coerceCellEditValue(column, this.editDraft(), previousValue);
    this.editingCell.set(null);
    this.s.syncDomFocusAfterEdit();
    if (Object.is(value, previousValue)) {
      return;
    }
    if (
      previousValue instanceof Date &&
      value instanceof Date &&
      previousValue.getTime() === value.getTime()
    ) {
      return;
    }
    this.s.publishCellEdit({
      row,
      rowId,
      column,
      columnId: column.id,
      previousValue,
      value,
      form: null,
    });
  }

  onEditorEnter(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    this.commitEdit(row, rowId, rowIndex, column);
    if (this.s.effectiveEditInteraction().enterEditing === 'commitAndMoveDown') {
      this.s.kernel().focus.move(1, 0);
    }
  }

  onEditorTab(
    event: Event,
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
  ): void {
    if (this.s.effectiveEditInteraction().tabEditing !== 'commitAndMove') {
      return;
    }
    const keyEvent = event as KeyboardEvent;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    this.commitEdit(row, rowId, rowIndex, column);
    this.s.kernel().focus.moveHorizontalWrap(keyEvent.shiftKey ? -1 : 1);
  }

  /** fullRow: Tab walks cells without committing the row (AG / excel). */
  onRowEditorTab(event: Event): void {
    if (this.s.effectiveEditInteraction().tabEditing !== 'commitAndMove') {
      return;
    }
    const keyEvent = event as KeyboardEvent;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    this.s.kernel().focus.moveHorizontalWrap(keyEvent.shiftKey ? -1 : 1);
    this.s.syncDomFocusAfterEdit();
  }

  onEditorEscape(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    this.cancelActiveEdit();
  }

  onEditorBlur(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): void {
    if (this.s.effectiveEditInteraction().editorBlur === 'cancel') {
      this.cancelEdit();
      return;
    }
    this.commitEdit(row, rowId, rowIndex, column);
  }

  onEditorHostFocusOut(
    event: FocusEvent,
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
  ): void {
    const host = event.currentTarget;
    const next = event.relatedTarget;
    if (host instanceof Node && next instanceof Node && host.contains(next)) {
      return;
    }
    this.onEditorBlur(row, rowId, rowIndex, column);
  }

  /** Space on a focused idle boolean cell toggles the value, not row selection. */
  tryToggleFocusedBoolean(): boolean {
    if (this.s.effectiveEditMode() === 'fullRow') {
      return false;
    }
    const focus = this.s.kernel().focus.getFocus();
    if (!focus || focusRealmOf(focus) !== 'body') {
      return false;
    }
    const item = this.s.pagedDisplayRows()[focus.rowIndex];
    const col = this.s.columnsById().get(focus.columnId);
    if (!item || !isDataDisplayRow(item) || !col?.editable) {
      return false;
    }
    const value = this.s.cellValue(item.row, col, item.dataIndex);
    if (!isBooleanColumn(col, value) || isSelectEditor(col) || isCustomEditorComponent(col)) {
      return false;
    }
    this.toggleBoolean(item.row, item.rowId, item.dataIndex, col, !Boolean(value));
    return true;
  }

  cancelEdit(): void {
    if (this.editingCell() == null) {
      return;
    }
    this.editingCell.set(null);
    this.s.syncDomFocusAfterEdit();
  }

  cancelActiveEdit(): void {
    if (this.rowEditMgr.editingId() != null) {
      this.cancelRowEdit();
      return;
    }
    if (this.editingCell() != null) {
      this.cancelEdit();
    }
  }

  stopEditing(cancel = false): void {
    if (cancel) {
      if (this.rowEditMgr.editingId() != null) {
        this.cancelRowEdit();
      } else {
        this.cancelEdit();
      }
      return;
    }
    if (this.rowEditMgr.editingId() != null) {
      this.commitRowEdit();
      return;
    }
    const cell = this.editingCell();
    if (!cell) {
      return;
    }
    const rows = this.s.processedRows();
    const rowIndex = rows.findIndex((row, i) => this.s.effectiveRowId()(row, i) === cell.rowId);
    const column = this.s.columnsById().get(cell.columnId);
    if (rowIndex < 0 || !column) {
      this.cancelEdit();
      return;
    }
    this.commitEdit(rows[rowIndex]!, cell.rowId, rowIndex, column);
  }

  /**
   * Type-to-edit: printable / Backspace / Delete → startEdit + optional draft seed.
   * DOM focus is owned by {@link syncDomFocus}.
   */
  tryTypeToEdit(event: KeyboardEvent): boolean {
    if (this.s.effectiveEditInteraction().typeToEdit !== 'replace') {
      return false;
    }
    if (!isTypeToEditKey(event)) {
      return false;
    }
    const focus = this.s.kernel().focus.getFocus();
    if (!focus || focusRealmOf(focus) !== 'body') {
      return false;
    }
    const item = this.s.pagedDisplayRows()[focus.rowIndex];
    const col = this.s.columnsById().get(focus.columnId);
    if (!item || !isDataDisplayRow(item) || !col?.editable) {
      return false;
    }

    const seedKey =
      event.key === 'Backspace' || event.key === 'Delete' ? '' : event.key;
    const value = this.s.cellValue(item.row, col, item.dataIndex);
    const editMode = this.s.effectiveEditMode() === 'fullRow' ? 'fullRow' : 'cell';
    const resolved = resolveTypeToEditSeed(col, value, seedKey, editMode);
    if (resolved.action === 'ignore') {
      return false;
    }

    this.startEdit(item.row, item.rowId, item.dataIndex, col, value, {
      seed: resolved,
    });
    return true;
  }

  /**
   * Sole owner of TD vs editor DOM focus.
   * When the focused cell is in a cell/row edit session, focus the nested editor.
   */
  syncDomFocus(cell: FocusCell | null, opts?: { force?: boolean }): void {
    syncDomFocusOf(this.editFocusModel(), cell, opts);
  }

  /** Focus nested editor in a cell. Returns true when found. */
  focusEditorInCell(rowId: string | number, columnId: string, select = true): boolean {
    return focusEditorInCellOf(this.s.hostElement(), rowId, columnId, select);
  }

  /**
   * Enter on a floating-filter cell — focus the inner control (AG pattern).
   * Returns true when focus moved into the control.
   */
  activateFloatingFilter(columnId: string): boolean {
    return activateFloatingFilterOf(this.s.hostElement(), columnId);
  }

  private editFocusModel() {
    return {
      hostElement: () => this.s.hostElement(),
      injector: () => this.s.injector(),
      pagedDisplayRows: () => this.s.pagedDisplayRows(),
      columnsById: () => this.s.columnsById(),
      editingCell: () => this.editingCell(),
      isRowEditing: (rowId: string | number) => this.rowEditMgr.isEditing(rowId),
    };
  }
}
