import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { FormController } from '../../create-form';
import type { FormElement, FormElementConfig } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { FORM_FIELD_REGISTRY } from '../../registry/provide-form-fields';
import { resolveFormField, trackFormElement, unwrapFormElement, unwrapMaybeSignal } from '../../utils/resolve-field';
import { AlFormItem } from './form-item';

/**
 * Renders form items only — no flex. Parent owns layout (`display: contents`
 * so items participate in the parent's flex formatting context).
 */
@Component({
  selector: 'al-form-element-list',
  imports: [NgComponentOutlet, AlFormItem],
  template: `
    @for (item of elements(); track trackElement($index, item)) {
      @let el = unwrap(item);
      @if (!isHidden(el)) {
        <al-form-item [element]="el">
          @if (resolveComponent(el); as Comp) {
            <ng-container
              [ngComponentOutlet]="Comp"
              [ngComponentOutletInputs]="{
                field: fieldFor(el),
                element: el,
                form: form(),
                controller: controller(),
              }" />
          }
        </al-form-item>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormElementList {
  readonly form = input.required<FormUiFieldTree>();
  readonly elements = input.required<readonly FormElementConfig[]>();
  readonly controller = input<FormController | null>(null);

  private readonly registry = inject(FORM_FIELD_REGISTRY);

  protected trackElement = trackFormElement;
  protected unwrap = unwrapFormElement;

  protected isHidden(el: FormElement): boolean {
    const hide = el.hide;
    if (hide == null) {
      return false;
    }
    return !!unwrapMaybeSignal(hide);
  }

  protected fieldFor(el: FormElement): FormUiFieldTree | null {
    return resolveFormField(this.form(), el.path as string | undefined) as FormUiFieldTree | null;
  }

  protected resolveComponent(el: FormElement) {
    if (el.type === 'custom') {
      return el.props.component;
    }
    return this.registry.resolve(el.type);
  }
}
