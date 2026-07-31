import { computed, type Signal } from '@angular/core';
import type { FormController } from '../create-form';
import type { FormElement, FormElementBaseConfig, MaybeSignal } from '../types';
import type { FormUiFieldTree } from '../types/form-ui-field-tree';
import { unwrapMaybeSignal } from './resolve-field';

let nextControlId = 0;

export function createControlId(explicit?: string): string {
  return explicit || `al-control-${++nextControlId}`;
}

export function fieldDisabled(field: FormUiFieldTree | null | undefined): boolean {
  return field?.()?.disabled() ?? false;
}

export function fieldReadonly(
  field: FormUiFieldTree | null | undefined,
  elementReadonly?: MaybeSignal<boolean>,
): boolean {
  if (field?.()?.readonly()) {
    return true;
  }
  if (elementReadonly == null) {
    return false;
  }
  return !!unwrapMaybeSignal(elementReadonly);
}

export function fieldInvalid(field: FormUiFieldTree | null | undefined): boolean {
  return field?.()?.invalid() ?? false;
}

export function fieldHasStringValue(field: FormUiFieldTree | null | undefined): boolean {
  const v = field?.()?.value();
  if (v == null) {
    return false;
  }
  return String(v).length > 0;
}

export function clearFieldValue(field: FormUiFieldTree | null | undefined, empty: unknown = ''): void {
  const state = field?.();
  if (!state) {
    return;
  }
  state.value.set(empty as never);
  state.markAsDirty();
  state.markAsTouched();
}

export function submitAttemptedOf(controller: FormController | null | undefined): boolean {
  return controller?.submitAttempted() ?? false;
}

/** Shared computed helpers for field components. */
export function useFieldChrome(
  field: () => FormUiFieldTree | null,
  element: () => FormElementBaseConfig | FormElement,
  controller: () => FormController | null,
): {
  disabled: Signal<boolean>;
  readonly: Signal<boolean>;
  invalid: Signal<boolean>;
  hasValue: Signal<boolean>;
  submitAttempted: Signal<boolean>;
  controlId: Signal<string>;
  describedById: Signal<string>;
} {
  const fallbackId = createControlId();
  const disabled = computed(() => fieldDisabled(field()));
  const readonly = computed(() => fieldReadonly(field(), element().readonly));
  const invalid = computed(() => fieldInvalid(field()));
  const hasValue = computed(() => fieldHasStringValue(field()));
  const submitAttempted = computed(() => submitAttemptedOf(controller()));
  const controlId = computed(() => element().controlId || fallbackId);
  const describedById = computed(() => `${controlId()}-desc`);
  return { disabled, readonly, invalid, hasValue, submitAttempted, controlId, describedById };
}
