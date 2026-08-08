import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { useFieldChrome } from '../../utils/field-state';
import { AlRadioGroup } from '../controls/radio-group';
import { AlField } from '../field/field';

@Component({
  selector: 'al-form-radio',
  imports: [AlField, AlRadioGroup, FormField],
  template: `
    @if (field(); as f) {
      <al-field
        [field]="f"
        [label]="element().label"
        [hint]="element().hint"
        [labelHelp]="element().labelHelp"
        [controlId]="controlId()"
        [hideHeader]="!!element().hideHeader"
        [hideFooter]="!!element().hideFooter"
        [submitAttempted]="submitAttempted()">
        <al-radio-group
          [formField]="$any(f)"
          [id]="controlId()"
          [groupName]="controlId()"
          [options]="element().props.options"
          [direction]="element().props.direction ?? 'column'"
          [describedBy]="describedById()" />
      </al-field>
    } @else {
      <al-field [label]="element().label" [hint]="element().hint" />
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormRadio {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'radio' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly chrome = useFieldChrome(
    () => this.field(),
    () => this.element(),
    () => this.controller(),
  );

  protected readonly submitAttempted = this.chrome.submitAttempted;
  protected readonly controlId = this.chrome.controlId;
  protected readonly describedById = this.chrome.describedById;
}
