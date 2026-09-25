import { signal, type WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { focusRealmOf, type FocusCell } from '../controllers/focus';
import {
  isImeComposing,
  isTypeToEditKey,
  resolveTypeToEditSeed,
  type TypeToEditSeed,
} from '../editing/edit-interaction';
import {
  cellParseContextFromLocale,
  formatNumberForEdit,
  isNumberColumn,
  parseCellInput,
  sameCellValue,
  type CellParseContext,
} from '../utils/coerce-cell-value';
import { isNumberEditorColumn, RowTextDrafts } from '../editing/row-text-drafts';
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
  /** Parse error of the open cell editor draft (editor stays open, `aria-invalid`). */
  readonly editError: WritableSignal<string | null> = signal(null);
  /** Cell whose editor was seeded by type-to-edit — caret goes to the end, no select-all. */
  private readonly caretEndCell = signal<{ rowId: string | number; columnId: string } | null>(null);
  /** fullRow number editors: raw text + parse errors (block commit). */
  readonly rowTextDrafts = new RowTextDrafts(() => this.parseContext());
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
      onSession: (ctx) => {
        this.rowTextDrafts.reset();
        this.s.rowEditSession.set(ctx);
      },
      onDraft: (draft) => this.s.rowEditDraft.set(draft),
      onStart: (ctx) => this.s.publishRowEditStart(ctx),
      onCommit: (event) => this.s.publishRowEdit(event),
      onCancel: (payload) => this.s.publishRowEditCancel(payload),
      rowSwitch: () => this.s.effectiveEditInteraction().rowSwitch,
      canCommit: () => !this.rowTextDrafts.hasErrors(),
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
    /** `pointer` never toggles booleans (checkbox click / Space / Enter do). */
    opts?: { seed?: TypeToEditSeed; source?: 'pointer' | 'keyboard' | 'api' },
  ): void {
    if (!column.editable) {
      return;
    }
    const columnId = column.id ?? column.field ?? '';
    const seed = opts?.seed;

    if (this.s.effectiveEditMode() === 'fullRow') {
      this.editingCell.set(null);
      if (!this.rowEditMgr.start(row, rowId, rowIndex)) {
        this.refocusEditor(this.rowEditMgr.editingId()!, columnId);
        return;
      }
      this.caretEndCell.set(seed?.action === 'set' ? { rowId, columnId } : null);
      if (seed?.action === 'set') {
        const key = column.field ?? column.id;
        if (isNumberEditorColumn(column)) {
          const field = formFieldForColumn(this.s.rowForm(), column);
          this.rowTextDrafts.input(column, field, String(seed.value ?? ''));
        } else if (key) {
          this.rowEditMgr.patchField(key, seed.value);
        }
      }
      this.s.syncDomFocusAfterEdit();
      return;
    }
    const open = this.editingCell();
    if (open && open.rowId === rowId && open.columnId === columnId) {
      // Already editing this cell — keep the draft (fast typing appends, no reset).
      if (seed?.action === 'set' && seed.value != null && seed.value !== '') {
        this.editDraft.update((d) => d + String(seed.value));
      }
      this.s.syncDomFocusAfterEdit();
      return;
    }
    if (!this.releaseEditorFor(rowId, columnId)) {
      return;
    }
    if (isBooleanColumn(column, value) && !isSelectEditor(column) && !isCustomEditorComponent(column)) {
      if (opts?.source === 'pointer') {
        return;
      }
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
    this.editError.set(null);
    this.caretEndCell.set(seed?.action === 'set' ? { rowId, columnId } : null);
    if (seed?.action === 'set') {
      this.editDraft.set(seed.value == null ? '' : String(seed.value));
    } else if (isDateColumn(column) || column.cellEditor === 'date') {
      this.editDraft.set(toDateKey(value) ?? '');
    } else if (isNumberColumn(column, value)) {
      this.editDraft.set(formatNumberForEdit(value, this.parseContext().numberLocale));
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
      { source: 'keyboard' },
    );
  }

  startRowEdit(row: T, rowId: string | number, rowIndex: number): void {
    if (this.s.effectiveEditMode() !== 'fullRow') {
      return;
    }
    this.editingCell.set(null);
    if (!this.rowEditMgr.start(row, rowId, rowIndex)) {
      const focus = this.s.kernel().focus.getFocus();
      this.refocusEditor(this.rowEditMgr.editingId()!, focus?.columnId ?? '');
      return;
    }
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
      { source: 'api' },
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

  /**
   * Commit the open cell draft. Returns false when not editing this cell or the
   * draft does not parse — then the editor stays open with {@link editError}.
   */
  commitEdit(row: T, rowId: string | number, rowIndex: number, column: ResolvedColumn<T>): boolean {
    const cell = this.editingCell();
    if (!cell || cell.rowId !== rowId || cell.columnId !== column.id) {
      return false;
    }
    const previousValue = getCellValue(row, column, rowIndex);
    const parsed = parseCellInput(column, this.editDraft(), {
      ...this.parseContext(),
      row,
      columnId: column.id,
      previousValue,
      source: 'edit',
    });
    if (!parsed.ok) {
      this.editError.set(parsed.error);
      return false;
    }
    const value = parsed.value;
    this.endCellEdit();
    this.s.syncDomFocusAfterEdit();
    if (sameCellValue(value, previousValue)) {
      return true;
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
    return true;
  }

  onEditorEnter(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    event?: Event,
  ): void {
    if (isImeComposing(event)) {
      return;
    }
    event?.preventDefault();
    const committed = this.commitEdit(row, rowId, rowIndex, column);
    if (committed && this.s.effectiveEditInteraction().enterEditing === 'commitAndMoveDown') {
      this.s.kernel().focus.move(1, 0);
    }
  }

  /** fullRow Enter: commit the row (IME composition keeps its Enter). */
  onRowEditorEnter(event: Event): void {
    if (isImeComposing(event)) {
      return;
    }
    event.preventDefault();
    this.commitRowEdit();
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
    if (this.commitEdit(row, rowId, rowIndex, column)) {
      this.s.kernel().focus.moveHorizontalWrap(keyEvent.shiftKey ? -1 : 1);
    }
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

  /** Cell editor `(input)`: update the draft and clear a stale parse error. */
  onEditorInput(text: string): void {
    this.editDraft.set(text);
    this.editError.set(null);
  }

  /**
   * Before focus / edit moves to another cell while a cell editor is open:
   * apply the `editorBlur` policy (commit or cancel). Returns false when the
   * draft is invalid — the editor keeps focus and the move is refused.
   */
  releaseEditorFor(rowId: string | number, columnId: string): boolean {
    const cell = this.editingCell();
    if (!cell || (cell.rowId === rowId && cell.columnId === columnId)) {
      return true;
    }
    if (this.s.effectiveEditInteraction().editorBlur === 'cancel') {
      this.cancelEdit();
      return true;
    }
    if (this.stopEditing()) {
      return true;
    }
    this.refocusEditor(cell.rowId, cell.columnId);
    return false;
  }

  /** `data-al-caret` for an editor: `'end'` after a type-to-edit seed, else select-all. */
  caretHint(rowId: string | number, columnId: string): 'end' | null {
    const cell = this.caretEndCell();
    return cell && cell.rowId === rowId && cell.columnId === columnId ? 'end' : null;
  }

  /** Number editors are text inputs (`inputmode="decimal"`) parsed with the grid locale. */
  isNumberEditor(column: ColumnDef<T>): boolean {
    return isNumberEditorColumn(column);
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
    this.endCellEdit();
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

  /** Returns false when a commit was refused (invalid draft / row form). */
  stopEditing(cancel = false): boolean {
    if (cancel) {
      if (this.rowEditMgr.editingId() != null) {
        this.cancelRowEdit();
      } else {
        this.cancelEdit();
      }
      return true;
    }
    if (this.rowEditMgr.editingId() != null) {
      return this.commitRowEdit();
    }
    const cell = this.editingCell();
    if (!cell) {
      return true;
    }
    const rows = this.s.processedRows();
    const rowIndex = rows.findIndex((row, i) => this.s.effectiveRowId()(row, i) === cell.rowId);
    const column = this.s.columnsById().get(cell.columnId);
    if (rowIndex < 0 || !column) {
      this.cancelEdit();
      return true;
    }
    return this.commitEdit(rows[rowIndex]!, cell.rowId, rowIndex, column);
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

  private parseContext(): Pick<CellParseContext, 'numberLocale' | 'messages'> {
    return cellParseContextFromLocale(this.s.resolvedLocale());
  }

  private endCellEdit(): void {
    this.editingCell.set(null);
    this.editError.set(null);
    this.caretEndCell.set(null);
  }

  /** Move focus back to the cell / row whose edit refused to close. */
  private refocusEditor(rowId: string | number, columnId: string): void {
    const index = this.s
      .pagedDisplayRows()
      .findIndex((item) => isDataDisplayRow(item) && item.rowId === rowId);
    if (index >= 0 && columnId) {
      this.s.kernel().focus.focusCell(index, columnId, 'body');
    }
    this.s.syncDomFocusAfterEdit();
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
