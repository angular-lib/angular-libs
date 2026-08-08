import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { DEFAULT_MONTHS, DEFAULT_WEEKDAYS } from '../../utils/date-time';
import { AlDatePicker } from '../controls/date-picker';
import { AlFieldShell } from '../field-shell/field-shell';

let nextAnchor = 0;

@Component({
  selector: 'al-form-date',
  imports: [AlFieldShell, AlDatePicker, FormField],
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
        <al-date-picker
          class="al-control__control"
          [formField]="$any(f)"
          [anchorName]="anchor"
          [rangeMin]="props().min ?? '1900-01-01'"
          [rangeMax]="props().max ?? '2100-12-31'"
          [disabledDates]="props().disabledDates ?? []"
          [firstDayOfWeek]="props().firstDayOfWeek ?? 1"
          [months]="props().months ?? months"
          [weekdays]="props().weekdays ?? weekdays"
          [showWeekNumbers]="props().showWeekNumbers ?? true"
          [clearText]="props().clearText ?? 'Clear'"
          [todayText]="props().todayText ?? 'Today'"
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
export class AlFormDate {
  protected readonly anchor = `--al-form-date-${++nextAnchor}`;
  protected readonly months = DEFAULT_MONTHS;
  protected readonly weekdays = DEFAULT_WEEKDAYS;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'date' }>();
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
