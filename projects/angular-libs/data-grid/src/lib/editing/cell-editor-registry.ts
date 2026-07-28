/**
 * Kernel-adjacent editing module — Signal Forms row edit + cell draft helpers.
 * Not an optional chrome plugin: editing is a core differentiator.
 */

import type { FieldTree } from '@angular/forms/signals';
import type { Type } from '@angular/core';
import type {
  BuiltInCellEditor,
  ColumnDef,
  RowEditContext,
} from '../components/data-grid/data-grid.types';
import { isSelectEditor, isCustomEditorComponent } from '../utils/editors';
import { isBooleanColumn, isDateColumn } from '../utils/cell-value';

/** Optional thin adapter for imperative row-edit flows (not the primary DX). */
export interface RowEditAdapter<T = unknown> {
  readonly session: () => RowEditContext<T> | null;
  readonly draft: () => T | null;
  start(row: T, rowId: string | number, rowIndex: number): void;
  commit(): boolean;
  cancel(): void;
}

/** Resolved editor kind for template / custom component outlet. */
export type ResolvedCellEditor =
  | { kind: 'boolean' }
  | { kind: 'select' }
  | { kind: 'date' }
  | { kind: 'number' }
  | { kind: 'text' }
  | { kind: 'custom'; component: Type<unknown> };

type EditorResolver = (column: ColumnDef<unknown>) => ResolvedCellEditor | null;

const builtInResolvers: EditorResolver[] = [
  (column) =>
    isCustomEditorComponent(column)
      ? { kind: 'custom', component: column.cellEditor as Type<unknown> }
      : null,
  (column) =>
    isBooleanColumn(column) || column.cellEditor === 'boolean' ? { kind: 'boolean' } : null,
  (column) => (isSelectEditor(column) ? { kind: 'select' } : null),
  (column) => (isDateColumn(column) || column.cellEditor === 'date' ? { kind: 'date' } : null),
  (column) =>
    column.type === 'number' || column.filter === 'number' || column.cellEditor === 'number'
      ? { kind: 'number' }
      : null,
];

/**
 * Per-grid (or app-wide) editor resolver chain.
 * Prefer an instance on each {@link DataGrid}; the module default is the fallback parent.
 */
export class CellEditorRegistry {
  private readonly extras: EditorResolver[] = [];

  constructor(private readonly parent: CellEditorRegistry | null = null) {}

  register(resolve: EditorResolver): () => void {
    this.extras.push(resolve);
    return () => {
      const idx = this.extras.indexOf(resolve);
      if (idx >= 0) {
        this.extras.splice(idx, 1);
      }
    };
  }

  resolve<T>(column: ColumnDef<T>): ResolvedCellEditor {
    const col = column as ColumnDef<unknown>;
    for (const resolve of this.extras) {
      const hit = resolve(col);
      if (hit) {
        return hit;
      }
    }
    if (this.parent) {
      return this.parent.resolve(column);
    }
    for (const resolve of builtInResolvers) {
      const hit = resolve(col);
      if (hit) {
        return hit;
      }
    }
    const builtIn = column.cellEditor as BuiltInCellEditor | undefined;
    if (
      builtIn === 'text' ||
      builtIn === 'number' ||
      builtIn === 'date' ||
      builtIn === 'boolean' ||
      builtIn === 'select'
    ) {
      return { kind: builtIn };
    }
    return { kind: 'text' };
  }
}

/** App-wide default registry — shared across grids unless they use a child instance. */
export const defaultCellEditorRegistry = new CellEditorRegistry();

/**
 * Register an app-wide editor resolver (affects every grid using the default registry).
 * Prefer {@link CellEditorRegistry.register} on a per-grid instance when possible.
 */
export function registerBuiltInEditorResolver(resolve: EditorResolver): () => void {
  return defaultCellEditorRegistry.register(resolve);
}

export function resolveCellEditor<T>(
  column: ColumnDef<T>,
  registry: CellEditorRegistry = defaultCellEditorRegistry,
): ResolvedCellEditor {
  return registry.resolve(column);
}

/** Prefer host-owned FieldTree; session-owned form is the fallback path. */
export function isHostOwnedRowForm<T>(
  rowForm: FieldTree<T> | null | undefined,
  sessionOwned: boolean,
): boolean {
  return !!rowForm && !sessionOwned;
}
