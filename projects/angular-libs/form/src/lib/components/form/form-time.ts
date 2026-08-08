import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlTimePicker } from '../controls/time-picker';
import { AlFieldShell } from '../field-shell/field-shell';

let nextAnchor = 0;

@Component({
  selector: 'al-form-time',
  imports: [AlFieldShell, AlTimePicker, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="''"
      [clearableOverride]="true"
      [controlAnchor]="anchor"
      [hasValue]="hasValue()"
      (clear)="onShellClear($event)">
      @if (field(); as f) {
        <al-time-picker
          class="al-control__control"
          [formField]="$any(f)"
          [anchorName]="anchor"
          [rangeMin]="props().min ?? '00:00'"
          [rangeMax]="props().max ?? '23:59'"
          [step]="props().step ?? 1"
          [id]="af.controlId()"
          [placeholder]="props().placeholder"
          [describedBy]="af.describedById()" />
      }
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
export class AlFormTime {
  protected readonly anchor = `--al-form-time-${++nextAnchor}`;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'time' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly props = computed(() => this.element().props ?? {});
  protected readonly hasValue = computed(() => {
    const v = this.field()?.()?.value();
    return typeof v === 'string' ? v.length > 0 : !!v;
  });

  protected onShellClear(event: Event): void {
    event.stopPropagation();
    this.props().onClear?.({
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    });
  }
}
