import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import {
  DEFAULT_MONTHS,
  DEFAULT_WEEKDAYS,
  todayLocal,
} from '../../utils/date-time';
import { AlFieldShell } from '../field-shell/field-shell';
import { AlIconCalendar } from '../icons/picker-icons';
import { AlCalendarGrid } from '../pickers/calendar-grid';
import { PICKER_PANEL_STYLES } from '../pickers/picker-styles';

let nextDateAnchor = 0;

@Component({
  selector: 'al-date-field',
  imports: [AlFieldShell, AlCalendarGrid, AlIconCalendar],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="''"
      [clearableOverride]="true"
      [controlAnchor]="fieldAnchor"
      [hasValue]="hasValue()"
      (clear)="onShellClear($event)">
      @if (field(); as f) {
        <input
          #inputRef
          class="al-picker-input"
          type="date"
          [id]="af.controlId()"
          [value]="displayValue()"
          [attr.min]="props().min ?? '1900-01-01'"
          [attr.max]="props().max ?? '2100-12-31'"
          [attr.placeholder]="props().placeholder ?? null"
          [attr.aria-invalid]="af.invalid() || null"
          [attr.aria-describedby]="af.describedById()"
          [disabled]="af.disabled()"
          [readOnly]="af.readonly()"
          (input)="onNativeInput($event)"
          (blur)="markTouched()"
          (keydown)="onInputKeydown($event)" />
      }
      <button
        type="button"
        alControlTrail
        class="al-trail-btn"
        aria-label="Open calendar"
        [disabled]="af.disabled() || af.readonly()"
        (click)="openPicker($event)">
        <al-icon-calendar />
      </button>
    </al-field-shell>

    <div
      #panelRef
      class="al-picker-panel"
      popover="auto"
      [style.position-anchor]="fieldAnchor"
      (toggle)="onPopoverToggle($event)"
      (keydown)="onPanelKeydown($event)">
      @if (hasEverOpened()) {
        <al-calendar-grid
          #calendar
          [value]="displayValue()"
          [min]="props().min ?? '1900-01-01'"
          [max]="props().max ?? '2100-12-31'"
          [disabledDates]="props().disabledDates ?? []"
          [firstDayOfWeek]="props().firstDayOfWeek ?? 1"
          [months]="props().months ?? months"
          [weekdays]="props().weekdays ?? weekdays"
          [showWeekNumbers]="props().showWeekNumbers ?? true"
          (valueChange)="onCalendarValue($event)"
          (valuePicked)="onDatePicked($event)" />
        <div class="al-picker-actions">
          <button type="button" (click)="clearAndClose()">{{ props().clearText ?? 'Clear' }}</button>
          <button type="button" (click)="setToday()">{{ props().todayText ?? 'Today' }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      position: relative;
    }
    ${PICKER_PANEL_STYLES}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlDateField {
  protected readonly fieldAnchor = `--al-date-${++nextDateAnchor}`;
  protected readonly months = DEFAULT_MONTHS;
  protected readonly weekdays = DEFAULT_WEEKDAYS;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'date' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRef');
  private readonly calendar = viewChild(AlCalendarGrid);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');

  protected readonly hasEverOpened = signal(false);

  protected readonly props = computed(() => this.element().props ?? {});

  protected readonly displayValue = computed(() => {
    const v = this.field()?.()?.value();
    return typeof v === 'string' ? v : v == null ? '' : String(v);
  });

  protected readonly hasValue = computed(() => this.displayValue().length > 0);

  protected onNativeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.writeValue(el.value || '');
  }

  protected onCalendarValue(value: string): void {
    this.writeValue(value || '');
  }

  protected onDatePicked(value: string): void {
    this.writeValue(value);
    this.hidePopover();
  }

  protected setToday(): void {
    this.writeValue(todayLocal());
    this.hidePopover();
  }

  protected clearAndClose(): void {
    this.writeValue('');
    this.hidePopover();
  }

  protected onShellClear(event: Event): void {
    event.stopPropagation();
    this.writeValue('');
    this.props().onClear?.({
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    });
  }

  protected openPicker(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const state = this.field()?.();
    if (state?.disabled() || state?.readonly()) {
      return;
    }
    const panel = this.panelRef()?.nativeElement;
    if (!panel) {
      return;
    }
    this.hasEverOpened.set(true);
    if (!panel.matches(':popover-open')) {
      panel.showPopover();
    }
    requestAnimationFrame(() => this.calendar()?.focusSelectedDay());
  }

  protected hidePopover(): void {
    const panel = this.panelRef()?.nativeElement;
    if (panel?.matches(':popover-open')) {
      panel.hidePopover();
    }
  }

  protected onPopoverToggle(event: Event): void {
    const e = event as ToggleEvent;
    if (e.newState === 'open') {
      this.hasEverOpened.set(true);
      requestAnimationFrame(() => this.calendar()?.focusSelectedDay());
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.openPicker();
    } else if (event.key === 'Escape') {
      this.hidePopover();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.hidePopover();
      this.inputRef()?.nativeElement.focus();
    }
  }

  protected markTouched(): void {
    this.field()?.()?.markAsTouched();
  }

  private writeValue(value: string): void {
    const state = this.field()?.();
    if (!state || state.disabled()) {
      return;
    }
    state.value.set(value as never);
    state.markAsDirty();
    state.markAsTouched();
  }
}
