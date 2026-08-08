import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone file input. Value: `File | File[] | null`. */
@Component({
  selector: 'al-file-input',
  template: `
    <div class="al-file-input">
      <input
        #inputRef
        class="al-file-input__native"
        type="file"
        [id]="id() || null"
        [attr.accept]="accept() ?? null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [multiple]="multiple()"
        [disabled]="disabled()"
        (change)="onChange($event)"
        (blur)="touch.emit()" />
      @if (fileNames().length) {
        <ul class="al-file-input__list">
          @for (name of fileNames(); track name) {
            <li>{{ name }}</li>
          }
        </ul>
      } @else {
        <span class="al-file-input__empty">No file selected</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-file-input {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
    }
    .al-file-input__native {
      font: inherit;
      max-width: 100%;
    }
    .al-file-input__list {
      margin: 0;
      padding-inline-start: 1.1rem;
      font-size: 0.9em;
    }
    .al-file-input__empty {
      opacity: 0.65;
      font-size: 0.9em;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFileInput implements FormValueControl<File | File[] | null> {
  readonly value = model<File | File[] | null>(null);
  readonly touch = output<void>();
  readonly id = input('');
  readonly multiple = input(false);
  readonly accept = input<string | undefined>(undefined);
  readonly maxFiles = input<number | undefined>(undefined);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected readonly fileNames = computed(() => {
    const v = this.value();
    if (!v) {
      return [] as string[];
    }
    const list = Array.isArray(v) ? v : [v];
    return list.map((f) => f.name);
  });

  protected onChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = inputEl.files ? Array.from(inputEl.files) : [];
    if (!files.length) {
      this.value.set(this.multiple() ? [] : null);
      return;
    }
    const max = this.maxFiles();
    const limited = max != null && max > 0 ? files.slice(0, max) : files;
    if (this.multiple()) {
      this.value.set(limited);
    } else {
      this.value.set(limited[0] ?? null);
    }
  }
}
