import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { useFieldChrome } from '../../utils/field-state';
import { AlSwitch } from '../controls/switch';
import { AlField } from '../field/field';

@Component({
  selector: 'al-form-switch',
  imports: [AlField, AlSwitch, FormField],
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
        <al-switch
          [formField]="$any(f)"
          [id]="controlId()"
          [label]="element().props?.switchLabel"
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
export class AlFormSwitch {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'switch' }>();
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
