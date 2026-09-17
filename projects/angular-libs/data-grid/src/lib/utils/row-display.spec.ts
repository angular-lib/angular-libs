import {
  countDisplayedDataRows,
  countPaginationSlots,
  pageIndexForDisplayIndex,
  paginateDisplayRows,
  paginationSlotIndex,
  stepDisplayIndexSkippingPlugins,
  wrapDataRows,
  type DisplayRow,
} from './row-display';

interface Row {
  id: number;
  name: string;
}

function withDetail(rows: Row[], openIds: readonly number[]): DisplayRow<Row>[] {
  const out: DisplayRow<Row>[] = [];
  for (const data of wrapDataRows(rows, (r) => r.id)) {
    out.push(data);
    if (data.kind === 'data' && openIds.includes(data.row.id)) {
      out.push({
        kind: 'plugin',
        pluginKind: 'masterDetail',
        id: `md:${data.row.id}`,
        height: 160,
      });
    }
  }
  return out;
}

describe('pagination slot helpers', () => {
  const people: Row[] = [
    { id: 1, name: 'Mila' },
    { id: 2, name: 'Noah' },
    { id: 3, name: 'Olivia' },
    { id: 4, name: 'Eve' },
  ];

  it('does not count detail panels as page slots', () => {
    const rows = withDetail(people, [1]);
    expect(rows).toHaveLength(5);
    expect(countDisplayedDataRows(rows)).toBe(4);
    expect(countPaginationSlots(rows)).toBe(4);
    expect(paginationSlotIndex(rows, 0)).toBe(0);
    expect(paginationSlotIndex(rows, 1)).toBe(0);
    expect(paginationSlotIndex(rows, 2)).toBe(1);
  });

  it('keeps an open detail with its master on the same page', () => {
    const rows = withDetail(people, [1]);
    const page0 = paginateDisplayRows(rows, 0, 2);
    expect(page0.map((r) => r.id)).toEqual(['d:1', 'md:1', 'd:2']);
    const page1 = paginateDisplayRows(rows, 1, 2);
    expect(page1.map((r) => r.id)).toEqual(['d:3', 'd:4']);
    expect(pageIndexForDisplayIndex(rows, 1, 2)).toBe(0);
    expect(pageIndexForDisplayIndex(rows, 4, 2)).toBe(1);
  });

  it('steps range/focus over plugin rows', () => {
    const rows = withDetail(people, [1]);
    expect(stepDisplayIndexSkippingPlugins(rows, 0, 1)).toBe(2);
    expect(stepDisplayIndexSkippingPlugins(rows, 2, -1)).toBe(0);
    expect(stepDisplayIndexSkippingPlugins(rows, 2, 1)).toBe(3);
  });
});
