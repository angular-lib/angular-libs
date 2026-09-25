import { describe, expect, it } from 'vitest';
import { defaultGridLocale, type FillEvent } from '@angular-libs/data-grid';
import { resolveFillTarget, runFill } from './cell-range.plugin';

interface Row {
  id: string;
  v: string;
  n: number;
}

const cols = ['id', 'v', 'n'];

function harness(rows: Row[]) {
  const columns = [
    { id: 'id', field: 'id' },
    { id: 'v', field: 'v', editable: true },
    { id: 'n', field: 'n', type: 'number', editable: true },
  ];
  const display = rows.map((row, i) => ({
    kind: 'data' as const,
    id: `d:${row.id}`,
    rowId: row.id,
    row,
    dataIndex: i,
    level: 0,
  }));
  const emitted: FillEvent<Row>[] = [];
  const context = {
    api: {
      getVisibleColumnIds: () => cols,
      getPagedDisplayRows: () => display,
      getColumnsById: () => new Map(columns.map((c) => [c.id, c])),
      getProcessedRows: () => rows,
      resolveRowId: (row: Row) => row.id,
      emitPaste: (event: FillEvent<Row>) => emitted.push(event),
      getLocale: () => defaultGridLocale,
    },
  } as never;
  return { context, emitted };
}

describe('resolveFillTarget', () => {
  const source = { anchor: { rowIndex: 5, columnId: 'v' }, active: { rowIndex: 7, columnId: 'v' } };

  it('extends along the dominant axis only', () => {
    expect(resolveFillTarget(source, { rowIndex: 9, columnId: 'n' }, cols)).toEqual({
      anchor: { rowIndex: 5, columnId: 'v' },
      active: { rowIndex: 9, columnId: 'v' },
    });
    expect(resolveFillTarget(source, { rowIndex: 6, columnId: 'n' }, cols)).toEqual({
      anchor: { rowIndex: 5, columnId: 'v' },
      active: { rowIndex: 7, columnId: 'n' },
    });
    expect(resolveFillTarget(source, { rowIndex: 3, columnId: 'v' }, cols)).toEqual({
      anchor: { rowIndex: 3, columnId: 'v' },
      active: { rowIndex: 7, columnId: 'v' },
    });
  });

  it('keeps a bottom-up selected source intact', () => {
    const upward = { anchor: { rowIndex: 7, columnId: 'v' }, active: { rowIndex: 5, columnId: 'v' } };
    expect(resolveFillTarget(upward, { rowIndex: 8, columnId: 'v' }, cols)).toEqual({
      anchor: { rowIndex: 5, columnId: 'v' },
      active: { rowIndex: 8, columnId: 'v' },
    });
  });
});

describe('runFill', () => {
  const rows = (): Row[] =>
    Array.from({ length: 10 }, (_, i) => ({ id: String(i), v: `r${i}`, n: i }));

  it('fills upward with the pattern phase aligned to the source and never rewrites it', () => {
    const data = rows();
    data[5]!.v = 'A';
    data[6]!.v = 'B';
    data[7]!.v = 'C';
    const { context, emitted } = harness(data);
    const source = { anchor: { rowIndex: 5, columnId: 'v' }, active: { rowIndex: 7, columnId: 'v' } };
    runFill(context, source, resolveFillTarget(source, { rowIndex: 3, columnId: 'v' }, cols));
    const out = emitted[0]!;
    expect(out.suggestedRows.slice(3, 8).map((r) => r.v)).toEqual(['B', 'C', 'A', 'B', 'C']);
    expect(out.targetRowIds).toEqual(['3', '4']);
    expect(out.matrix).toEqual([['B'], ['C']]);
  });

  it('fills downward from a bottom-up selection without losing the first source row', () => {
    const data = rows();
    const { context, emitted } = harness(data);
    const source = { anchor: { rowIndex: 2, columnId: 'v' }, active: { rowIndex: 1, columnId: 'v' } };
    runFill(context, source, resolveFillTarget(source, { rowIndex: 5, columnId: 'v' }, cols));
    expect(emitted[0]!.suggestedRows.slice(1, 6).map((r) => r.v)).toEqual(['r1', 'r2', 'r1', 'r2', 'r1']);
  });

  it('skips read-only columns and parses across columns', () => {
    const data = rows();
    const { context, emitted } = harness(data);
    // Fill `v` (text) rightward into `n` (number): "r0" is not a number → reported, not written.
    const source = { anchor: { rowIndex: 0, columnId: 'v' }, active: { rowIndex: 0, columnId: 'v' } };
    runFill(context, source, resolveFillTarget(source, { rowIndex: 0, columnId: 'n' }, cols));
    const out = emitted[0]!;
    expect(out.suggestedRows[0]!.n).toBe(0);
    expect(out.invalidCells.map((c) => c.columnId)).toEqual(['n']);

    // Leftward into read-only `id` → skipped.
    runFill(context, source, resolveFillTarget(source, { rowIndex: 0, columnId: 'id' }, cols));
    expect(emitted[1]!.suggestedRows[0]!.id).toBe('0');
  });
});
