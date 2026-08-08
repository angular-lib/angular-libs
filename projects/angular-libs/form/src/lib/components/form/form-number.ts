import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormFieldActionContext } from '../../field-action';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlNumberInput } from '../controls/number-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-number',
  imports: [AlFieldShell, AlNumberInput, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="null"
      (clear)="onClear($event)">
      @if (leadText()) {
        <span alControlLead class="al-lead">{{ leadText() }}</span>
      }
      @if (field(); as f) {
        <al-number-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [placeholder]="element().props?.placeholder"
          [step]="element().props?.step"
          [describedBy]="af.describedById()"
          (composingChange)="af.setComposing($event)" />
      }
      @if (trailText()) {
        @if (element().props?.trailAction) {
          <button
            type="button"
            alControlTrail
            class="al-trail-btn"
            [disabled]="af.disabled() || af.readonly()"
            (click)="onTrail($event)">
            {{ trailText() }}
          </button>
        } @else {
          <span alControlTrail class="al-trail">{{ trailText() }}</span>
        }
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
export class AlFormNumber {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'number' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly leadText = computed(() => this.element().props?.lead ?? null);
  protected readonly trailText = computed(() => this.element().props?.trail ?? null);

  protected onClear(event: Event): void {
    this.element().props?.onClear?.(this.ctx(event));
  }

  protected onTrail(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.element().props?.onTrail?.(this.ctx(event));
  }

  private ctx(event: Event): FormFieldActionContext {
    return {
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    };
  }
}
