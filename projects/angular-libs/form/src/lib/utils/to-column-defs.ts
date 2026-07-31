import { unwrapFormElement } from './resolve-field';
import type { FormColumnDef, FormElementConfig } from '../types';

const typeMap: Record<string, FormColumnDef['type']> = {
  text: 'text',
  textarea: 'text',
  password: 'text',
  search: 'text',
  number: 'number',
  checkbox: 'boolean',
  select: 'text',
};

/**
 * Map form elements to a minimal column-shaped list for data-grid adapters.
 * Flattens groups; skips layout-only nodes.
 */
export function toColumnDefs<TData>(elements: readonly FormElementConfig<TData>[]): FormColumnDef[] {
  const cols: FormColumnDef[] = [];

  const visit = (list: readonly FormElementConfig<TData>[]): void => {
    for (const item of list) {
      const el = unwrapFormElement(item);
      if (el.type === 'group') {
        visit(el.props.elements);
        continue;
      }
      if (el.type === 'line-break' || el.type === 'space' || el.type === 'custom' || !el.path) {
        continue;
      }
      const label = typeof el.label === 'string' ? el.label : undefined;
      cols.push({
        field: el.path as string,
        header: label ?? (el.path as string),
        type: typeMap[el.type] ?? 'text',
        editable: true,
      });
    }
  };

  visit(elements);
  return cols;
}
