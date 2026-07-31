import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { useFieldChrome } from '../../utils/field-state';
import { AlField } from '../field/field';

@Component({
  selector: 'al-textarea-field',
  imports: [AlField, FormField],
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
        <textarea
          #inputRef
          [id]="controlId()"
          [formField]="$any(f)"
          [attr.placeholder]="element().props?.placeholder ?? null"
          [attr.rows]="element().props?.rows ?? 3"
          [attr.aria-invalid]="invalid() || null"
          [attr.aria-describedby]="describedById()"
          class="al-textarea"
          [class.al-textarea--auto]="!!element().props?.autoGrow"></textarea>
      </al-field>
    } @else {
      <al-field [label]="element().label" [hint]="element().hint" />
    }
  `,
  styles: `
    .al-textarea {
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      padding: 0.4rem 0.5rem;
      border: 1px solid #c4c4c4;
      border-radius: 0.25rem;
      resize: vertical;
      min-height: 4rem;
    }
    .al-textarea--auto {
      resize: none;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTextareaField {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'textarea' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('inputRef');

  private readonly chrome = useFieldChrome(
    () => this.field(),
    () => this.element(),
    () => this.controller(),
  );

  protected readonly invalid = this.chrome.invalid;
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

  constructor() {
    afterRenderEffect(() => {
      const el = this.area()?.nativeElement;
      if (!el) {
        return;
      }
      const max = this.element().props?.maxLength;
      if (max != null) {
        el.maxLength = max;
      } else {
        el.removeAttribute('maxLength');
      }
      if (!this.element().props?.autoGrow) {
        return;
      }
      void this.field()?.()?.value();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
  }
}
