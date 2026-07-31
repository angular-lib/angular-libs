import { isDevMode } from '@angular/core';
import type { FormFieldRegistry } from '../registry/form-field-registry';
import type { FormElement, FormElementConfig } from '../types';
import type { FormUiFieldTree } from '../types/form-ui-field-tree';
import { resolveFormField, unwrapFormElement } from './resolve-field';

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  console.warn(`[@angular-libs/form] ${message}`);
}

/**
 * Dev-only checks: unknown registry types and paths that do not resolve on the FieldTree.
 * No-ops in production (`isDevMode() === false`).
 */
export function warnInvalidFormSetup(
  form: FormUiFieldTree | null | undefined,
  elements: readonly FormElementConfig[],
  registry: FormFieldRegistry,
): void {
  if (!isDevMode() || !form) {
    return;
  }

  const visit = (list: readonly FormElementConfig[]): void => {
    for (const item of list) {
      const el = unwrapFormElement(item);
      warnElement(form, el, registry);
      if (el.type === 'group') {
        visit(el.props.elements ?? []);
      }
    }
  };

  visit(elements);
}

function warnElement(form: FormUiFieldTree, el: FormElement, registry: FormFieldRegistry): void {
  if (el.type !== 'custom' && el.type !== 'line-break' && el.type !== 'space' && el.type !== 'group') {
    if (!registry.resolve(el.type)) {
      warnOnce(
        `type:${el.type}`,
        `Unknown field type "${el.type}". Register it with provideFormFields({ ${el.type}: MyField }) or use formCustom().`,
      );
    }
  }

  if (el.path && el.type !== 'group' && el.type !== 'line-break' && el.type !== 'space') {
    const resolved = resolveFormField(form, el.path as string);
    if (!resolved) {
      warnOnce(
        `path:${el.path}`,
        `Path "${el.path}" did not resolve on the form FieldTree. Check spelling / nesting against your model.`,
      );
    }
  }
}

/** @internal */
export function clearFormValidationWarningsForTests(): void {
  warned.clear();
}
