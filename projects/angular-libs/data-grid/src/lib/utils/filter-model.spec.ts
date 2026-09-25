import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { resolveColumns } from './cell-value';
import {
  collectSetFilterValues,
  filterRows,
  filterText,
  quickFilterRows,
  toDateKey,
} from './filter-rows';
import {
  isValidColumnFilterModel,
  normalizeFilterModel,
  parseNumberFilterInput,
  formatNumberFilterInput,
  resolveFilterKind,
  sanitizeFilterState,
  type ColumnFilterModel,
} from './filter-model';
import { parseGridState, serializeGridState, createEmptyGridState } from './state';

interface Row {
  id: number;
  name: string | null;
  amount: number | null | string;
  active: boolean | null;
  status: string;
  when: unknown;
  tags?: string[];
  meta?: { code: string };
}

const rows: Row[] = [
  { id: 1, name: 'Ada', amount: 0, active: true, status: 'A', when: new Date(2024, 4, 2), tags: ['x', 'y'], meta: { code: 'k1' } },
  { id: 2, name: 'Grace', amount: 150, active: false, status: 'I', when: '2024-05-03' },
  { id: 3, name: null, amount: null, active: null, status: 'A', when: new Date(2024, 4, 5).getTime(), tags: [] },
  { id: 4, name: 'Alan', amount: '', active: false, status: 'I', when: null, tags: ['y'] },
  { id: 5, name: 'Linus', amount: 9, active: true, status: 'A', when: '2024-05-10T12:00:00' },
  { id: 6, name: 'Barbara', amount: 10, active: true, status: 'I', when: '2024-05-04' },
];

const columns: ColumnDef<Row>[] = [
  { field: 'name', filter: true },
  { field: 'amount', type: 'number', filter: true },
  { field: 'active', type: 'boolean', filter: true },
  {
    field: 'status',
    filter: 'text',
    valueFormatter: (v) => (v === 'A' ? 'Active' : 'Inactive'),
  },
  { field: 'when', type: 'date', filter: true },
  { field: 'tags', filter: 'set' },
  { field: 'meta', filter: 'text' },
  { id: 'code', filter: 'text', filterValueGetter: (r) => r.meta?.code ?? null },
];
const resolved = resolveColumns(columns);
const byId = new Map(resolved.map((c) => [c.id, c]));

const ids = (model: Record<string, ColumnFilterModel>) =>
  filterRows(rows, model, byId).map((r) => r.id);

