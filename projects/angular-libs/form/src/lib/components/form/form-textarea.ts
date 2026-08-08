import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { useFieldChrome } from '../../utils/field-state';
import { AlTextarea } from '../controls/textarea';
import { AlField } from '../field/field';

@Component({
  selector: 'al-form-textarea',
  imports: [AlField, AlTextarea, FormField],
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
        [meta]="charMeta()"
        [submitAttempted]="submitAttempted()">
        <al-textarea
          [formField]="$any(f)"
          [id]="controlId()"
          [placeholder]="element().props?.placeholder"
          [rows]="element().props?.rows ?? 3"
          [charMax]="element().props?.maxLength"
          [autoGrow]="!!element().props?.autoGrow"
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
export class AlFormTextarea {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'textarea' }>();
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

  protected readonly charMeta = computed(() => {
    const max = this.element().props?.maxLength;
    if (max == null) {
      return null;
    }
    const len = String(this.field()?.()?.value() ?? '').length;
    return `${len}/${max}`;
  });
}
