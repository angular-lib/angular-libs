import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone textarea. Value: string. */
@Component({
  selector: 'al-textarea',
  template: `
    <textarea
      #inputRef
      class="al-textarea"
      [class.al-textarea--auto]="autoGrow()"
      [id]="id() || null"
      [value]="value()"
      [attr.placeholder]="placeholder() ?? null"
      [attr.rows]="rows()"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      (input)="onInput($event)"
      (blur)="touch.emit()"></textarea>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-textarea {
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      padding: 0.3rem 0.4rem;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      resize: vertical;
      min-height: 3.25rem;
      outline: none;
      background: #fff;
    }
    .al-textarea:focus {
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-textarea[aria-invalid='true'] {
      border-color: var(--al-form-invalid, #b00020);
    }
    .al-textarea--auto {
      resize: none;
      overflow: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTextarea implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly rows = input(3);
  readonly charMax = input<number | undefined>(undefined);
  readonly autoGrow = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  private readonly area = viewChild<ElementRef<HTMLTextAreaElement>>('inputRef');

  constructor() {
    afterRenderEffect(() => {
      const el = this.area()?.nativeElement;
      if (!el) {
        return;
      }
      const max = this.charMax();
      if (max != null) {
        el.maxLength = max;
      } else {
        el.removeAttribute('maxLength');
      }
      if (!this.autoGrow()) {
        return;
      }
      void this.value();
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    });
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLTextAreaElement).value);
  }
}
