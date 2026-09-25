import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '../components/data-grid/data-grid.types';
import { resolveColumns } from './cell-value';
import { aggregateColumn, formatAggregateValue } from './editors';
import { applyCellEdit, mergeRowsById } from './apply-edit';
import { applyExternalFilter, filterRows, quickFilterRows } from './filter-rows';
import { sortRows } from './sort-rows';
import { buildDisplayRows, collectTreeGroupIds, type DataDisplayRow } from './row-display';
import { collectAllGroupIds } from './collect-group-ids';
import { GridCapabilities } from '../plugins/capabilities';

interface Item {
  id: number;
  name: string;
  v?: unknown;
  path?: string[];
}

const byIdOf = <T>(columns: ColumnDef<T>[]) =>
  new Map(resolveColumns(columns).map((c) => [c.id, c as ColumnDef<T>]));

describe('R2 aggregates', () => {
  const col = (aggFunc: ColumnDef<Item>['aggFunc']): ColumnDef<Item> => ({ field: 'v', aggFunc });
  const rows = (values: unknown[]): Item[] => values.map((v, id) => ({ id, name: '', v }));

  it('skips blank / non-finite values', () => {
    const data = rows([10, null, '', undefined, NaN, Infinity, 'x', true, '20']);
    expect(aggregateColumn(data, col('avg'))).toBe(15);
    expect(aggregateColumn(data, col('sum'))).toBe(30);
    expect(aggregateColumn(data, col('min'))).toBe(10);
    expect(aggregateColumn(data, col('max'))).toBe(20);
  });

  it('min of [10, null] is 10 and avg of all-blank is null', () => {
    expect(aggregateColumn(rows([10, null]), col('min'))).toBe(10);
    expect(aggregateColumn(rows([null, '']), col('avg'))).toBeNull();
    expect(aggregateColumn(rows([null, '']), col('sum'))).toBe(0);
  });

  it('count = non-blank values', () => {
    expect(aggregateColumn(rows([1, null, '', 'a', 0]), col('count'))).toBe(3);
  });

  it('min/max do not overflow the stack on large inputs', () => {
    const big: Item[] = Array.from({ length: 200_000 }, (_, i) => ({ id: i, name: '', v: i }));
    expect(aggregateColumn(big, col('min'))).toBe(0);
    expect(aggregateColumn(big, col('max'))).toBe(199_999);
  });

  it('formats aggregates without handing the formatter a null row', () => {
    const formatter = vi.fn((value: unknown, row: Item) => `${row.name}${value}`);
    const column: ColumnDef<Item> = { field: 'v', aggFunc: 'sum', valueFormatter: formatter };
    // Row-dereferencing formatter throws → default number formatting.
    expect(formatAggregateValue(1234.5, column)).toBe((1234.5).toLocaleString(undefined, { maximumFractionDigits: 2 }));
    const safe: ColumnDef<Item> = { field: 'v', aggFunc: 'sum', valueFormatter: (v) => `$${v}` };
    expect(formatAggregateValue(3, safe)).toBe('$3');
    expect(formatAggregateValue(3, { ...safe, aggFunc: 'count' })).toBe('3');
  });
});

