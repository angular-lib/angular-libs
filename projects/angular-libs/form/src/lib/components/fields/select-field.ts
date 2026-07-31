import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-select-field',
  imports: [AlFieldShell],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [hasValue]="hasValue()"
      [clearableOverride]="true"
      (clear)="clear($event)">
      <button
        #inputRef
        type="button"
        class="al-control__control al-select__trigger"
        [id]="af.controlId()"
        [disabled]="disabled()"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        [attr.aria-invalid]="af.invalid() || null"
        [attr.aria-describedby]="af.describedById()">
        {{ closedLabel() }}
      </button>
    </al-field-shell>
    @if (open()) {
      <ul class="al-select__panel" role="listbox" [attr.aria-multiselectable]="multiple()">
        @if (loading()) {
          <li class="al-select__status">Loading…</li>
        } @else if (loadError()) {
          <li class="al-select__status al-select__status--error">{{ loadError() }}</li>
        } @else if (panelItems().length === 0) {
          <li class="al-select__status">No items</li>
        } @else {
          @for (item of panelItems(); track itemKey(item)) {
            <li
              role="option"
              class="al-select__option"
              [class.al-select__option--selected]="isSelected(item)"
              [attr.aria-selected]="isSelected(item)"
              (click)="pick(item)">
              {{ formatItem(item) }}
            </li>
          }
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }
    .al-select__panel {
      list-style: none;
      margin: 0.25rem 0 0;
      padding: 0;
      border: 1px solid currentColor;
      max-height: 12rem;
      overflow: auto;
      background: #fff;
      z-index: 2;
      position: absolute;
      inset-inline: 0;
    }
    .al-select__option,
    .al-select__status {
      padding: 0.35rem 0.5rem;
      cursor: pointer;
    }
    .al-select__option--selected {
      font-weight: 700;
      text-decoration: underline;
    }
    .al-select__status {
      cursor: default;
      opacity: 0.7;
    }
    .al-select__status--error {
      opacity: 1;
      color: #b00020;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSelectField {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'select' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loadedItems = signal<readonly Record<string, unknown>[] | null>(null);

  protected readonly disabled = computed(() => this.field()?.()?.disabled() ?? false);

  protected readonly multiple = computed(() => !!this.element().props.multiple);

  protected readonly valueMode = computed(() => this.element().props.valueMode ?? 'id');

  protected readonly panelItems = computed(() => {
    const loaded = this.loadedItems();
    if (loaded) {
      return loaded;
    }
    return this.element().props.items ?? [];
  });

  protected readonly displayRows = computed(() => {
    const path = this.element().path as string | undefined;
    const ctrl = this.controller();
    if (!path || !ctrl) {
      return [] as unknown[];
    }
    const map = ctrl.selectionDisplay();
    const sig = map[path];
    return sig ? sig() : [];
  });

  protected readonly closedLabel = computed(() => {
    const rows = this.displayRows();
    const keys = this.element().props.labelKeys;
    const placeholder = this.element().props.placeholder ?? 'Select…';
    if (!rows.length) {
      return placeholder;
    }
    return rows.map((row) => this.formatRow(row as Record<string, unknown>, keys)).join(', ');
  });

  protected readonly hasValue = computed(() => {
    const state = this.field()?.();
    if (!state) {
      return false;
    }
    const v = state.value();
    if (this.multiple()) {
      return Array.isArray(v) && v.length > 0;
    }
    return v !== null && v !== undefined && v !== '' && v !== 0;
  });

  protected formatItem(item: Record<string, unknown>): string {
    return this.formatRow(item, this.element().props.labelKeys);
  }

  protected formatRow(row: Record<string, unknown>, keys: string[]): string {
    return keys
      .map((k) => row?.[k])
      .filter((v) => v != null && v !== '')
      .join(' — ');
  }

  protected itemKey(item: Record<string, unknown>): unknown {
    return item[this.element().props.valueKey];
  }

  protected isSelected(item: Record<string, unknown>): boolean {
    const key = this.itemKey(item);
    const state = this.field()?.();
    if (!state) {
      return false;
    }
    const v = state.value();
    if (this.valueMode() === 'object') {
      if (this.multiple()) {
        return Array.isArray(v) && v.some((row) => this.rowKey(row) === key);
      }
      return this.rowKey(v) === key;
    }
    if (this.multiple()) {
      return Array.isArray(v) && v.includes(key);
    }
    return v === key;
  }

  private rowKey(row: unknown): unknown {
    const valueKey = this.element().props.valueKey;
    if (row && typeof row === 'object' && valueKey in (row as object)) {
      return (row as Record<string, unknown>)[valueKey];
    }
    return row;
  }

  protected async toggle(): Promise<void> {
    if (this.disabled()) {
      return;
    }
    const next = !this.open();
    this.open.set(next);
    if (next) {
      await this.ensureItemsLoaded();
    }
  }

  private async ensureItemsLoaded(): Promise<void> {
    const props = this.element().props;
    if (props.items?.length || this.loadedItems()) {
      return;
    }
    if (!props.loadItems) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const items = await props.loadItems();
      this.loadedItems.set(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load items';
      this.loadError.set(message);
      this.loadedItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected pick(item: Record<string, unknown>): void {
    const state = this.field()?.();
    if (!state || this.disabled()) {
      return;
    }
    const valueKey = this.element().props.valueKey;
    const id = item[valueKey];
    const mode = this.valueMode();

    if (this.multiple()) {
      const current = state.value();
      const currentIds = this.normalizeIds(current, mode, valueKey);
      const selected = new Set(currentIds);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      const nextIds = [...selected];
      const display = this.mergeDisplay(nextIds, item, id, valueKey);

      if (mode === 'object') {
        state.value.set(display);
      } else {
        state.value.set(nextIds);
        this.writeDisplay(display);
      }
    } else {
      if (mode === 'object') {
        state.value.set(item);
      } else {
        state.value.set(id);
        this.writeDisplay([item]);
      }
      this.open.set(false);
    }

    state.markAsDirty();
    state.markAsTouched();
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    const state = this.field()?.();
    if (!state || this.disabled()) {
      return;
    }
    if (this.multiple()) {
      state.value.set([]);
    } else if (this.valueMode() === 'object') {
      state.value.set(null as never);
    } else {
      const explicit = this.element().props.emptyValue;
      if (explicit !== undefined) {
        state.value.set(explicit as never);
      } else {
        const current = state.value();
        if (typeof current === 'string') {
          state.value.set('' as never);
        } else if (typeof current === 'number') {
          state.value.set(0 as never);
        } else {
          state.value.set(null as never);
        }
      }
    }
    this.writeDisplay([]);
    state.markAsDirty();
    state.markAsTouched();
  }

  private normalizeIds(current: unknown, mode: 'id' | 'object', _valueKey: string): unknown[] {
    if (!Array.isArray(current)) {
      return [];
    }
    if (mode === 'object') {
      return current.map((row) => this.rowKey(row));
    }
    return [...current];
  }

  private mergeDisplay(
    nextIds: unknown[],
    toggled: Record<string, unknown>,
    toggledId: unknown,
    valueKey: string,
  ): Record<string, unknown>[] {
    const existing = this.displayRows().filter((row) =>
      nextIds.includes((row as Record<string, unknown>)[valueKey]),
    ) as Record<string, unknown>[];
    const hasToggled = nextIds.includes(toggledId);
    const without = existing.filter((row) => row[valueKey] !== toggledId);
    return hasToggled ? [...without, toggled] : without;
  }

  private writeDisplay(rows: unknown[]): void {
    const path = this.element().path as string | undefined;
    const ctrl = this.controller();
    if (!path || !ctrl) {
      return;
    }
    ctrl.selectionFor(path).set([...rows]);
  }
}
