import type { ColumnDef } from '../components/data-grid/data-grid.types';
import type { DisplayRow } from './row-display';
import {
  applyPasteMatrix,
  collectPasteTargetRows,
  escapeClipboardCell,
  parseClipboardMatrix,
  serializeClipboardMatrix,
} from './clipboard-paste';
import {
  formatNumberForEdit,
  parseCellInput,
  parseDateKey,
  parseLocaleNumber,
  writeCellFromText,
} from './coerce-cell-value';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Col = ColumnDef<any>;

describe('parseClipboardMatrix (TSV state machine)', () => {
  it('keeps commas inside a single pasted column (no CSV fallback)', () => {
    expect(parseClipboardMatrix('1,5\r\n2,5')).toEqual([['1,5'], ['2,5']]);
    expect(parseClipboardMatrix('Smith, John')).toEqual([['Smith, John']]);
  });

  it('parses quoted fields containing tabs, newlines, and "" escapes', () => {
    expect(parseClipboardMatrix('a\t"line1\nline2"\tc\r\nd\te\tf\r\n')).toEqual([
      ['a', 'line1\nline2', 'c'],
      ['d', 'e', 'f'],
    ]);
    expect(parseClipboardMatrix('"5"" screen"\t"x\ty"')).toEqual([['5" screen', 'x\ty']]);
  });

  it('treats mid-field and unterminated quotes literally', () => {
    expect(parseClipboardMatrix('5" screen\tb')).toEqual([['5" screen', 'b']]);
    expect(parseClipboardMatrix('"abc\nd')).toEqual([['"abc'], ['d']]);
  });

  it('keeps empty cells and ignores one trailing row break', () => {
    expect(parseClipboardMatrix('a\t\tc\n')).toEqual([['a', '', 'c']]);
    expect(parseClipboardMatrix('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });

  it('parses CSV only when asked explicitly', () => {
    expect(parseClipboardMatrix('a,"b,c"\n1,2', { delimiter: ',' })).toEqual([
      ['a', 'b,c'],
      ['1', '2'],
    ]);
  });

  it('round-trips the grid copy format', () => {
    const matrix = [
      ['plain', 'tab\there', 'multi\nline'],
      ['5" screen', '"quoted"', ''],
    ];
    expect(parseClipboardMatrix(serializeClipboardMatrix(matrix))).toEqual(matrix);
    expect(escapeClipboardCell('plain')).toBe('plain');
  });
});

describe('paste targets by display order', () => {
  type Row = { id: number; name: string; dept: string };
  const processed: Row[] = [
    { id: 1, name: 'Alice', dept: 'Eng' },
    { id: 2, name: 'Bob', dept: 'Sales' },
    { id: 3, name: 'Carol', dept: 'Eng' },
  ];
  // Grouped by dept: Eng → Alice, Carol; Sales → Bob.
  const display: DisplayRow<Row>[] = [
    { kind: 'group', id: 'g:Eng', field: 'dept', key: 'Eng', level: 0, expanded: true, childCount: 2 },
    { kind: 'data', id: 'd:1', rowId: 1, row: processed[0]!, dataIndex: 0, level: 1 },
    { kind: 'data', id: 'd:3', rowId: 3, row: processed[2]!, dataIndex: 2, level: 1 },
    { kind: 'group', id: 'g:Sales', field: 'dept', key: 'Sales', level: 0, expanded: true, childCount: 1 },
    { kind: 'data', id: 'd:2', rowId: 2, row: processed[1]!, dataIndex: 1, level: 1 },
  ];

  it('walks display rows forward and writes by row id', () => {
    const targets = collectPasteTargetRows(display, 1, 3);
    expect(targets.map((t) => t.rowId)).toEqual([1, 3, 2]);
    const result = applyPasteMatrix(
      processed,
      [['A2'], ['C2']],
      targets.slice(0, 2).map((t) => t.rowId),
      ['name'],
      {
        rowId: (r) => r.id,
        write: (row, _col, value) => ({ ...row, name: value }),
      },
    );
    expect(result.rows.map((r) => r.name)).toEqual(['A2', 'Bob', 'C2']);
    expect(result.rowIds).toEqual([1, 2, 3]);
    expect(result.changed).toBe(2);
  });
});

describe('strict cell parsing', () => {
  const num: Col = { field: 'n', type: 'number', editable: true };

  it('rejects garbage and ambiguous numbers', () => {
    for (const bad of ['abc', '10-20', '0x10', '(100)', '50%', '1,2,3', '--1', '1e']) {
      expect(parseLocaleNumber(bad, 'en-US'), bad).toBeNull();
    }
    const out = parseCellInput(num, 'abc', { numberLocale: 'en-US' });
    expect(out.ok).toBe(false);
  });

  it('parses with the locale separators', () => {
    expect(parseLocaleNumber('1,234.5', 'en-US')).toBe(1234.5);
    expect(parseLocaleNumber('1.5', 'en-US')).toBe(1.5);
    expect(parseLocaleNumber('1,5', 'en-US')).toBeNull();
    expect(parseLocaleNumber('1.234,5', 'de-DE')).toBe(1234.5);
    expect(parseLocaleNumber('1.500', 'de-DE')).toBe(1500);
    expect(parseLocaleNumber('1,5', 'nb-NO')).toBe(1.5);
    expect(parseLocaleNumber('1 234,5', 'nb-NO')).toBe(1234.5);
    expect(parseLocaleNumber('1 234,5', 'nb-NO')).toBe(1234.5);
    expect(parseLocaleNumber('1.5', 'nb-NO')).toBe(1.5);
    // `.` is only an alternate decimal in nb — `1.500` could be a thousands group.
    expect(parseLocaleNumber('1.500', 'nb-NO')).toBeNull();
    expect(parseLocaleNumber('-2,5', 'nb-NO')).toBe(-2.5);
    expect(parseLocaleNumber('−2', 'en-US')).toBe(-2);
  });

  it('accepts a currency affix', () => {
    expect(parseLocaleNumber('$70,000', 'en-US')).toBe(70000);
    expect(parseLocaleNumber('-$5.25', 'en-US')).toBe(-5.25);
    expect(parseLocaleNumber('70 000 kr', 'nb-NO')).toBe(70000);
    expect(parseLocaleNumber('NOK 12,50', 'nb-NO')).toBe(12.5);
  });

  it('formats numbers for editing with the locale decimal', () => {
    expect(formatNumberForEdit(1.5, 'nb-NO')).toBe('1,5');
    expect(formatNumberForEdit(1234.5, 'en-US')).toBe('1234.5');
    expect(parseLocaleNumber(formatNumberForEdit(1234.5, 'de-DE'), 'de-DE')).toBe(1234.5);
  });

  it('validates date components and the locale order', () => {
    expect(parseDateKey('2026-13-45')).toBeNull();
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('12')).toBeNull();
    expect(parseDateKey('2026-09-25')).toBe('2026-09-25');
    expect(parseDateKey('2026-09-25T10:00:00Z')).toBe('2026-09-25');
    expect(parseDateKey('25.09.2026', 'nb-NO')).toBe('2026-09-25');
    expect(parseDateKey('9/25/2026', 'en-US')).toBe('2026-09-25');
    expect(parseDateKey('25/9/2026', 'en-US')).toBeNull();
    expect(parseDateKey('25.09.26', 'nb-NO')).toBeNull();
  });

  it('keeps the previous date value shape', () => {
    const date: Col = { field: 'd', type: 'date' };
    expect(parseCellInput(date, '25.09.2026', { previousValue: '2026-01-01', numberLocale: 'nb-NO' })).toEqual({
      ok: true,
      value: '2026-09-25',
    });
    expect(
      parseCellInput(date, '2026-09-25', { previousValue: '2026-01-01T08:30:00Z' }),
    ).toEqual({ ok: true, value: '2026-09-25T08:30:00Z' });
    const asDate = parseCellInput(date, '2026-09-25', { previousValue: new Date(2020, 0, 1) });
    expect(asDate.ok && asDate.value instanceof Date).toBe(true);
    expect(parseCellInput(date, '', { previousValue: '2026-01-01' })).toEqual({ ok: true, value: null });
    expect(parseCellInput(date, 'soon').ok).toBe(false);
  });

  it('validates booleans and select values', () => {
    const bool: Col = { field: 'b', type: 'boolean' };
    expect(parseCellInput(bool, 'Yes')).toEqual({ ok: true, value: true });
    expect(parseCellInput(bool, '0')).toEqual({ ok: true, value: false });
    expect(parseCellInput(bool, 'maybe').ok).toBe(false);
    const sel: Col = { field: 's', cellEditor: 'select', cellEditorParams: { values: ['a', 'b'] } };
    expect(parseCellInput(sel, 'a')).toEqual({ ok: true, value: 'a' });
    expect(parseCellInput(sel, 'z').ok).toBe(false);
  });

  it('uses column.valueParser when provided', () => {
    const pct: Col = {
      field: 'p',
      type: 'number',
      valueParser: (input) =>
        /^\d+%$/.test(input) ? { value: Number(input.slice(0, -1)) / 100 } : { error: 'Use NN%' },
    };
    expect(parseCellInput(pct, '50%')).toEqual({ ok: true, value: 0.5 });
    expect(parseCellInput(pct, '50')).toEqual({ ok: false, error: 'Use NN%' });
  });

  it('writeCellFromText skips non-writable columns and reports invalid input', () => {
    type Row = { id: number; age: number; total?: number };
    const row: Row = { id: 1, age: 3 };
    expect(writeCellFromText(row, { field: 'id' }, 'id', '9', 0)).toBeNull();
    expect(
      writeCellFromText(row, { id: 'total', editable: true, valueGetter: (r: Row) => r.age * 2 }, 'total', '9', 0),
    ).toBeNull();
    expect(writeCellFromText(row, { field: 'age', type: 'number', editable: true }, 'age', 'x', 0)).toEqual({
      error: 'Not a valid number',
    });
    expect(
      writeCellFromText(row, { field: 'age', type: 'number', editable: true }, 'age', '4', 0, {
        numberLocale: 'en-US',
      }),
    ).toEqual({ row: { id: 1, age: 4 } });
  });
});
