import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { fieldReadonly } from '../../utils/field-state';
import { AlFieldShell } from '../field-shell/field-shell';
import {
  AlDropdown,
  type AlDropdownValueChange,
} from '../dropdown/al-dropdown';
import type { AlDropdownApi } from '../dropdown/dropdown-api';
import { resolveEmptyValue } from '../dropdown/selection';
import type { DropdownItem } from '../dropdown/dropdown-utils';

let nextSelectAnchor = 0;

@Component({
  selector: 'al-select-field',
  imports: [AlFieldShell, AlDropdown],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [hasValue]="hasValue()"
      [clearableOverride]="true"
      [controlAnchor]="fieldAnchor"
      (clear)="clear($event)">
      <al-dropdown
        #dropdown
        class="al-control__control al-select-dropdown"
        [panelAnchor]="fieldAnchor"
        [id]="af.controlId()"
        [valueKey]="props().valueKey"
        [labelKeys]="props().labelKeys"
        [multiple]="!!props().multiple"
        [items]="props().items ?? []"
        [loadItems]="props().loadItems"
        [datasource]="props().datasource"
        [placeholder]="props().placeholder ?? 'Select…'"
        [disabled]="disabled()"
        [readonly]="readonly()"
        [searchable]="props().searchable !== false"
        [disableSearchFiltering]="!!props().disableSearchFiltering"
        [groupBy]="props().groupBy"
        [isRowDisabled]="props().isRowDisabled"
        [columns]="treeEnabled() ? undefined : props().columns"
        [panelMaxHeight]="props().panelMaxHeight ?? 240"
        [enableCheckboxes]="!!props().enableCheckboxes"
        [footerText]="props().footerText"
        [noItemsText]="props().noItemsText ?? 'No items'"
        [loadingText]="props().loadingText ?? 'Loading…'"
        [createText]="props().createText"
        [creatable]="props().creatable"
        [tree]="props().tree"
        [showHeaders]="!!props().columns?.length && !treeEnabled()"
        [valueMode]="valueMode()"
        [value]="displayRows()"
        (valueChange)="onValueChange($event)"
        (footerClick)="props().onFooterClick?.()" />
    </al-field-shell>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSelectField {
  /** Anchor on control chrome so the panel lines up under the input box. */
  protected readonly fieldAnchor = `--al-select-${++nextSelectAnchor}`;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'select' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly dropdown = viewChild<AlDropdown>('dropdown');

  protected readonly props = computed(() => this.element().props);

  protected readonly disabled = computed(() => this.field()?.()?.disabled() ?? false);

  protected readonly readonly = computed(() =>
    fieldReadonly(this.field(), this.element().readonly),
  );

  protected readonly valueMode = computed(() => this.props().valueMode ?? 'id');

  protected readonly treeEnabled = computed(() => !!this.props().tree);

  protected readonly displayRows = computed(() => {
    const path = this.element().path as string | undefined;
    const ctrl = this.controller();
    if (!path || !ctrl) {
      return [] as DropdownItem[];
    }
    const map = ctrl.selectionDisplay();
    const sig = map[path];
    return (sig ? sig() : []) as DropdownItem[];
  });

  protected readonly hasValue = computed(() => {
    const state = this.field()?.();
    if (!state) {
      return false;
    }
    const v = state.value();
    if (this.props().multiple) {
      return Array.isArray(v) && v.length > 0;
    }
    return v !== null && v !== undefined && v !== '' && v !== 0;
  });

  /** Imperative access to the underlying dropdown. */
  api(): AlDropdownApi | undefined {
    return this.dropdown()?.api();
  }

  protected onValueChange(change: AlDropdownValueChange): void {
    const state = this.field()?.();
    if (!state || this.disabled()) {
      return;
    }
    const mode = this.valueMode();
    const multiple = !!this.props().multiple;

    if (multiple) {
      if (mode === 'object') {
        state.value.set(change.rows as never);
      } else {
        state.value.set(change.ids as never);
        this.writeDisplay(change.rows);
      }
    } else if (change.rows.length === 0) {
      this.applyClear(state);
      return;
    } else if (mode === 'object') {
      state.value.set(change.rows[0] as never);
    } else {
      state.value.set(change.ids[0] as never);
      this.writeDisplay(change.rows);
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
    this.applyClear(state);
  }

  private applyClear(state: {
    value: { set: (v: never) => void; (): unknown };
    markAsDirty: () => void;
    markAsTouched: () => void;
  }): void {
    if (this.props().multiple) {
      state.value.set([] as never);
    } else if (this.valueMode() === 'object') {
      state.value.set(null as never);
    } else {
      state.value.set(resolveEmptyValue(this.props().emptyValue, state.value()) as never);
    }
    this.writeDisplay([]);
    state.markAsDirty();
    state.markAsTouched();
    this.dropdown()?.api().setValue([]);
  }

  private writeDisplay(rows: readonly DropdownItem[]): void {
    const path = this.element().path as string | undefined;
    const ctrl = this.controller();
    if (!path || !ctrl) {
      return;
    }
    ctrl.selectionFor(path).set([...rows]);
  }
}