describe('R4 sort', () => {
  const columns: ColumnDef<Item>[] = [{ field: 'name' }, { field: 'v' }];
  const byId = byIdOf(columns);
  const names = (rows: readonly Item[]) => rows.map((r) => r.name);

  it('uses the collator locale (nb: Æ Ø Å after Z)', () => {
    const rows: Item[] = ['Åse', 'Zed', 'Øyvind', 'Anna', 'Ærlig'].map((name, id) => ({ id, name }));
    expect(names(sortRows(rows, [{ columnId: 'name', direction: 'asc' }], byId, { locale: 'nb' }))).toEqual([
      'Anna',
      'Zed',
      'Ærlig',
      'Øyvind',
      'Åse',
    ]);
  });

  it('numeric collation, stable ties, desc', () => {
    const rows: Item[] = ['item10', 'item2', 'Item2', 'item1'].map((name, id) => ({ id, name }));
    const asc = sortRows(rows, [{ columnId: 'name', direction: 'asc' }], byId);
    expect(names(asc)).toEqual(['item1', 'item2', 'Item2', 'item10']);
    const desc = sortRows(rows, [{ columnId: 'name', direction: 'desc' }], byId);
    expect(names(desc)).toEqual(['item10', 'item2', 'Item2', 'item1']);
  });

  it('treats NaN / invalid Date / blank as blank (sorted first ascending)', () => {
    const rows: Item[] = [
      { id: 0, name: 'a', v: 3 },
      { id: 1, name: 'b', v: NaN },
      { id: 2, name: 'c', v: 1 },
      { id: 3, name: 'd', v: null },
      { id: 4, name: 'e', v: new Date('nope') },
      { id: 5, name: 'f', v: 2 },
    ];
    const sorted = sortRows(rows, [{ columnId: 'v', direction: 'asc' }], byId);
    expect(names(sorted)).toEqual(['b', 'd', 'e', 'c', 'f', 'a']);
  });

  it('reads each cell value once per row (decorate–sort–undecorate)', () => {
    const getter = vi.fn((row: Item) => row.name);
    const cols = byIdOf<Item>([{ id: 'n', valueGetter: getter }]);
    const rows: Item[] = Array.from({ length: 500 }, (_, id) => ({ id, name: `n${(id * 7919) % 500}` }));
    sortRows(rows, [{ columnId: 'n', direction: 'asc' }], cols);
    expect(getter).toHaveBeenCalledTimes(rows.length);
  });

  it('returns the input array when there is nothing to sort', () => {
    const rows: Item[] = [{ id: 1, name: 'a' }];
    expect(sortRows(rows, [], byId)).toBe(rows);
  });
});

describe('R5 no-op stages', () => {
  it('filter / quick filter / external filter return their input unchanged', () => {
    const rows: Item[] = [{ id: 1, name: 'a' }];
    const byId = byIdOf<Item>([{ field: 'name' }]);
    expect(filterRows(rows, {}, byId)).toBe(rows);
    expect(filterRows(rows, { name: { kind: 'text', conditions: [{ op: 'contains', value: '  ' }] } }, byId)).toBe(rows);
    expect(quickFilterRows(rows, ' ', [])).toBe(rows);
    expect(applyExternalFilter(rows, null)).toBe(rows);
  });

  it('runDataStages returns the input when no stage is registered', () => {
    const caps = new GridCapabilities<Item>();
    const rows: Item[] = [{ id: 1, name: 'a' }];
    expect(
      caps.runDataStages(rows, { columnsById: new Map(), rowId: (r) => r.id, collapsedGroupIds: new Set() }),
    ).toBe(rows);
  });
});

describe('R1 index row ids', () => {
  const indexId = (_row: Item, index: number) => index;

  it('mergeRowsById uses suggested row ids (filter hiding a row)', () => {
    const source: Item[] = [
      { id: 0, name: 'A' },
      { id: 1, name: 'B' },
      { id: 2, name: 'C' },
    ];
    // Grid shows [A, C] (B filtered out); paste edits C. Ids are source indexes.
    const suggested = [source[0]!, { ...source[2]!, name: "C'" }];
    const merged = mergeRowsById(source, suggested, indexId, [0, 2]);
    expect(merged.map((r) => r.name)).toEqual(['A', 'B', "C'"]);
  });

  it('applyCellEdit with a source-index rowId edits the right row', () => {
    const source: Item[] = [
      { id: 0, name: 'Zed' },
      { id: 1, name: 'Amy' },
    ];
    const column: ColumnDef<Item> = { field: 'name' };
    // Amy displays first after sorting, but her rowId is her source index (1).
    const next = applyCellEdit(
      source,
      { rowId: 1, row: source[1]!, column, columnId: 'name', value: 'Amy2', previousValue: 'Amy' } as never,
      indexId,
    );
    expect(next.map((r) => r.name)).toEqual(['Zed', 'Amy2']);
  });
});

