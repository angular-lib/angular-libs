import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import {
  DEFAULT_MONTHS,
  DEFAULT_WEEKDAYS,
  buildCalendarGrid,
  parseDate,
  rotateWeekdays,
  todayLocal,
  type CalendarCell,
} from '../../utils/date-time';
import { AlItemList, type AlListItem, type AlListItemValue } from './item-list';

const DAYS_PER_WEEK = 7;

/**
 * Month calendar grid with roving tabindex (no @angular/aria).
 * Value is `yyyy-MM-dd` or `''`.
 */
@Component({
  selector: 'al-calendar-grid',
  imports: [AlItemList],
  template: `
    <div class="al-calendar">
      <div class="al-calendar__header">
        <div class="al-calendar__nav-selects">
          <div class="al-calendar__select">
            <button
              type="button"
              class="al-calendar__select-btn"
              [attr.aria-expanded]="monthOpen()"
              (click)="toggleMonth($event)">
              {{ monthLabel() }}
              <span aria-hidden="true">▾</span>
            </button>
            @if (monthOpen()) {
              <div class="al-calendar__select-panel" role="presentation">
                <al-item-list
                  [items]="monthItems()"
                  [value]="selectedMonth()"
                  ariaLabel="Month"
                  (valueChange)="onMonthSelected($event)"
                  (itemSelected)="monthOpen.set(false)" />
              </div>
            }
          </div>
          <div class="al-calendar__select">
            <button
              type="button"
              class="al-calendar__select-btn"
              [attr.aria-expanded]="yearOpen()"
              (click)="toggleYear($event)">
              {{ yearLabel() }}
              <span aria-hidden="true">▾</span>
            </button>
            @if (yearOpen()) {
              <div class="al-calendar__select-panel al-calendar__select-panel--year" role="presentation">
                <al-item-list
                  [items]="yearItems()"
                  [value]="selectedYear()"
                  ariaLabel="Year"
                  (valueChange)="onYearSelected($event)"
                  (itemSelected)="yearOpen.set(false)" />
              </div>
            }
          </div>
        </div>
        <div class="al-calendar__arrows">
          <button type="button" class="al-calendar__arrow" aria-label="Previous month" (click)="prevMonth()">
            ‹
          </button>
          <button type="button" class="al-calendar__arrow" aria-label="Next month" (click)="nextMonth()">
            ›
          </button>
        </div>
      </div>

      <table
        #gridEl
        class="al-calendar__grid"
        role="grid"
        [attr.aria-label]="monthLabel() + ' ' + yearLabel()"
        (keydown)="onGridKeyDown($event)">
        <thead>
          <tr>
            @if (showWeekNumbers()) {
              <th scope="col" class="al-calendar__week-head"></th>
            }
            @for (day of weekdayLabels(); track $index) {
              <th scope="col">{{ day }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (week of weeks(); track week.days[0].dateFormatted; let row = $index) {
            <tr role="row">
              @if (showWeekNumbers()) {
                <td class="al-calendar__week" aria-hidden="true">{{ week.weekNumber }}</td>
              }
              @for (day of week.days; track day.dateFormatted; let col = $index) {
                <td
                  role="gridcell"
                  class="al-calendar__cell"
                  [class.al-calendar__cell--overflow]="day.overflow"
                  [class.al-calendar__cell--today]="day.dateFormatted === dateToday()"
                  [class.al-calendar__cell--selected]="day.selected"
                  [class.al-calendar__cell--disabled]="day.disabled"
                  [attr.aria-selected]="day.selected"
                  [attr.aria-disabled]="day.disabled || null"
                  [attr.aria-label]="day.dateFormatted">
                  <button
                    #dayBtn
                    type="button"
                    class="al-calendar__day"
                    [attr.tabindex]="isFocusTarget(day) ? 0 : -1"
                    [disabled]="day.disabled"
                    (click)="selectDay(day)"
                    (keydown)="onCellKeyDown($event, day, row, col)">
                    {{ day.day }}
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .al-calendar {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      background: var(--al-picker-surface, #fff);
      color: inherit;
      font: inherit;
    }
    .al-calendar__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .al-calendar__nav-selects {
      display: flex;
      gap: 0.25rem;
      align-items: center;
    }
    .al-calendar__select {
      position: relative;
    }
    .al-calendar__select-btn,
    .al-calendar__arrow {
      border: 1px solid var(--al-form-border, #c4c4c4);
      background: var(--al-picker-surface, #fff);
      border-radius: var(--al-picker-radius, 0.25rem);
      padding: 0.25rem 0.45rem;
      font: inherit;
      cursor: pointer;
      color: inherit;
    }
    .al-calendar__select-btn:hover,
    .al-calendar__arrow:hover {
      background: var(--al-picker-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .al-calendar__arrows {
      display: flex;
      gap: 0.15rem;
    }
    .al-calendar__select-panel {
      position: absolute;
      z-index: 2;
      top: 100%;
      left: 0;
      margin-top: 0.15rem;
      max-height: 12rem;
      min-width: 7rem;
      overflow: auto;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: var(--al-picker-radius, 0.25rem);
      background: var(--al-picker-surface, #fff);
      box-shadow: var(--al-picker-panel-shadow, 0 4px 16px rgba(0, 0, 0, 0.12));
    }
    .al-calendar__select-panel--year {
      max-height: 14rem;
      min-width: 5rem;
    }
    .al-calendar__grid {
      border-spacing: 2px;
      border-collapse: separate;
    }
    .al-calendar__grid:focus {
      outline: none;
    }
    .al-calendar__grid th {
      color: var(--al-picker-muted, #6b7280);
      font-weight: 500;
      font-size: 0.75rem;
      height: var(--al-picker-cell-size, 2.25rem);
      width: var(--al-picker-cell-size, 2.25rem);
      text-align: center;
    }
    .al-calendar__cell {
      height: var(--al-picker-cell-size, 2.25rem);
      width: var(--al-picker-cell-size, 2.25rem);
      padding: 0;
      text-align: center;
      vertical-align: middle;
      border-radius: var(--al-picker-radius, 0.25rem);
    }
    .al-calendar__day {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
      border-radius: inherit;
      font: inherit;
      color: inherit;
      cursor: pointer;
      padding: 0;
    }
    .al-calendar__day:disabled {
      color: var(--al-picker-muted, #9ca3af);
      cursor: not-allowed;
    }
    .al-calendar__cell:not(.al-calendar__cell--disabled):hover {
      background: var(--al-picker-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .al-calendar__cell--selected {
      background: var(--al-picker-selected-bg, var(--al-form-focus, #ea580c));
      color: var(--al-picker-selected-fg, #fff);
    }
    .al-calendar__cell--selected:hover {
      background: var(--al-picker-selected-bg, var(--al-form-focus, #ea580c));
    }
    .al-calendar__cell--today .al-calendar__day {
      box-shadow: inset 0 0 0 1px var(--al-form-focus, #ea580c);
    }
    .al-calendar__cell--overflow:not(.al-calendar__cell--selected) {
      color: var(--al-picker-muted, #9ca3af);
    }
    .al-calendar__day:focus-visible {
      outline: 2px solid var(--al-form-border, #c4c4c4);
      outline-offset: -2px;
    }
    .al-calendar__week,
    .al-calendar__week-head {
      color: var(--al-picker-muted, #6b7280);
      font-size: 0.7rem;
      width: 1.5rem;
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class AlCalendarGrid {
  /** `yyyy-MM-dd` or `''`. */
  readonly value = model<string>('');

  readonly disabledDates = input<readonly string[]>([]);
  readonly firstDayOfWeek = input(1);
  readonly max = input('2100-12-31');
  readonly min = input('1900-01-01');
  readonly months = input<readonly string[]>(DEFAULT_MONTHS);
  readonly showWeekNumbers = input(true);
  readonly weekdays = input<readonly string[]>(DEFAULT_WEEKDAYS);

  readonly cellKeyDown = output<{ event: KeyboardEvent; cell: CalendarCell }>();
  readonly valuePicked = output<string>();

  protected readonly dateToday = signal(todayLocal());
  protected readonly monthOpen = signal(false);
  protected readonly yearOpen = signal(false);

  protected readonly viewDate = linkedSignal(() => {
    const parsed = parseDate(this.value());
    return parsed ?? new Date();
  });

  protected readonly focusDate = linkedSignal(() => {
    const v = this.value();
    if (v) {
      return v;
    }
    return this.dateToday();
  });

  private readonly dayButtons = viewChildren<ElementRef<HTMLButtonElement>>('dayBtn');

  protected readonly weeks = computed(() => {
    const view = this.viewDate();
    return buildCalendarGrid({
      viewYear: view.getFullYear(),
      viewMonth: view.getMonth(),
      value: this.value() || null,
      min: this.min(),
      max: this.max(),
      disabledDates: this.disabledDates(),
      firstDayOfWeek: this.firstDayOfWeek(),
    });
  });

  protected readonly weekdayLabels = computed(() =>
    rotateWeekdays(this.weekdays(), this.firstDayOfWeek()),
  );

  protected readonly monthLabel = computed(() => this.months()[this.viewDate().getMonth()] ?? '');
  protected readonly yearLabel = computed(() => String(this.viewDate().getFullYear()));
  protected readonly selectedMonth = computed(() => this.viewDate().getMonth());
  protected readonly selectedYear = computed(() => this.viewDate().getFullYear());

  protected readonly monthItems = computed((): AlListItem[] =>
    this.months().map((label, value) => ({ label, value })),
  );

  protected readonly yearItems = computed((): AlListItem[] => {
    const start = parseDate(this.min())?.getFullYear() ?? 1900;
    const end = parseDate(this.max())?.getFullYear() ?? 2100;
    const items: AlListItem[] = [];
    for (let y = start; y <= end; y++) {
      items.push({ label: String(y), value: y });
    }
    return items;
  });

  protected isFocusTarget(day: CalendarCell): boolean {
    return day.dateFormatted === this.focusDate();
  }

  focusSelectedDay(): void {
    requestAnimationFrame(() => {
      const buttons = this.dayButtons();
      const allDays = this.weeks().flatMap((w) => w.days);
      const focus = this.focusDate();
      let idx = allDays.findIndex((d) => d.dateFormatted === focus && !d.disabled);
      if (idx < 0) {
        idx = allDays.findIndex((d) => !d.overflow && !d.disabled);
      }
      if (idx < 0) {
        idx = 0;
      }
      buttons[idx]?.nativeElement.focus();
    });
  }

  protected selectDay(day: CalendarCell): void {
    if (day.disabled) {
      return;
    }
    this.value.set(day.dateFormatted);
    this.focusDate.set(day.dateFormatted);
    this.valuePicked.emit(day.dateFormatted);
    this.monthOpen.set(false);
    this.yearOpen.set(false);
  }

  protected prevMonth(focusLast = false): void {
    const view = this.viewDate();
    this.viewDate.set(new Date(view.getFullYear(), view.getMonth() - 1, 1));
    if (focusLast) {
      requestAnimationFrame(() => this.focusEdgeDay(false));
    }
  }

  protected nextMonth(focusFirst = false): void {
    const view = this.viewDate();
    this.viewDate.set(new Date(view.getFullYear(), view.getMonth() + 1, 1));
    if (focusFirst) {
      requestAnimationFrame(() => this.focusEdgeDay(true));
    }
  }

  protected toggleMonth(event: Event): void {
    event.stopPropagation();
    this.yearOpen.set(false);
    this.monthOpen.update((v) => !v);
  }

  protected toggleYear(event: Event): void {
    event.stopPropagation();
    this.monthOpen.set(false);
    this.yearOpen.update((v) => !v);
  }

  protected onMonthSelected(month: AlListItemValue | null): void {
    if (typeof month !== 'number') {
      return;
    }
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), month, 1));
    this.monthOpen.set(false);
  }

  protected onYearSelected(year: AlListItemValue | null): void {
    if (typeof year !== 'number') {
      return;
    }
    const current = this.viewDate();
    this.viewDate.set(new Date(year, current.getMonth(), 1));
    this.yearOpen.set(false);
  }

  protected onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    // Close month/year menus when clicking outside their panels (host still contains them).
    const path = event.composedPath?.() ?? [];
    const insideSelect = path.some(
      (n) => n instanceof HTMLElement && n.classList?.contains('al-calendar__select'),
    );
    if (!insideSelect) {
      this.monthOpen.set(false);
      this.yearOpen.set(false);
    }
  }

  protected onGridKeyDown(event: KeyboardEvent): void {
    // Handled on cells; keep for focus containment.
    void event;
  }

  protected onCellKeyDown(
    event: KeyboardEvent,
    cell: CalendarCell,
    _row: number,
    _col: number,
  ): void {
    const allDays = this.weeks().flatMap((w) => w.days);
    const index = allDays.findIndex((d) => d.dateFormatted === cell.dateFormatted);
    if (index < 0) {
      return;
    }

    const moveBy = (delta: number): void => {
      let next = index + delta;
      while (next >= 0 && next < allDays.length && allDays[next].disabled) {
        next += delta > 0 ? 1 : -1;
      }
      if (next < 0) {
        event.preventDefault();
        this.prevMonth(true);
        return;
      }
      if (next >= allDays.length) {
        event.preventDefault();
        this.nextMonth(true);
        return;
      }
      event.preventDefault();
      this.focusDate.set(allDays[next].dateFormatted);
      requestAnimationFrame(() => this.dayButtons()[next]?.nativeElement.focus());
    };

    switch (event.key) {
      case 'ArrowLeft':
        moveBy(-1);
        break;
      case 'ArrowRight':
        moveBy(1);
        break;
      case 'ArrowUp':
        moveBy(-DAYS_PER_WEEK);
        break;
      case 'ArrowDown':
        moveBy(DAYS_PER_WEEK);
        break;
      case 'Home': {
        event.preventDefault();
        const rowStart = Math.floor(index / DAYS_PER_WEEK) * DAYS_PER_WEEK;
        const target =
          allDays.slice(rowStart, rowStart + DAYS_PER_WEEK).find((d) => !d.disabled) ??
          allDays[rowStart];
        this.focusDate.set(target.dateFormatted);
        this.focusSelectedDay();
        break;
      }
      case 'End': {
        event.preventDefault();
        const rowStart = Math.floor(index / DAYS_PER_WEEK) * DAYS_PER_WEEK;
        const rowDays = allDays.slice(rowStart, rowStart + DAYS_PER_WEEK);
        const enabled = [...rowDays].reverse().find((d) => !d.disabled);
        const target = enabled ?? rowDays[rowDays.length - 1];
        this.focusDate.set(target.dateFormatted);
        this.focusSelectedDay();
        break;
      }
      case 'PageUp':
        event.preventDefault();
        this.prevMonth();
        requestAnimationFrame(() => this.focusSelectedDay());
        break;
      case 'PageDown':
        event.preventDefault();
        this.nextMonth();
        requestAnimationFrame(() => this.focusSelectedDay());
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectDay(cell);
        break;
      default:
        break;
    }

    this.cellKeyDown.emit({ event, cell });
  }

  private focusEdgeDay(first: boolean): void {
    const allDays = this.weeks().flatMap((w) => w.days);
    let idx = -1;
    if (first) {
      idx = allDays.findIndex((d) => !d.overflow && !d.disabled);
    } else {
      for (let i = allDays.length - 1; i >= 0; i--) {
        if (!allDays[i].overflow && !allDays[i].disabled) {
          idx = i;
          break;
        }
      }
    }
    const target = idx >= 0 ? idx : first ? 0 : allDays.length - 1;
    this.focusDate.set(allDays[target].dateFormatted);
    this.dayButtons()[target]?.nativeElement.focus();
  }
}