/**
 * Kernel-adjacent full-row edit session (Signal Forms).
 * DataGrid owns one instance and exposes it as {@link RowEditAdapter}.
 */

import {
  createEnvironmentInjector,
  effect,
  runInInjectionContext,
  signal,
  type EnvironmentInjector,
  type WritableSignal,
} from '@angular/core';
import { form, type FieldTree } from '@angular/forms/signals';
import type {
  ColumnDef,
  CreateRowFormFn,
  RowEditContext,
  RowEditEvent,
  RowEditSchema,
} from '../components/data-grid/data-grid.types';
import { cloneRowDraft, formFieldForColumn } from '../utils/row-edit';
import type { RowEditAdapter } from './cell-editor-registry';

export interface RowEditSessionHooks<T> {
  getHostForm: () => FieldTree<T> | null;
  setHostForm: (tree: FieldTree<T> | null) => void;
  getSchema: () => RowEditSchema<T> | null;
  getFactory: () => CreateRowFormFn<T> | null;
  resolveColumn: (key: string) => ColumnDef<T> | undefined;
  parentInjector: EnvironmentInjector;
  onSession: (ctx: RowEditContext<T> | null) => void;
  onDraft: (draft: T | null) => void;
  onStart: (ctx: RowEditContext<T>) => void;
  onCommit: (event: RowEditEvent<T>) => void;
  onCancel: (payload: { rowId: string | number }) => void;
}

export class RowEditSession<T = unknown> implements RowEditAdapter<T> {
  private readonly editingRowId = signal<string | number | null>(null);
  private readonly editingRowIndex = signal(0);
  private readonly editingOriginal = signal<T | null>(null);
  private readonly sessionCtx = signal<RowEditContext<T> | null>(null);
  private readonly draftModel = signal<T | null>(null);

  private rowDraftSignal: WritableSignal<T> | null = null;
  private sessionOwnedForm = false;
  private editSessionInjector: EnvironmentInjector | null = null;
  private draftSyncDestroy: (() => void) | null = null;

  constructor(private readonly hooks: RowEditSessionHooks<T>) {}

  readonly session = (): RowEditContext<T> | null => this.sessionCtx();
  readonly draft = (): T | null => this.draftModel();

  editingId(): string | number | null {
    return this.editingRowId();
  }

  isEditing(rowId: string | number): boolean {
    return this.editingRowId() === rowId;
  }

  start(row: T, rowId: string | number, rowIndex: number): void {
    if (this.editingRowId() === rowId) {
      // Same id — intentional no-op even if `row` is a fresh object after a data refresh.
      return;
    }
    // Switching rows must cancel (emit onCancel) so hosts can restore drafts.
    if (this.editingRowId() != null) {
      this.cancel();
    }

    const original = cloneRowDraft(row);
    this.editingOriginal.set(original);
    this.editingRowId.set(rowId);
    this.editingRowIndex.set(rowIndex);

    const hostForm = this.hooks.getHostForm();
    let tree: FieldTree<T>;
    let draft: WritableSignal<T>;

    if (hostForm) {
      this.sessionOwnedForm = false;
      tree = hostForm;
      draft = tree().value as WritableSignal<T>;
      draft.set(cloneRowDraft(row));
    } else {
      this.sessionOwnedForm = true;
      draft = signal(cloneRowDraft(row));
      this.editSessionInjector = createEnvironmentInjector([], this.hooks.parentInjector);
      const schema = this.hooks.getSchema();
      const factory = this.hooks.getFactory();
      const injector = this.editSessionInjector;
      tree = runInInjectionContext(injector, () => {
        if (factory) {
          return factory(draft);
        }
        if (schema) {
          return form(draft, schema, { injector });
        }
        return form(draft, { injector });
      });
      this.hooks.setHostForm(tree);
    }

    this.rowDraftSignal = draft;
    this.draftModel.set(draft());
    this.hooks.onDraft(draft());
    this.draftSyncDestroy?.();
    const syncInjector = this.editSessionInjector ?? this.hooks.parentInjector;
    const syncRef = effect(
      () => {
        this.draftModel.set(draft());
        this.hooks.onDraft(draft());
      },
      { injector: syncInjector },
    );
    this.draftSyncDestroy = () => syncRef.destroy();

    const ctx = this.buildContext(row, rowId, rowIndex, tree);
    this.sessionCtx.set(ctx);
    this.hooks.onSession(ctx);
    this.hooks.onStart(ctx);
  }

  commit(): boolean {
    const tree = this.hooks.getHostForm();
    const rowId = this.editingRowId();
    const original = this.editingOriginal();
    const draftSignal = this.rowDraftSignal;
    if (!tree || rowId == null || original == null || !draftSignal) {
      return false;
    }
    if (tree().invalid()) {
      tree().markAsTouched();
      return false;
    }
    const value = cloneRowDraft(draftSignal());
    const rowIndex = this.editingRowIndex();
    this.hooks.onCommit({
      row: original,
      rowId,
      rowIndex,
      previousValue: original,
      value,
      form: tree,
    });
    this.destroy();
    return true;
  }

  cancel(): void {
    const rowId = this.editingRowId();
    const original = this.editingOriginal();
    const tree = this.hooks.getHostForm();
    if (tree && original && !this.sessionOwnedForm) {
      (tree().value as WritableSignal<T>).set(cloneRowDraft(original));
    }
    this.destroy();
    if (rowId != null) {
      this.hooks.onCancel({ rowId });
    }
  }

  destroy(): void {
    this.draftSyncDestroy?.();
    this.draftSyncDestroy = null;
    this.editingRowId.set(null);
    this.editingOriginal.set(null);
    this.draftModel.set(null);
    this.sessionCtx.set(null);
    this.hooks.onSession(null);
    this.hooks.onDraft(null);
    this.rowDraftSignal = null;

    if (this.sessionOwnedForm) {
      this.editSessionInjector?.destroy();
      this.editSessionInjector = null;
      this.hooks.setHostForm(null);
    }
    this.sessionOwnedForm = false;
  }

  private buildContext(
    row: T,
    rowId: string | number,
    rowIndex: number,
    tree: FieldTree<T>,
  ): RowEditContext<T> {
    const draftSignal = this.rowDraftSignal ?? tree().value;
    return {
      row,
      rowId,
      rowIndex,
      draft: draftSignal,
      form: tree,
      field: (column) => {
        if (typeof column === 'string') {
          const col = this.hooks.resolveColumn(column);
          return col ? formFieldForColumn(tree, col) : null;
        }
        return formFieldForColumn(tree, column);
      },
      commit: () => this.commit(),
      cancel: () => this.cancel(),
    };
  }
}
