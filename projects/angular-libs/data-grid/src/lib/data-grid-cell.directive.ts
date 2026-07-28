import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type {
  DataGridContextMenuContext,
  ResolvedColumn,
  RowEditContext,
} from './components/data-grid/data-grid.types';

/**
 * Marks an `ng-template` as a custom cell renderer for a column id / field.
 *
 * @example
 * ```html
 * <ng-template alGridCell="status" let-row let-value="value" let-form="form">...</ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[alGridCell]',
})
export class DataGridCellDirective<T = unknown> {
  readonly alGridCell = input.required<string>();
  readonly template = inject(TemplateRef<{
    $implicit: T;
    value: unknown;
    row: T;
    rowIndex: number;
    columnId: string;
    editing: boolean;
    form: FieldTree<T> | null;
    field: FieldTree<unknown> | null;
    rowEdit: RowEditContext<T> | null;
  }>);
}

/**
 * Marks an `ng-template` as a custom header for a column id / field.
 *
 * @example
 * ```html
 * <ng-template alGridHeader="salary" let-column="column">{{ column.header }} 💰</ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[alGridHeader]',
})
export class DataGridHeaderDirective<T = unknown> {
  readonly alGridHeader = input.required<string>();
  readonly template = inject(TemplateRef<{
    $implicit: ResolvedColumn<T>;
    column: ResolvedColumn<T>;
    columnId: string;
  }>);
}

/** Custom loading overlay. */
@Directive({
  selector: 'ng-template[alGridLoading]',
})
export class DataGridLoadingDirective {
  readonly template = inject(TemplateRef<void>);
}

/** Custom empty overlay. */
@Directive({
  selector: 'ng-template[alGridEmpty]',
})
export class DataGridEmptyDirective {
  readonly template = inject(TemplateRef<void>);
}

/**
 * Optional fully custom context menu body.
 *
 * @example
 * ```html
 * <ng-template alGridContextMenu let-ctx>
 *   <button type="button" (click)="doThing(ctx); ctx.close()">Edit</button>
 * </ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[alGridContextMenu]',
})
export class DataGridContextMenuDirective<T = unknown> {
  readonly template = inject(TemplateRef<{
    $implicit: DataGridContextMenuContext<T>;
    ctx: DataGridContextMenuContext<T>;
  }>);
}
