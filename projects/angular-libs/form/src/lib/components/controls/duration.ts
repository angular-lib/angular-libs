import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  clampPart,
  clampSeconds,
  formatDurationPart,
  parseDurationString,
  partsToSeconds,
  secondsToParts,
} from '../../utils/duration';

type Segment = 'hh' | 'mm' | 'ss';

/** Standalone duration editor. Value: total seconds (`number | null`). */
@Component({
  selector: 'al-duration',
  template: `
    <div
      class="al-duration"
      role="group"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null"
      [class.al-duration--disabled]="disabled()"
      [class.al-duration--readonly]="readonly()"
      (click)="onContainerClick($event)"
      (wheel)="onContainerWheel($event)"
      (paste)="onPaste($event)">
      <input
        #hhRef
        class="al-duration__seg"
        type="number"
        inputmode="numeric"
        placeholder="hh"
        aria-label="Hours"
        [id]="id() || null"
        [attr.min]="0"
        [attr.max]="maxHours()"
        [step]="stepHh()"
        [value]="displayHh()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (focus)="onFocus($event)"
        (blur)="onBlur()"
        (input)="onSegInput($event, 'hh')"
        (keydown)="onKeyDown($event, 'hh')"
        (wheel)="onSegWheel($event, 'hh')" />
      <span class="al-duration__sep" [class.al-duration__sep--empty]="!hasValue()" aria-hidden="true"
        >:</span
      >
      <input
        #mmRef
        class="al-duration__seg"
        type="number"
        inputmode="numeric"
        placeholder="mm"
        aria-label="Minutes"
        tabindex="-1"
        [attr.min]="0"
        [attr.max]="59"
        [step]="stepMm()"
        [value]="displayMm()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (focus)="onFocus($event)"
        (blur)="onBlur()"
        (input)="onSegInput($event, 'mm')"
        (keydown)="onKeyDown($event, 'mm')"
        (wheel)="onSegWheel($event, 'mm')" />
      @if (showSeconds()) {
        <span
          class="al-duration__sep"
          [class.al-duration__sep--empty]="!hasValue()"
          aria-hidden="true"
          >:</span
        >
        <input
          #ssRef
          class="al-duration__seg"
          type="number"
          inputmode="numeric"
          placeholder="ss"
          aria-label="Seconds"
          tabindex="-1"
          [attr.min]="0"
          [attr.max]="59"
          [step]="stepSs()"
          [value]="displaySs()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          (focus)="onFocus($event)"
          (blur)="onBlur()"
          (input)="onSegInput($event, 'ss')"
          (keydown)="onKeyDown($event, 'ss')"
          (wheel)="onSegWheel($event, 'ss')" />
      }
      @if (hasValue() && !disabled() && !readonly()) {
        <button type="button" class="al-duration__clear" aria-label="Clear" (click)="clear($event)">
          ×
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-duration {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      box-sizing: border-box;
      padding: 0.25rem 0.4rem;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
      width: 100%;
    }
    .al-duration:focus-within {
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-duration--disabled {
      opacity: 0.6;
    }
    .al-duration__seg {
      width: 2.5rem;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      font-variant-numeric: tabular-nums;
      text-align: center;
      padding: 0.2rem 0;
      -moz-appearance: textfield;
    }
    .al-duration__seg::-webkit-outer-spin-button,
    .al-duration__seg::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .al-duration__sep {
      opacity: 0.85;
      user-select: none;
    }
    .al-duration__sep--empty {
      opacity: 0.4;
    }
    .al-duration__clear {
      margin-inline-start: auto;
      border: 0;
      background: transparent;
      cursor: pointer;
      font: inherit;
      line-height: 1;
      padding: 0.15rem 0.35rem;
      opacity: 0.7;
    }
    :host.al-control__control .al-duration {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlDuration implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly touch = output<void>();
  readonly id = input('');
  readonly stepHh = input(1);
  readonly stepMm = input(1);
  readonly stepSs = input(1);
  readonly showSeconds = input(true);
  readonly maxHours = input(99);
  readonly minSeconds = input<number | undefined>(undefined);
  readonly maxSeconds = input<number | undefined>(undefined);
  readonly wheel = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  private readonly hhRef = viewChild<ElementRef<HTMLInputElement>>('hhRef');
  private readonly mmRef = viewChild<ElementRef<HTMLInputElement>>('mmRef');
  private readonly ssRef = viewChild<ElementRef<HTMLInputElement>>('ssRef');

  protected readonly hasValue = computed(() => this.value() != null);

  protected readonly parts = computed(() => secondsToParts(this.value()));

  protected displayHh(): string {
    const p = this.parts();
    return p ? formatDurationPart(p.h) : '';
  }

  protected displayMm(): string {
    const p = this.parts();
    return p ? formatDurationPart(p.m) : '';
  }

  protected displaySs(): string {
    const p = this.parts();
    return p ? formatDurationPart(p.s) : '';
  }

  protected onFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected onBlur(): void {
    this.touch.emit();
  }

  protected clear(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.value.set(null);
    this.touch.emit();
  }

  protected onContainerClick(event: Event): void {
    const t = event.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'BUTTON') {
      return;
    }
    (this.showSeconds() ? this.ssRef() : this.mmRef())?.nativeElement.focus();
  }

  protected onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const parsed = parseDurationString(text);
    if (parsed == null) {
      return;
    }
    event.preventDefault();
    this.commitSeconds(parsed);
  }

  protected onSegInput(event: Event, seg: Segment): void {
    if (this.readonly()) {
      return;
    }
    const el = event.target as HTMLInputElement;
    const originalLength = el.value.length;
    const max = seg === 'hh' ? this.maxHours() : 59;
    let n = parseInt(el.value, 10);
    if (!Number.isFinite(n)) {
      n = 0;
    }
    n = clampPart(n, 0, max);
    el.value = formatDurationPart(n);
    const p = this.parts() ?? { h: 0, m: 0, s: 0 };
    if (seg === 'hh') {
      this.commitSeconds(partsToSeconds(n, p.m, this.showSeconds() ? p.s : 0));
    } else if (seg === 'mm') {
      this.commitSeconds(partsToSeconds(p.h, n, this.showSeconds() ? p.s : 0));
    } else {
      this.commitSeconds(partsToSeconds(p.h, p.m, n));
    }
    if (originalLength >= 2) {
      this.focusNext(seg);
    }
  }

  protected onKeyDown(event: KeyboardEvent, seg: Segment): void {
    if (this.readonly() || this.disabled()) {
      return;
    }
    const step = this.stepFor(seg);
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.adjust(seg, step);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.adjust(seg, -step);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusNext(seg);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusPrev(seg);
    }
  }

  protected onSegWheel(event: WheelEvent, seg: Segment): void {
    if (!this.wheel() || this.readonly() || this.disabled()) {
      return;
    }
    event.preventDefault();
    const step = event.deltaY < 0 ? this.stepFor(seg) : -this.stepFor(seg);
    this.adjust(seg, step);
  }

  protected onContainerWheel(event: WheelEvent): void {
    if (!this.wheel() || this.readonly() || this.disabled()) {
      return;
    }
    const t = event.target as HTMLElement;
    if (t.tagName === 'INPUT') {
      return;
    }
    event.preventDefault();
    const seg: Segment = this.showSeconds() ? 'ss' : 'mm';
    const step = event.deltaY < 0 ? this.stepFor(seg) : -this.stepFor(seg);
    this.adjust(seg, step);
  }

  private stepFor(seg: Segment): number {
    if (seg === 'hh') {
      return this.stepHh();
    }
    if (seg === 'mm') {
      return this.stepMm();
    }
    return this.stepSs();
  }

  private adjust(seg: Segment, step: number): void {
    const mult = seg === 'hh' ? 3600 : seg === 'mm' ? 60 : 1;
    const current = this.value() ?? 0;
    this.commitSeconds(current + step * mult);
  }

  private commitSeconds(seconds: number): void {
    const clamped = clampSeconds(seconds, this.minSeconds(), this.maxSeconds());
    const maxH = this.maxHours();
    const maxTotal = maxH * 3600 + 59 * 60 + (this.showSeconds() ? 59 : 0);
    this.value.set(Math.min(clamped, maxTotal));
  }

  private focusNext(seg: Segment): void {
    if (seg === 'hh') {
      this.mmRef()?.nativeElement.focus();
    } else if (seg === 'mm' && this.showSeconds()) {
      this.ssRef()?.nativeElement.focus();
    }
  }

  private focusPrev(seg: Segment): void {
    if (seg === 'ss') {
      this.mmRef()?.nativeElement.focus();
    } else if (seg === 'mm') {
      this.hhRef()?.nativeElement.focus();
    }
  }
}
