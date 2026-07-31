import { signal, type Signal, type WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { FormElementConfig, FormPath, SelectionDisplayMap } from './types';

export interface CreateFormOptions<TData = unknown> {
  /**
   * UI elements. Prefer `formFactories<TData>()` so `path` is checked against the model,
   * or pass `formText<TData>({ path: '…' })` explicitly.
   */
  elements: readonly FormElementConfig<TData>[];
}

/**
 * Held UI controller — elements + S2 selectionDisplay + submit/error UI helpers.
 * Does not own Angular `form()` / FieldTree.
 */
export class FormController<TData = unknown> {
  private readonly _elements: WritableSignal<readonly FormElementConfig<any>[]>;
  private readonly _selectionDisplay: WritableSignal<SelectionDisplayMap>;
  private readonly _submitAttempted: WritableSignal<boolean>;

  readonly elements: Signal<readonly FormElementConfig<any>[]>;
  readonly selectionDisplay: Signal<SelectionDisplayMap>;
  /** True after a failed/attempted submit — drives error reveal for untouched fields. */
  readonly submitAttempted: Signal<boolean>;

  constructor(options: CreateFormOptions<TData>) {
    this._elements = signal(options.elements as readonly FormElementConfig<any>[]);
    this._selectionDisplay = signal<SelectionDisplayMap>({});
    this._submitAttempted = signal(false);
    this.elements = this._elements.asReadonly();
    this.selectionDisplay = this._selectionDisplay.asReadonly();
    this.submitAttempted = this._submitAttempted.asReadonly();
  }

  setElements(elements: readonly FormElementConfig<TData>[]): void {
    this._elements.set(elements as readonly FormElementConfig<any>[]);
  }

  /** Ensure a writable display list exists for `path` (S2). */
  selectionFor(path: string): WritableSignal<unknown[]> {
    const map = this._selectionDisplay();
    const existing = map[path];
    if (existing) {
      return existing;
    }
    const created = signal<unknown[]>([]);
    this._selectionDisplay.update((m) => ({ ...m, [path]: created }));
    return created;
  }

  /** Mark that the host attempted submit (reveals errors on untouched invalid fields). */
  markSubmitAttempted(): void {
    this._submitAttempted.set(true);
  }

  /** Mark the whole field tree touched and flag submit-attempted. */
  markAllTouched(form: FieldTree<TData>): void {
    form().markAsTouched();
    this._submitAttempted.set(true);
  }

  /** Focus the first invalid bound control (uses Signal Forms `focusBoundControl`). */
  focusFirstInvalid(form: FieldTree<TData>): boolean {
    const root = form();
    const errors = root.errorSummary();
    for (const err of errors) {
      const tree = err.fieldTree as FieldTree<unknown> | undefined;
      if (tree) {
        tree().focusBoundControl();
        return true;
      }
    }
    if (root.invalid()) {
      root.focusBoundControl();
      return true;
    }
    return false;
  }

  /**
   * Reset UI-only state (submit-attempted + selection display).
   * Does not change the model — host should reset model / `form().reset()` separately.
   */
  resetUi(options?: { clearSelection?: boolean }): void {
    this._submitAttempted.set(false);
    if (options?.clearSelection !== false) {
      clearSelection(this);
    }
  }
}

export function createForm<TData = unknown>(options: CreateFormOptions<TData>): FormController<TData> {
  return new FormController(options);
}

/** Seed closed-UI labels for edit hydrate (expand/join).
 *
 * S2 keeps IDs in the model and labels in `selectionDisplay`.
 * Call after loading an entity so the closed select shows names immediately.
 *
 * @example
 * ```ts
 * seedSelection(formUi, {
 *   roleId: [{ id: user.roleId, name: user.roleName }],
 *   tagIds: user.tags, // [{ id, name }, ...]
 * });
 * ```
 */
export function seedSelection<TData>(
  controller: FormController<TData>,
  partial: Partial<Record<FormPath<TData> & string, readonly unknown[]>>,
): void {
  for (const [path, rows] of Object.entries(partial)) {
    if (!path) {
      continue;
    }
    const list = (rows ?? []) as unknown[];
    controller.selectionFor(path).set([...list]);
  }
}

/** Clear one or all selection display paths. */
export function clearSelection<TData>(controller: FormController<TData>, paths?: readonly string[]): void {
  const map = controller.selectionDisplay();
  const keys = paths ?? Object.keys(map);
  for (const path of keys) {
    map[path]?.set([]);
  }
}
