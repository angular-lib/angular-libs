import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import {
  DEFAULT_MONTHS,
  DEFAULT_WEEKDAYS,
  buildHourItems,
  buildMinuteItems,
  datePartOf,
  normalizeDateTime,
  pad2,
  parseDateTime,
  parseTime,
  timePartOf,
  todayLocal,
  toDateTimeString,
} from '../../utils/date-time';
import { AlFieldShell } from '../field-shell/field-shell';
import { AlIconCalendar } from '../icons/picker-icons';
import { AlCalendarGrid } from '../pickers/calendar-grid';
import { AlItemList } from '../pickers/item-list';
import type { AlListItemValue } from '../pickers/item-list';
import { PICKER_PANEL_STYLES } from '../pickers/picker-styles';

let nextDateTimeAnchor = 0;

@Component({
  selector: 'al-datetime-field',
  imports: [AlFieldShell, AlCalendarGrid, AlItemList, AlIconCalendar],
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
          type="datetime-local"
          [id]="af.controlId()"
          [value]="displayValue()"
          [attr.min]="props().min ?? null"
          [attr.max]="props().max ?? null"
          [attr.step]="minuteStepSeconds()"
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
        aria-label="Open date and time picker"
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
        <div class="al-picker-datetime">
          <al-calendar-grid
            #calendar
            [value]="stagedDate()"
            [min]="calendarMin()"
            [max]="calendarMax()"
            [disabledDates]="props().disabledDates ?? []"
            [firstDayOfWeek]="props().firstDayOfWeek ?? 1"
            [months]="props().months ?? months"
            [weekdays]="props().weekdays ?? weekdays"
            [showWeekNumbers]="props().showWeekNumbers ?? false"
            (valueChange)="onDateChange($event)"
            (cellKeyDown)="onCalendarCellKey($event)" />
          <div class="al-picker-time">
            <al-item-list
              #hourList
              [items]="hourItems()"
              [value]="stagedHh()"
              ariaLabel="Hours"
              (valueChange)="onHourChange($event)"
              (itemSelected)="onHourSelected()" />
            <al-item-list
              #minuteList
              [items]="minuteItems()"
              [value]="stagedMm()"
              ariaLabel="Minutes"
              (valueChange)="onMinuteChange($event)" />
          </div>
        </div>
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
export class AlDateTimeField {
  protected readonly fieldAnchor = `--al-dt-${++nextDateTimeAnchor}`;
  protected readonly months = DEFAULT_MONTHS;
  protected readonly weekdays = DEFAULT_WEEKDAYS;

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'datetime' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRef');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');
  private readonly calendar = viewChild(AlCalendarGrid);
  private readonly hourList = viewChild('hourList', { read: AlItemList });
  private readonly minuteList = viewChild('minuteList', { read: AlItemList });
  private readonly lists = viewChildren(AlItemList);

  protected readonly hasEverOpened = signal(false);
  protected readonly stagedDate = signal('');
  protected readonly stagedHh = signal<string | null>(null);
  protected readonly stagedMm = signal<string | null>(null);

  protected readonly props = computed(() => this.element().props ?? {});

  protected readonly displayValue = computed(() => {
    const v = this.field()?.()?.value();
    return normalizeDateTime(typeof v === 'string' ? v : v == null ? '' : String(v));
  });

  protected readonly hasValue = computed(() => this.displayValue().length > 0);

  protected readonly calendarMin = computed(() => datePartOf(this.props().min) || '1900-01-01');
  protected readonly calendarMax = computed(() => datePartOf(this.props().max) || '2100-12-31');

  protected readonly hourItems = computed(() => {
    const date = this.stagedDate() || todayLocal();
    return buildHourItems(
      this.timeBoundForDate(date, this.props().min, 'min'),
      this.timeBoundForDate(date, this.props().max, 'max'),
    );
  });

  protected readonly minuteItems = computed(() => {
    const date = this.stagedDate() || todayLocal();
    return buildMinuteItems(
      this.stagedHh(),
      this.timeBoundForDate(date, this.props().min, 'min'),
      this.timeBoundForDate(date, this.props().max, 'max'),
      this.minuteStep(),
    );
  });

  protected minuteStep(): number {
    const step = this.props().step;
    if (step == null) {
      return 1;
    }
    const n = typeof step === 'string' ? Number(step) : step;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  protected readonly minuteStepSeconds = computed(() => this.minuteStep() * 60);

  protected onNativeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.writeValue(normalizeDateTime(el.value));
  }

  protected onDateChange(value: string): void {
    this.stagedDate.set(value || '');
    this.commitStaged();
  }

  protected onHourChange(value: AlListItemValue | null): void {
    if (typeof value !== 'string') {
      return;
    }
    this.stagedHh.set(value);
    this.commitStaged();
  }

  protected onMinuteChange(value: AlListItemValue | null): void {
    if (typeof value !== 'string') {
      return;
    }
    this.stagedMm.set(value);
    this.commitStaged();
  }

  protected onHourSelected(): void {
    this.minuteList()?.focusList();
    this.minuteList()?.scrollToSelected();
  }

  protected onCalendarCellKey(payload: { event: KeyboardEvent }): void {
    if (payload.event.key === 'Enter') {
      this.hidePopover();
    }
  }

  protected setToday(): void {
    const now = new Date();
    this.stagedDate.set(todayLocal());
    this.stagedHh.set(pad2(now.getHours()));
    this.stagedMm.set(pad2(now.getMinutes()));
    this.writeValue(toDateTimeString(now));
    this.hidePopover();
  }

  protected clearAndClose(): void {
    this.writeValue('');
    this.stagedDate.set('');
    this.stagedHh.set(null);
    this.stagedMm.set(null);
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
    this.seedStage();
    this.hasEverOpened.set(true);
    if (!panel.matches(':popover-open')) {
      panel.showPopover();
    }
    requestAnimationFrame(() => {
      this.calendar()?.focusSelectedDay();
      this.lists().forEach((list) => list.scrollToSelected());
    });
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
      this.seedStage();
      requestAnimationFrame(() => {
        this.calendar()?.focusSelectedDay();
        this.lists().forEach((list) => list.scrollToSelected());
      });
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.openPicker();
    } else if (event.key === 'Escape') {
      this.hidePopover();
    } else if (event.key === 'Enter') {
      this.hidePopover();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.hidePopover();
      this.inputRef()?.nativeElement.focus();
    } else if (event.key === 'Enter') {
      this.hidePopover();
      this.inputRef()?.nativeElement.focus();
    }
  }

  protected markTouched(): void {
    this.field()?.()?.markAsTouched();
  }

  private seedStage(): void {
    const current = this.displayValue();
    const d = parseDateTime(current);
    this.stagedDate.set(datePartOf(current) || todayLocal());
    if (d) {
      this.stagedHh.set(pad2(d.getHours()));
      this.stagedMm.set(pad2(d.getMinutes()));
    } else {
      this.stagedHh.set('00');
      this.stagedMm.set('00');
    }
  }

  private commitStaged(): void {
    const date = this.stagedDate() || todayLocal();
    const hh = this.stagedHh() ?? '00';
    const mm = this.stagedMm() ?? '00';
    this.writeValue(`${date}T${hh}:${mm}`);
  }

  /** Constrain HH:mm only on the min/max calendar day; other days use full day. */
  private timeBoundForDate(
    date: string,
    bound: string | undefined,
    kind: 'min' | 'max',
  ): string {
    const fallback = kind === 'min' ? '00:00' : '23:59';
    if (!bound) {
      return fallback;
    }
    const boundDate = datePartOf(bound);
    if (!boundDate) {
      const t = parseTime(bound);
      return t ? `${pad2(t.hours)}:${pad2(t.minutes)}` : fallback;
    }
    if (date !== boundDate) {
      return fallback;
    }
    return timePartOf(bound) || fallback;
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
