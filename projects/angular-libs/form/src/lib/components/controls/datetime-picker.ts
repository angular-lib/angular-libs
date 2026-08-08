import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
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
import { AlIconCalendar } from '../icons/picker-icons';
import { AlCalendarGrid } from '../pickers/calendar-grid';
import { AlItemList } from '../pickers/item-list';
import type { AlListItemValue } from '../pickers/item-list';
import { AlPickerShell } from '../pickers/picker-shell';

let nextAnchor = 0;

/** Standalone datetime control. Value: `yyyy-MM-ddTHH:mm` or `''`. */
@Component({
  selector: 'al-datetime-picker',
  imports: [AlPickerShell, AlCalendarGrid, AlItemList, AlIconCalendar],
  template: `
    <al-picker-shell
      #shell
      inputType="datetime-local"
      [anchorName]="resolvedAnchor()"
      [value]="value()"
      (valueChange)="onNativeValue($event)"
      (touch)="touch.emit()"
      [min]="rangeMin()"
      [max]="rangeMax()"
      [step]="minuteStepSeconds()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [id]="id()"
      [placeholder]="placeholder()"
      [invalid]="invalid()"
      [describedBy]="describedBy()"
      trailLabel="Open date and time picker"
      [closeOnEnter]="true"
      (opened)="onOpened()">
      <al-icon-calendar alPickerTrail />
      @if (shell.hasEverOpened()) {
        <div class="al-picker-datetime">
          <al-calendar-grid
            #calendar
            [value]="stagedDate()"
            [min]="calendarMin()"
            [max]="calendarMax()"
            [disabledDates]="disabledDates()"
            [firstDayOfWeek]="firstDayOfWeek()"
            [months]="months()"
            [weekdays]="weekdays()"
            [showWeekNumbers]="showWeekNumbers()"
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
export class AlDateTimePicker implements FormValueControl<string> {
  private readonly defaultAnchor = `--al-dt-${++nextAnchor}`;

  readonly value = model<string>('');
  readonly touch = output<void>();

  readonly anchorName = input<string | undefined>(undefined);
  readonly rangeMin = input<string | undefined>(undefined);
  readonly rangeMax = input<string | undefined>(undefined);
  readonly disabledDates = input<readonly string[]>([]);
  readonly firstDayOfWeek = input(1);
  readonly months = input<readonly string[]>(DEFAULT_MONTHS);
  readonly weekdays = input<readonly string[]>(DEFAULT_WEEKDAYS);
  readonly showWeekNumbers = input(false);
  readonly clearText = input('Clear');
  readonly todayText = input('Today');
  readonly step = input<number | string>(1);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly invalid = input(false);
  readonly describedBy = input('');

  private readonly shell = viewChild(AlPickerShell);
  private readonly calendar = viewChild(AlCalendarGrid);
  private readonly hourList = viewChild('hourList', { read: AlItemList });
  private readonly minuteList = viewChild('minuteList', { read: AlItemList });
  private readonly lists = viewChildren(AlItemList);

  protected readonly stagedDate = signal('');
  protected readonly stagedHh = signal<string | null>(null);
  protected readonly stagedMm = signal<string | null>(null);

  protected readonly resolvedAnchor = computed(() => this.anchorName() || this.defaultAnchor);
  protected readonly calendarMin = computed(() => datePartOf(this.rangeMin()) || '1900-01-01');
  protected readonly calendarMax = computed(() => datePartOf(this.rangeMax()) || '2100-12-31');

  protected readonly hourItems = computed(() => {
    const date = this.stagedDate() || todayLocal();
    return buildHourItems(
      this.timeBoundForDate(date, this.rangeMin(), 'min'),
      this.timeBoundForDate(date, this.rangeMax(), 'max'),
    );
  });

  protected readonly minuteItems = computed(() => {
    const date = this.stagedDate() || todayLocal();
    return buildMinuteItems(
      this.stagedHh(),
      this.timeBoundForDate(date, this.rangeMin(), 'min'),
      this.timeBoundForDate(date, this.rangeMax(), 'max'),
      this.minuteStep(),
    );
  });

  protected minuteStep(): number {
    const step = this.step();
    const n = typeof step === 'string' ? Number(step) : step;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  protected readonly minuteStepSeconds = computed(() => this.minuteStep() * 60);

  protected onNativeValue(raw: string): void {
    this.value.set(normalizeDateTime(raw));
  }

  protected onDateChange(v: string): void {
    this.stagedDate.set(v || '');
    this.commit();
  }

  protected onHourChange(v: AlListItemValue | null): void {
    if (typeof v !== 'string') {
      return;
    }
    this.stagedHh.set(v);
    this.commit();
  }

  protected onMinuteChange(v: AlListItemValue | null): void {
    if (typeof v !== 'string') {
      return;
    }
    this.stagedMm.set(v);
    this.commit();
  }

  protected onHourSelected(): void {
    this.minuteList()?.focusList();
    this.minuteList()?.scrollToSelected();
  }

  protected onCalendarCellKey(payload: { event: KeyboardEvent }): void {
    if (payload.event.key === 'Enter') {
      this.shell()?.close();
    }
  }

  protected setToday(): void {
    const now = new Date();
    this.stagedDate.set(todayLocal());
    this.stagedHh.set(pad2(now.getHours()));
    this.stagedMm.set(pad2(now.getMinutes()));
    this.value.set(toDateTimeString(now));
    this.touch.emit();
    this.shell()?.close();
  }

  protected clearAndClose(): void {
    this.value.set('');
    this.stagedDate.set('');
    this.stagedHh.set(null);
    this.stagedMm.set(null);
    this.touch.emit();
    this.shell()?.close();
  }

  protected onOpened(): void {
    const current = this.value();
    const d = parseDateTime(current);
    this.stagedDate.set(datePartOf(current) || todayLocal());
    if (d) {
      this.stagedHh.set(pad2(d.getHours()));
      this.stagedMm.set(pad2(d.getMinutes()));
    } else {
      this.stagedHh.set('00');
      this.stagedMm.set('00');
    }
    requestAnimationFrame(() => {
      this.calendar()?.focusSelectedDay();
      this.lists().forEach((list) => list.scrollToSelected());
    });
  }

  private commit(): void {
    const date = this.stagedDate() || todayLocal();
    const hh = this.stagedHh() ?? '00';
    const mm = this.stagedMm() ?? '00';
    this.value.set(`${date}T${hh}:${mm}`);
  }

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
}