describe('R6 tree model', () => {
  const byId = byIdOf<Item>([{ field: 'name' }]);
  const build = (rows: Item[], collapsed: ReadonlySet<string> = new Set()) =>
    buildDisplayRows({
      rows,
      rowId: (r) => r.id,
      columnsById: byId,
      collapsedGroupIds: collapsed,
      treeData: { getDataPath: (r) => r.path ?? [] },
    });

  const tree: Item[] = [
    { id: 1, name: 'UK HQ', path: ['UK'] },
    { id: 2, name: 'Ada', path: ['UK', 'London'] },
    { id: 3, name: 'Grace', path: ['US', 'New York'] },
  ];

  it('the row at a path is the node; fillers only for missing parents', () => {
    const rows = build(tree);
    const labels = rows.map((r) =>
      r.kind === 'data' ? `d:${r.row.name}@${r.level}` : r.kind === 'group' ? `g:${r.key}@${r.level}` : '?',
    );
    expect(labels).toEqual([
      'd:UK HQ@0',
      'd:Ada@1',
      'g:US@0',
      'd:Grace@1',
    ]);
    const hq = rows[0] as DataDisplayRow<Item>;
    expect(hq.hasChildren).toBe(true);
    expect(hq.expanded).toBe(true);
    expect(hq.groupId).toBe('t/s%3AUK');
    expect((rows[1] as DataDisplayRow<Item>).hasChildren).toBeUndefined();
    // No leaf is emitted twice.
    expect(rows.filter((r) => r.kind === 'data')).toHaveLength(3);
  });

  it('collapsing a data node hides its children', () => {
    const rows = build(tree, new Set(['t/s%3AUK']));
    expect(rows.filter((r) => r.kind === 'data').map((r) => (r as DataDisplayRow<Item>).row.name)).toEqual([
      'UK HQ',
      'Grace',
    ]);
    expect((rows[0] as DataDisplayRow<Item>).expanded).toBe(false);
  });

  it('collectTreeGroupIds returns every parent node id (incl. fillers)', () => {
    expect(collectTreeGroupIds(tree, (r) => r.path ?? [])).toEqual(['t/s%3AUK', 't/s%3AUS']);
  });
});

describe('R7 group id collisions', () => {
  interface G {
    id: number;
    a?: unknown;
    b?: unknown;
  }
  const byId = byIdOf<G>([{ field: 'a' }, { field: 'b' }]);
  const groupIds = (rows: G[], columns: string[]) => collectAllGroupIds(rows, columns, byId);

  it('separator characters in values do not collide with nesting', () => {
    const ids = groupIds(
      [
        { id: 1, a: 'x/b=y' },
        { id: 2, a: 'x', b: 'y' },
      ],
      ['a', 'b'],
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('null / "" / "(blank)" and 1 / "1" are distinct groups where they should be', () => {
    const ids = groupIds(
      [
        { id: 1, a: null },
        { id: 2, a: '' },
        { id: 3, a: '(blank)' },
        { id: 4, a: 1 },
        { id: 5, a: '1' },
        { id: 6, a: new Date(0) },
        { id: 7, a: { k: 1 } },
        { id: 8, a: { k: 2 } },
      ],
      ['a'],
    );
    // null and '' are both blank; everything else is its own group.
    expect(ids).toHaveLength(7);
  });

  it('tree paths ["a/b"] vs ["a", "b"] do not collide', () => {
    const rows = buildDisplayRows<{ id: number; path: string[] }>({
      rows: [
        { id: 1, path: ['a/b', 'leaf'] },
        { id: 2, path: ['a', 'b', 'leaf'] },
      ],
      rowId: (r) => r.id,
      columnsById: new Map(),
      collapsedGroupIds: new Set(),
      treeData: { getDataPath: (r) => r.path },
    });
    const ids = rows.filter((r) => r.kind === 'group').map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });

  it('grouped display rows use the same ids as collectAllGroupIds', () => {
    const rows: G[] = [
      { id: 1, a: 'x', b: 1 },
      { id: 2, a: 'y', b: 2 },
    ];
    const display = buildDisplayRows({
      rows,
      rowId: (r) => r.id,
      columnsById: byId,
      collapsedGroupIds: new Set(),
      rowGroup: { columns: ['a', 'b'] },
    });
    expect(display.filter((r) => r.kind === 'group').map((r) => r.id)).toEqual(groupIds(rows, ['a', 'b']));
  });
});
