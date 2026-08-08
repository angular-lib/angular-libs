/** Local date/time helpers for string-based pickers (`yyyy-MM-dd`, `HH:mm`, `yyyy-MM-ddTHH:mm`). */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const DAYS_PER_WEEK = 7;

export const DEFAULT_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Weekday initials starting Monday (matches `firstDayOfWeek: 1`). */
export const DEFAULT_WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export interface CalendarCell {
  date: Date;
  /** `yyyy-MM-dd` */
  dateFormatted: string;
  day: number;
  disabled: boolean;
  selected: boolean;
  overflow: boolean;
}

export interface CalendarWeek {
  weekNumber: number;
  days: CalendarCell[];
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date → `yyyy-MM-dd` (never UTC ISO). */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local time → `HH:mm`. */
export function toTimeString(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Local date+time → `yyyy-MM-ddTHH:mm`. */
export function toDateTimeString(date: Date): string {
  return `${toDateString(date)}T${toTimeString(date)}`;
}

/** Today's local date as `yyyy-MM-dd`. */
export function todayLocal(): string {
  return toDateString(new Date());
}

/** `yyyy-MM-dd` → local Date at midnight, or null. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const m = DATE_RE.exec(value.trim());
  if (!m) {
    return null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** `HH:mm` (optional seconds) → `{ hours, minutes }` or null. */
export function parseTime(value: string | null | undefined): { hours: number; minutes: number } | null {
  if (!value) {
    return null;
  }
  const m = TIME_RE.exec(value.trim());
  if (!m) {
    return null;
  }
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

/** Normalize to `HH:mm`, or `''` if invalid/empty. */
export function normalizeTime(value: string | null | undefined): string {
  const t = parseTime(value);
  if (!t) {
    return '';
  }
  return `${pad2(t.hours)}:${pad2(t.minutes)}`;
}

/**
 * Parse datetime string (`T` or space separator).
 * Returns local Date, or null.
 */
export function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const m = DATETIME_RE.exec(trimmed);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hours = Number(m[4]);
    const minutes = Number(m[5]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    const d = new Date(year, month - 1, day, hours, minutes);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return null;
    }
    return d;
  }
  // Date-only → midnight
  return parseDate(trimmed);
}

/** Normalize to `yyyy-MM-ddTHH:mm`, or `''` if empty/invalid. */
export function normalizeDateTime(value: string | null | undefined): string {
  const d = parseDateTime(value);
  if (!d) {
    return '';
  }
  return toDateTimeString(d);
}

/** Date part of a datetime string (`yyyy-MM-dd`), or `''`. */
export function datePartOf(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (DATE_RE.test(trimmed)) {
    return trimmed;
  }
  const d = parseDateTime(trimmed);
  return d ? toDateString(d) : '';
}

/** Time part of a datetime string (`HH:mm`), or `''`. */
export function timePartOf(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const m = DATETIME_RE.exec(trimmed);
  if (m) {
    return `${m[4]}:${m[5]}`;
  }
  const t = parseTime(trimmed);
  return t ? `${pad2(t.hours)}:${pad2(t.minutes)}` : '';
}

/** Lexicographic compare for `yyyy-MM-dd` / `HH:mm` / `yyyy-MM-ddTHH:mm` when normalized. */
export function compareDateStrings(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function isDateInRange(
  dateStr: string,
  min = '1900-01-01',
  max = '2100-12-31',
): boolean {
  return compareDateStrings(dateStr, min) >= 0 && compareDateStrings(dateStr, max) <= 0;
}

export function clampDateString(
  dateStr: string,
  min = '1900-01-01',
  max = '2100-12-31',
): string {
  if (compareDateStrings(dateStr, min) < 0) {
    return min;
  }
  if (compareDateStrings(dateStr, max) > 0) {
    return max;
  }
  return dateStr;
}

/** Minutes since midnight, or null. */
export function timeToMinutes(value: string | null | undefined): number | null {
  const t = parseTime(value);
  if (!t) {
    return null;
  }
  return t.hours * 60 + t.minutes;
}

export function minutesToTime(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

export function isTimeInRange(
  timeStr: string,
  min = '00:00',
  max = '23:59',
): boolean {
  const v = timeToMinutes(timeStr);
  const lo = timeToMinutes(min);
  const hi = timeToMinutes(max);
  if (v == null || lo == null || hi == null) {
    return false;
  }
  return v >= lo && v <= hi;
}

export function clampTimeString(timeStr: string, min = '00:00', max = '23:59'): string {
  const v = timeToMinutes(timeStr);
  const lo = timeToMinutes(min) ?? 0;
  const hi = timeToMinutes(max) ?? 23 * 60 + 59;
  if (v == null) {
    return minutesToTime(lo);
  }
  return minutesToTime(Math.max(lo, Math.min(hi, v)));
}

/** ISO-8601 week number (local date components). */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export interface BuildCalendarOptions {
  viewYear: number;
  viewMonth: number; // 0-11
  value?: string | null;
  min?: string;
  max?: string;
  disabledDates?: readonly string[];
  firstDayOfWeek?: number; // 0=Sun … 6=Sat
}

export function buildCalendarGrid(options: BuildCalendarOptions): CalendarWeek[] {
  const {
    viewYear,
    viewMonth,
    value = null,
    min = '1900-01-01',
    max = '2100-12-31',
    disabledDates = [],
    firstDayOfWeek = 1,
  } = options;

  const disabledSet = new Set(disabledDates);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const offset = (firstDay - firstDayOfWeek + 7) % 7;

  const makeCell = (date: Date, overflow: boolean): CalendarCell => {
    const dateFormatted = toDateString(date);
    const disabled =
      disabledSet.has(dateFormatted) || !isDateInRange(dateFormatted, min, max);
    return {
      date,
      dateFormatted,
      day: date.getDate(),
      disabled,
      selected: !!value && dateFormatted === value,
      overflow,
    };
  };

  const lastDayOfPrev = new Date(viewYear, viewMonth, 0).getDate();
  const prevDays = Array.from({ length: offset }, (_, i) => {
    const day = lastDayOfPrev - (offset - 1 - i);
    return makeCell(new Date(viewYear, viewMonth - 1, day), true);
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const currentDays = Array.from({ length: daysInMonth }, (_, i) =>
    makeCell(new Date(viewYear, viewMonth, i + 1), false),
  );

  const allDays = [...prevDays, ...currentDays];
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < allDays.length; i += DAYS_PER_WEEK) {
    const slice = allDays.slice(i, i + DAYS_PER_WEEK);
    weeks.push({ weekNumber: getWeekNumber(slice[0].date), days: slice });
  }

  if (weeks.length > 0) {
    const lastWeek = weeks[weeks.length - 1];
    const trailing = DAYS_PER_WEEK - lastWeek.days.length;
    for (let i = 0; i < trailing; i++) {
      lastWeek.days.push(makeCell(new Date(viewYear, viewMonth + 1, i + 1), true));
    }
  }

  return weeks;
}

export interface TimeListItem {
  label: string;
  value: string;
  disabled: boolean;
}

/** Build hour labels `00`–`23`, optionally disabled by min/max. */
export function buildHourItems(min = '00:00', max = '23:59'): TimeListItem[] {
  const lo = timeToMinutes(min) ?? 0;
  const hi = timeToMinutes(max) ?? 23 * 60 + 59;
  const minH = Math.floor(lo / 60);
  const maxH = Math.floor(hi / 60);
  return Array.from({ length: 24 }, (_, h) => {
    const label = pad2(h);
    return {
      label,
      value: label,
      disabled: h < minH || h > maxH,
    };
  });
}

/** Build minute labels with `step` (default 1), disabled by hour + min/max. */
export function buildMinuteItems(
  hour: string | null | undefined,
  min = '00:00',
  max = '23:59',
  step = 1,
): TimeListItem[] {
  const safeStep = Math.max(1, Math.min(30, Math.floor(step) || 1));
  const h = hour != null && hour !== '' ? Number(hour) : 0;
  const lo = timeToMinutes(min) ?? 0;
  const hi = timeToMinutes(max) ?? 23 * 60 + 59;
  const items: TimeListItem[] = [];
  for (let m = 0; m < 60; m += safeStep) {
    const total = h * 60 + m;
    const label = pad2(m);
    items.push({
      label,
      value: label,
      disabled: total < lo || total > hi,
    });
  }
  return items;
}

/** Ordered weekday labels rotated so index 0 matches `firstDayOfWeek`. */
export function rotateWeekdays(
  weekdays: readonly string[],
  firstDayOfWeek: number,
): string[] {
  // DEFAULT_WEEKDAYS starts at Monday; map JS day (0=Sun) → offset into Mon-based list.
  const monBasedStart = (firstDayOfWeek + 6) % 7;
  if (weekdays.length !== 7) {
    return [...weekdays];
  }
  return [...weekdays.slice(monBasedStart), ...weekdays.slice(0, monBasedStart)];
}
