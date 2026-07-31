import { isSignal, type Signal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { FormElement, FormElementConfig } from '../types';

export function unwrapMaybeSignal<T>(value: T | Signal<T>): T {
  return isSignal(value) ? value() : value;
}

export function unwrapFormElement<TData>(item: FormElementConfig<TData>): FormElement<TData> {
  return unwrapMaybeSignal(item);
}

export function trackFormElement<TData>(index: number, item: FormElementConfig<TData>): string | number {
  const el = unwrapFormElement(item);
  return el.id ?? (el.path as string | undefined) ?? index;
}

/** Resolve a dotted path on a FieldTree (runtime key walk). */
export function resolveFormField<T>(
  tree: FieldTree<T> | null | undefined,
  path: string | undefined | null,
): FieldTree<unknown> | null {
  if (!tree || !path) {
    return null;
  }
  let current: unknown = tree;
  for (const part of path.split('.')) {
    if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
      return null;
    }
    // Prefer property access over `in` — FieldTree proxies may not support `in`.
    const next = (current as Record<string, unknown>)[part];
    if (next === undefined) {
      return null;
    }
    current = next;
  }
  return (current as FieldTree<unknown> | undefined) ?? null;
}
