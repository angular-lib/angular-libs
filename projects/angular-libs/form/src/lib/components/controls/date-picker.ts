import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  DEFAULT_MONTHS,
  DEFAULT_WEEKDAYS,
  todayLocal,
} from '../../utils/date-time';
import { AlIconCalendar } from '../icons/picker-icons';
import { AlCalendarGrid } from '../pickers/calendar-grid';
import { AlPickerShell } from '../pickers/picker-shell';

let nextAnchor = 0;

/** Standalone date control. Value: `yyyy-MM-dd` or `''`. */
@Component({
  selector: 'al-date-picker',
  imports: [AlPickerShell, AlCalendarGrid, AlIconCalendar],
  template: `
    <al-picker-shell
      #shell
      inputType="date"
      [anchorName]="resolvedAnchor()"
      [(value)]="value"
      (touch)="touch.emit()"
      [min]="rangeMin()"
      [max]="rangeMax()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [id]="id()"
      [placeholder]="placeholder()"
      [invalid]="invalid()"
      [describedBy]="describedBy()"
      trailLabel="Open calendar"
      (opened)="onOpened()">
      <al-icon-calendar alPickerTrail />
      @if (shell.hasEverOpened()) {
        <al-calendar-grid
          #calendar
          [value]="value()"
          [min]="rangeMin()"
          [max]="rangeMax()"
          [disabledDates]="disabledDates()"
          [firstDayOfWeek]="firstDayOfWeek()"
          [months]="months()"
          [weekdays]="weekdays()"
          [showWeekNumbers]="showWeekNumbers()"
          (valueChange)="value.set($event || '')"
          (valuePicked)="onDatePicked($event)" />
        <div class="al-picker-actions">
          <button type="button" (click)="clearAndClose()">{{ clearText() }}</button>
          <button type="button" (click)="setToday()">{{ todayText() }}</button>
        </div>
      }
    </al-picker-shell>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlDatePicker implements FormValueControl<string> {
  private readonly defaultAnchor = `--al-date-${++nextAnchor}`;

  readonly value = model<string>('');
  readonly touch = output<void>();

  readonly anchorName = input<string | undefined>(undefined);
  readonly rangeMin = input('1900-01-01');
  readonly rangeMax = input('2100-12-31');
  readonly disabledDates = input<readonly string[]>([]);
  readonly firstDayOfWeek = input(1);
  readonly months = input<readonly string[]>(DEFAULT_MONTHS);
  readonly weekdays = input<readonly string[]>(DEFAULT_WEEKDAYS);
  readonly showWeekNumbers = input(true);
  readonly clearText = input('Clear');
  readonly todayText = input('Today');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly invalid = input(false);
  readonly describedBy = input('');

  private readonly shell = viewChild(AlPickerShell);
  private readonly calendar = viewChild(AlCalendarGrid);

  protected readonly resolvedAnchor = computed(() => this.anchorName() || this.defaultAnchor);

  protected onDatePicked(v: string): void {
    this.value.set(v);
    this.shell()?.close();
  }

  protected setToday(): void {
    this.value.set(todayLocal());
    this.touch.emit();
    this.shell()?.close();
  }

  protected clearAndClose(): void {
    this.value.set('');
    this.touch.emit();
    this.shell()?.close();
  }

  protected onOpened(): void {
    requestAnimationFrame(() => this.calendar()?.focusSelectedDay());
  }
}
