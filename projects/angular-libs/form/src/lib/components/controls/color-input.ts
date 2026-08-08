import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone color input. Value: `#rrggbb` string. */
@Component({
  selector: 'al-color-input',
  template: `
    <div class="al-color-input">
      <input
        #swatchRef
        class="al-color-input__swatch"
        type="color"
        [id]="id() || null"
        [value]="normalized()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        (input)="onSwatch($event)"
        (blur)="touch.emit()" />
      @if (showHex()) {
        <input
          class="al-color-input__hex"
          type="text"
          spellcheck="false"
          [value]="value()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          (input)="onHex($event)"
          (blur)="onHexBlur($event)" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-color-input {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }
    .al-color-input__swatch {
      width: 2rem;
      height: var(--al-form-control-min-height, 2rem);
      padding: 0;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: transparent;
      cursor: pointer;
    }
    .al-color-input__hex {
      flex: 1;
      min-width: 0;
      font: inherit;
      font-family: ui-monospace, monospace;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.35rem);
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      outline: none;
    }
    .al-color-input__hex:focus {
      border-color: var(--al-form-focus, #ea580c);
    }
    :host.al-control__control .al-color-input__hex {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding-inline: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlColorInput implements FormValueControl<string> {
  readonly value = model('#000000');
  readonly touch = output<void>();
  readonly id = input('');
  readonly showHex = input(true);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected normalized(): string {
    const v = this.value().trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
  }

  protected onSwatch(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onHex(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onHexBlur(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    let hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      this.value.set(hex.toLowerCase());
    } else {
      this.value.set(this.normalized());
    }
    this.touch.emit();
  }
}
