import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone tag / chip input. Value: `string[]`. */
@Component({
  selector: 'al-tag-input',
  template: `
    <div
      class="al-tag-input"
      [class.al-tag-input--disabled]="disabled()"
      (click)="focusInput()">
      @for (tag of value(); track tag) {
        <span class="al-tag-input__chip">
          {{ tag }}
          @if (!disabled() && !readonly()) {
            <button
              type="button"
              class="al-tag-input__remove"
              aria-label="Remove tag"
              (click)="removeTag($event, tag)">
              ×
            </button>
          }
        </span>
      }
      <input
        #inputRef
        class="al-tag-input__field"
        type="text"
        [id]="id() || null"
        [value]="draft()"
        [attr.placeholder]="value().length ? null : placeholder() ?? null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (input)="onDraft($event)"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-tag-input {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      width: 100%;
      box-sizing: border-box;
      min-height: var(--al-form-control-min-height, 2rem);
      padding: 0.15rem 0.25rem;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
      cursor: text;
    }
    .al-tag-input:focus-within {
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-tag-input--disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .al-tag-input__chip {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      padding: 0.15rem 0.4rem;
      border-radius: 0.25rem;
      background: rgba(0, 0, 0, 0.06);
      font-size: 0.9em;
    }
    .al-tag-input__remove {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0 0.1rem;
      line-height: 1;
      font: inherit;
    }
    .al-tag-input__field {
      flex: 1;
      min-width: 6rem;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: 0.25rem;
    }
    :host.al-control__control .al-tag-input {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
      min-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTagInput implements FormValueControl<string[]> {
  readonly value = model<string[]>([]);
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly maxTags = input<number | undefined>(undefined);
  readonly addOnBlur = input(false);
  readonly separatorKeys = input<readonly string[]>(['Enter', ',']);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected readonly draft = signal('');

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.disabled() || this.readonly()) {
      return;
    }
    const keys = this.separatorKeys();
    if (keys.includes(event.key) || (event.key === ',' && keys.includes(','))) {
      event.preventDefault();
      this.commitDraft();
      return;
    }
    if (event.key === 'Backspace' && !this.draft() && this.value().length) {
      event.preventDefault();
      this.value.set(this.value().slice(0, -1));
    }
  }

  protected onBlur(): void {
    if (this.addOnBlur()) {
      this.commitDraft();
    }
    this.touch.emit();
  }

  protected removeTag(event: Event, tag: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.value.set(this.value().filter((t) => t !== tag));
  }

  protected focusInput(): void {
    // Template ref focus is handled via click on host; browser focuses input when clicked.
  }

  private commitDraft(): void {
    const raw = this.draft().trim();
    this.draft.set('');
    if (!raw) {
      return;
    }
    const current = this.value();
    if (current.includes(raw)) {
      return;
    }
    const max = this.maxTags();
    if (max != null && current.length >= max) {
      return;
    }
    this.value.set([...current, raw]);
  }
}
