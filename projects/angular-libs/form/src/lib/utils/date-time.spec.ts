import { describe, expect, it } from 'vitest';
import { formDate, formDateTime, formTime } from '../factories/index';
import {
  buildCalendarGrid,
  buildHourItems,
  buildMinuteItems,
  clampDateString,
  clampTimeString,
  compareDateStrings,
  datePartOf,
  getWeekNumber,
  isDateInRange,
  isTimeInRange,
  minutesToTime,
  normalizeDateTime,
  normalizeTime,
  parseDate,
  parseDateTime,
  parseTime,
  rotateWeekdays,
  timePartOf,
  timeToMinutes,
  toDateString,
  toDateTimeString,
  toTimeString,
  todayLocal,
} from './date-time';

describe('date/time/datetime factories', () => {
  it('creates typed elements', () => {
    expect(formDate({ path: 'd' }).type).toBe('date');
    expect(formTime({ path: 't', props: { step: 15 } }).type).toBe('time');
    expect(formDateTime({ path: 'dt' }).type).toBe('datetime');
  });
});

describe('date-time utils', () => {
  describe('toDateString / parseDate', () => {
    it('formats local date without UTC shift', () => {
      expect(toDateString(new Date(2024, 0, 5))).toBe('2024-01-05');
      expect(toDateString(new Date(2024, 11, 31))).toBe('2024-12-31');
    });

    it('parses valid yyyy-MM-dd', () => {
      const d = parseDate('2024-02-29');
      expect(d?.getFullYear()).toBe(2024);
      expect(d?.getMonth()).toBe(1);
      expect(d?.getDate()).toBe(29);
    });

    it('rejects invalid calendar dates', () => {
      expect(parseDate('2023-02-29')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
      expect(parseDate('2024/01/01')).toBeNull();
    });
  });

  describe('time', () => {
    it('parses and normalizes HH:mm', () => {
      expect(parseTime('09:05')).toEqual({ hours: 9, minutes: 5 });
      expect(normalizeTime('9:05')).toBe('');
      expect(normalizeTime('09:05:30')).toBe('09:05');
      expect(toTimeString(new Date(2024, 0, 1, 14, 7))).toBe('14:07');
    });

    it('compares and clamps times', () => {
      expect(timeToMinutes('08:30')).toBe(8 * 60 + 30);
      expect(minutesToTime(90)).toBe('01:30');
      expect(isTimeInRange('08:00', '08:00', '17:00')).toBe(true);
      expect(isTimeInRange('07:59', '08:00', '17:00')).toBe(false);
      expect(clampTimeString('07:00', '08:00', '17:00')).toBe('08:00');
      expect(clampTimeString('20:00', '08:00', '17:00')).toBe('17:00');
    });
  });

  describe('datetime', () => {
    it('parses T and space separators', () => {
      const a = parseDateTime('2024-06-15T14:30');
      expect(a?.getHours()).toBe(14);
      expect(normalizeDateTime('2024-06-15 14:30')).toBe('2024-06-15T14:30');
      expect(toDateTimeString(new Date(2024, 5, 15, 14, 30))).toBe('2024-06-15T14:30');
    });

    it('extracts date and time parts', () => {
      expect(datePartOf('2024-06-15T14:30')).toBe('2024-06-15');
      expect(timePartOf('2024-06-15T14:30')).toBe('14:30');
      expect(datePartOf('2024-06-15')).toBe('2024-06-15');
      expect(normalizeDateTime('')).toBe('');
    });
  });

  describe('ranges', () => {
    it('compares date strings lexicographically', () => {
      expect(compareDateStrings('2024-01-01', '2024-01-02')).toBe(-1);
      expect(isDateInRange('2024-06-01', '2024-01-01', '2024-12-31')).toBe(true);
      expect(clampDateString('2010-01-01', '2020-01-01', '2030-01-01')).toBe('2020-01-01');
    });
  });

  describe('week number', () => {
    it('returns ISO week for known dates', () => {
      expect(getWeekNumber(new Date(2024, 0, 1))).toBe(1);
      expect(getWeekNumber(new Date(2024, 0, 8))).toBe(2);
    });
  });

  describe('todayLocal', () => {
    it('matches local toDateString(new Date())', () => {
      expect(todayLocal()).toBe(toDateString(new Date()));
    });
  });

  describe('buildCalendarGrid', () => {
    it('builds weeks with overflow and selection', () => {
      const weeks = buildCalendarGrid({
        viewYear: 2024,
        viewMonth: 0,
        value: '2024-01-15',
        firstDayOfWeek: 1,
      });
      expect(weeks.length).toBeGreaterThanOrEqual(4);
      expect(weeks[0].days).toHaveLength(7);
      const selected = weeks.flatMap((w) => w.days).find((d) => d.selected);
      expect(selected?.dateFormatted).toBe('2024-01-15');
      expect(selected?.overflow).toBe(false);
    });

    it('disables dates outside min/max and disabledDates', () => {
      const weeks = buildCalendarGrid({
        viewYear: 2024,
        viewMonth: 5,
        min: '2024-06-10',
        max: '2024-06-20',
        disabledDates: ['2024-06-15'],
        firstDayOfWeek: 1,
      });
      const days = weeks.flatMap((w) => w.days).filter((d) => !d.overflow);
      expect(days.find((d) => d.dateFormatted === '2024-06-09')?.disabled).toBe(true);
      expect(days.find((d) => d.dateFormatted === '2024-06-15')?.disabled).toBe(true);
      expect(days.find((d) => d.dateFormatted === '2024-06-12')?.disabled).toBe(false);
    });
  });

  describe('time list builders', () => {
    it('disables hours outside min/max', () => {
      const hours = buildHourItems('08:30', '17:15');
      expect(hours[7].disabled).toBe(true);
      expect(hours[8].disabled).toBe(false);
      expect(hours[17].disabled).toBe(false);
      expect(hours[18].disabled).toBe(true);
    });

    it('builds minutes with step and range', () => {
      const mins = buildMinuteItems('08', '08:30', '17:00', 15);
      expect(mins.map((m) => m.value)).toEqual(['00', '15', '30', '45']);
      expect(mins.find((m) => m.value === '00')?.disabled).toBe(true);
      expect(mins.find((m) => m.value === '30')?.disabled).toBe(false);
    });
  });

  describe('rotateWeekdays', () => {
    it('rotates Monday-based labels for Sunday start', () => {
      const mon = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      expect(rotateWeekdays(mon, 1)).toEqual(mon);
      expect(rotateWeekdays(mon, 0)[0]).toBe('S');
    });
  });
});
