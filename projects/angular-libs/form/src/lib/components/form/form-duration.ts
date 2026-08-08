import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlDuration } from '../controls/duration';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-duration',
  imports: [AlFieldShell, AlDuration, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="null"
      [clearableOverride]="true"
      [hasValue]="hasValue()">
      @if (field(); as f) {
        <al-duration
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [stepHh]="element().props?.stepHh ?? 1"
          [stepMm]="element().props?.stepMm ?? 1"
          [stepSs]="element().props?.stepSs ?? 1"
          [showSeconds]="element().props?.showSeconds !== false"
          [maxHours]="element().props?.maxHours ?? 99"
          [minSeconds]="element().props?.minSeconds"
          [maxSeconds]="element().props?.maxSeconds"
          [wheel]="!!element().props?.wheel"
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
export class AlFormDuration {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'duration' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly hasValue = computed(() => this.field()?.()?.value() != null);
}
