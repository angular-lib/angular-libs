import { signal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import {
  formatNumberForEdit,
  parseCellInput,
  type CellParseContext,
} from '../utils/coerce-cell-value';

/** Number editors are text inputs (`inputmode="decimal"`) parsed with the grid locale. */
export function isNumberEditorColumn<T>(column: ColumnDef<T>): boolean {
  return column.type === 'number' || column.filter === 'number' || column.cellEditor === 'number';
}

/**
 * fullRow text-bound number editors: raw text per column + parse error.
 * The form model only receives parsed values; unparseable text stays here and
 * blocks commit instead of reaching the model as `null` / garbage.
 */
export class RowTextDrafts {
  private readonly texts = signal<ReadonlyMap<string, string>>(new Map());
  private readonly errors = signal<ReadonlyMap<string, string>>(new Map());

  constructor(
    private readonly parseContext: () => Pick<CellParseContext, 'numberLocale' | 'messages'>,
  ) {}

  reset(): void {
    if (this.texts().size) {
      this.texts.set(new Map());
    }
    if (this.errors().size) {
      this.errors.set(new Map());
    }
  }

  error(columnId: string): string | null {
    return this.errors().get(columnId) ?? null;
  }

  hasErrors(): boolean {
    return this.errors().size > 0;
  }

  /** Editor text: what the user typed, else the model value formatted for editing. */
  text(columnId: string, field: FieldTree<unknown> | null): string {
    return (
      this.texts().get(columnId) ??
      formatNumberForEdit(field ? field().value() : null, this.parseContext().numberLocale)
    );
  }

  /** `(input)`: parsed values reach the form field; unparseable text records an error. */
  input<T>(column: ColumnDef<T>, field: FieldTree<unknown> | null, text: string): void {
    const columnId = column.id ?? column.field ?? '';
    const result = parseCellInput(column, text, { ...this.parseContext(), columnId, source: 'edit' });
    const texts = new Map(this.texts());
    texts.set(columnId, text);
    this.texts.set(texts);
    const errors = new Map(this.errors());
    if (result.ok) {
      errors.delete(columnId);
    } else {
      errors.set(columnId, result.error);
    }
    this.errors.set(errors);
    const valueSignal = field ? (field().value as { set?: (v: unknown) => void }) : null;
    if (result.ok && typeof valueSignal?.set === 'function') {
      valueSignal.set(result.value);
    }
  }
}
