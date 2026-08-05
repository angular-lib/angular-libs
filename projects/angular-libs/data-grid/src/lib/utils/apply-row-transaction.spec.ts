import { describe, expect, it } from 'vitest';
import { applyRowTransaction } from './apply-row-transaction';

interface Emp {
  id: string;
  name: string;
  role?: string;
}

const idOf = (r: Emp) => r.id;

describe('applyRowTransaction', () => {
  const rows: Emp[] = [
    { id: '1', name: 'Ada', role: 'Eng' },
    { id: '2', name: 'Bob', role: 'PM' },
    { id: '3', name: 'Cyd', role: 'Des' },
  ];

  it('updates by rowId and merges fields', () => {
    const result = applyRowTransaction(
      rows,
      { update: [{ id: '2', name: 'Bobby' }] },
      idOf,
    );
    expect(result.updated).toHaveLength(1);
    expect(result.rows[1]).toEqual({ id: '2', name: 'Bobby', role: 'PM' });
    expect(rows[1]!.name).toBe('Bob');
  });

  it('removes by id-only payload', () => {
    const result = applyRowTransaction(rows, { remove: [{ id: '2' } as Emp] }, idOf);
    expect(result.removed.map((r) => r.id)).toEqual(['2']);
    expect(result.rows.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('appends adds by default', () => {
    const result = applyRowTransaction(
      rows,
      { add: [{ id: '4', name: 'Dee' }] },
      idOf,
    );
    expect(result.added).toHaveLength(1);
    expect(result.rows.map((r) => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('inserts adds at addIndex', () => {
    const result = applyRowTransaction(
      rows,
      { add: [{ id: '0', name: 'Zip' }], addIndex: 1 },
      idOf,
    );
    expect(result.rows.map((r) => r.id)).toEqual(['1', '0', '2', '3']);
  });

  it('applies remove then update then add in one pass', () => {
    const result = applyRowTransaction(
      rows,
      {
        remove: [{ id: '3' } as Emp],
        update: [{ id: '1', name: 'Augusta' }],
        add: [{ id: '9', name: 'Neo' }],
        addIndex: 0,
      },
      idOf,
    );
    expect(result.rows.map((r) => r.id)).toEqual(['9', '1', '2']);
    expect(result.rows[1]!.name).toBe('Augusta');
  });
});