describe('typed column filters (F1)', () => {
  it('number: operators, range, and 0 never matches null / empty', () => {
    expect(ids({ amount: { kind: 'number', conditions: [{ op: 'equals', value: 0 }] } })).toEqual([1]);
    expect(ids({ amount: { kind: 'number', conditions: [{ op: 'greaterThan', value: 9 }] } })).toEqual([2, 6]);
    expect(
      ids({ amount: { kind: 'number', conditions: [{ op: 'inRange', value: 9, valueTo: 10 }] } }),
    ).toEqual([5, 6]);
    expect(ids({ amount: { kind: 'number', conditions: [{ op: 'notEqual', value: 0 }] } })).toEqual([2, 5, 6]);
    expect(ids({ amount: { kind: 'number', conditions: [{ op: 'blank' }] } })).toEqual([3, 4]);
    expect(ids({ amount: { kind: 'number', conditions: [{ op: 'notBlank' }] } })).toEqual([1, 2, 5, 6]);
  });

  it('number shorthand parses >100, <=5, 10-20, 10..20 and flags junk', () => {
    expect(parseNumberFilterInput('>100')).toEqual({ ok: true, condition: { op: 'greaterThan', value: 100 } });
    expect(parseNumberFilterInput('<= 5')).toEqual({ ok: true, condition: { op: 'lessThanOrEqual', value: 5 } });
    expect(parseNumberFilterInput('20-10')).toEqual({
      ok: true,
      condition: { op: 'inRange', value: 10, valueTo: 20 },
    });
    expect(parseNumberFilterInput('-5..-1')).toEqual({
      ok: true,
      condition: { op: 'inRange', value: -5, valueTo: -1 },
    });
    expect(parseNumberFilterInput('-5')).toEqual({ ok: true, condition: { op: 'equals', value: -5 } });
    expect(parseNumberFilterInput('1,5', 'equals', 'nb-NO')).toEqual({
      ok: true,
      condition: { op: 'equals', value: 1.5 },
    });
    expect(parseNumberFilterInput('>abc')).toEqual({ ok: false });
    expect(parseNumberFilterInput('   ')).toEqual({ ok: true, condition: null });
    expect(formatNumberFilterInput({ op: 'inRange', value: 1.5, valueTo: 2 }, 'nb-NO')).toBe('1,5..2');
  });

  it('boolean: false matches false only (not truthy strings, not blanks)', () => {
    expect(ids({ active: { kind: 'boolean', value: false } })).toEqual([2, 4]);
    expect(ids({ active: { kind: 'boolean', value: true } })).toEqual([1, 5, 6]);
  });

  it('date: Date, epoch ms, ISO strings compare as local days', () => {
    expect(toDateKey(new Date(2024, 4, 5).getTime())).toBe('2024-05-05');
    const instant = new Date(2024, 4, 2, 23, 30);
    expect(toDateKey(instant.toISOString())).toBe('2024-05-02');
    expect(ids({ when: { kind: 'date', conditions: [{ op: 'equals', value: '2024-05-05' }] } })).toEqual([3]);
    expect(ids({ when: { kind: 'date', conditions: [{ op: 'before', value: '2024-05-04' }] } })).toEqual([1, 2]);
    expect(ids({ when: { kind: 'date', conditions: [{ op: 'after', value: '2024-05-05' }] } })).toEqual([5]);
    expect(
      ids({ when: { kind: 'date', conditions: [{ op: 'inRange', value: '2024-05-03', valueTo: '2024-05-05' }] } }),
    ).toEqual([2, 3, 6]);
    expect(ids({ when: { kind: 'date', conditions: [{ op: 'blank' }] } })).toEqual([4]);
  });

  it('text: matches formatted and raw text; negations exclude both', () => {
    expect(ids({ status: { kind: 'text', conditions: [{ op: 'equals', value: 'active' }] } })).toEqual([1, 3, 5]);
    expect(ids({ status: { kind: 'text', conditions: [{ op: 'equals', value: 'A' }] } })).toEqual([1, 3, 5]);
    expect(ids({ status: { kind: 'text', conditions: [{ op: 'notContains', value: 'inact' }] } })).toEqual([1, 3, 5]);
    expect(ids({ name: { kind: 'text', conditions: [{ op: 'startsWith', value: 'a' }] } })).toEqual([1, 4]);
    expect(ids({ name: { kind: 'text', conditions: [{ op: 'endsWith', value: 'A' }] } })).toEqual([1, 6]);
    expect(ids({ name: { kind: 'text', conditions: [{ op: 'blank' }] } })).toEqual([3]);
  });

  it('text: objects never match "[object Object]"; filterValueGetter drives matching', () => {
    expect(filterText({ code: 'k1' })).toBe('');
    expect(ids({ meta: { kind: 'text', conditions: [{ op: 'contains', value: 'object' }] } })).toEqual([]);
    expect(ids({ code: { kind: 'text', conditions: [{ op: 'equals', value: 'k1' }] } })).toEqual([1]);
  });

  it('conditions join with AND (default) or OR', () => {
    const conditions = [
      { op: 'startsWith' as const, value: 'a' },
      { op: 'endsWith' as const, value: 'a' },
    ];
    expect(ids({ name: { kind: 'text', conditions } })).toEqual([1]);
    expect(ids({ name: { kind: 'text', conditions, join: 'or' } })).toEqual([1, 4, 6]);
  });

  it('set: include-list, null = blanks, array cells match any element', () => {
    expect(ids({ tags: { kind: 'set', values: ['y'] } })).toEqual([1, 4]);
    expect(ids({ tags: { kind: 'set', values: [null] } })).toEqual([2, 3, 5, 6]);
    expect(ids({ tags: { kind: 'set', values: [] } })).toEqual([]);
  });

  it('set options: numeric / natural sort, blanks last, truncation flagged', () => {
    const amount = byId.get('amount')!;
    const opts = collectSetFilterValues(rows, amount);
    expect(opts.options.map((o) => o.key)).toEqual(['0', '9', '10', '150', null]);
    expect(opts.truncated).toBe(false);
    const status = byId.get('status')!;
    expect(collectSetFilterValues(rows, status).options).toEqual([
      { key: 'A', label: 'Active' },
      { key: 'I', label: 'Inactive' },
    ]);
    expect(collectSetFilterValues(rows, amount, 2)).toEqual({
      options: [
        { key: '0', label: '0' },
        { key: '150', label: '150' },
      ],
      truncated: true,
    });
    const fixed = collectSetFilterValues([], { ...status, filterParams: { setValues: ['I', 'A'] } });
    expect(fixed.options.map((o) => o.label)).toEqual(['Active', 'Inactive']);
  });

  it('custom predicate replaces built-in evaluation', () => {
    const col = resolveColumns<Row>([
      {
        field: 'amount',
        filter: 'custom',
        filterPredicate: (value, _row, model) =>
          model.kind === 'custom' && typeof value === 'number' && value % (model.value as number) === 0,
      },
    ])[0]!;
    const out = filterRows(rows, { amount: { kind: 'custom', value: 5 } }, new Map([['amount', col]]));
    expect(out.map((r) => r.id)).toEqual([1, 2, 6]);
  });

  it('quick filter ANDs whitespace-separated words across columns (formatted too)', () => {
    expect(quickFilterRows(rows, 'ada active', resolved).map((r) => r.id)).toEqual([1]);
    expect(quickFilterRows(rows, 'inactive  grace', resolved).map((r) => r.id)).toEqual([2]);
    expect(quickFilterRows(rows, 'ada grace', resolved)).toEqual([]);
  });

  it('resolveFilterKind: explicit filter wins over column type', () => {
    expect(resolveFilterKind({ type: 'date', filter: 'text' })).toBe('text');
    expect(resolveFilterKind({ type: 'date', filter: true })).toBe('date');
    expect(resolveFilterKind({ type: 'number' })).toBeNull();
  });

  it('validates + normalizes models; state parse drops legacy / invalid filters', () => {
    expect(isValidColumnFilterModel({ kind: 'number', conditions: [{ op: 'equals', value: 1 }] })).toBe(true);
    expect(isValidColumnFilterModel({ kind: 'number', conditions: [{ op: 'equals', value: '1' }] })).toBe(false);
    expect(isValidColumnFilterModel({ kind: 'date', conditions: [{ op: 'equals', value: '2024-02-30' }] })).toBe(false);
    expect(isValidColumnFilterModel({ kind: 'set', values: ['a', null] })).toBe(true);
    expect(isValidColumnFilterModel('Ada')).toBe(false);
    expect(
      normalizeFilterModel({ kind: 'text', conditions: [{ op: 'contains', value: '  ' }, { op: 'blank' }], join: 'or' }),
    ).toEqual({ kind: 'text', conditions: [{ op: 'blank' }] });
    expect(normalizeFilterModel({ kind: 'text', conditions: [{ op: 'contains', value: ' ' }] })).toBeNull();

    const valid: ColumnFilterModel = { kind: 'text', conditions: [{ op: 'contains', value: 'a' }] };
    expect(sanitizeFilterState({ a: valid, b: 'legacy', c: { kind: 'nope' } })).toEqual({ a: valid });
    const raw = serializeGridState({ ...createEmptyGridState(), filters: { a: valid } });
    expect(parseGridState(raw)?.filters).toEqual({ a: valid });
    expect(parseGridState(JSON.stringify({ filters: { name: 'Ada' } }))?.filters).toEqual({});
  });
});
