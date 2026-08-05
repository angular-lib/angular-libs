/**
 * Immutable batch row updates — host/controller owned data (OVERVIEW §5a).
 * Match update/remove by `rowId` only (no object-reference matching).
 */

export interface RowTransaction<T> {
  add?: readonly T[];
  /** Insert `add` at this index in the source array (clamped). Default: append. */
  addIndex?: number;
  /** Full or partial rows matched by `rowId`. */
  update?: readonly T[];
  /** Rows matched by `rowId` (id-only objects are enough when rowId reads that field). */
  remove?: readonly T[];
}

export interface RowTransactionResult<T> {
  rows: T[];
  added: T[];
  updated: T[];
  removed: T[];
}

/**
 * Apply an add/update/remove transaction immutably.
 *
 * @example
 * ```ts
 * rows.set(applyRowTransaction(rows(), {
 *   add: [{ id: '4', name: 'Billy' }],
 *   update: [{ id: '2', name: 'Bob' }],
 *   remove: [{ id: '5' }],
 * }, (r) => r.id).rows);
 * ```
 */
export function applyRowTransaction<T>(
  rows: readonly T[],
  tx: RowTransaction<T>,
  rowId: (row: T, index: number) => string | number,
): RowTransactionResult<T> {
  const removeIds = new Set<string | number>();
  for (const row of tx.remove ?? []) {
    // Prefer id from the remove payload at index 0 of a synthetic list position.
    removeIds.add(rowId(row, -1));
  }

  const updateById = new Map<string | number, T>();
  for (const row of tx.update ?? []) {
    updateById.set(rowId(row, -1), row);
  }

  const removed: T[] = [];
  const updated: T[] = [];
  const next: T[] = [];

  rows.forEach((row, index) => {
    const id = rowId(row, index);
    if (removeIds.has(id)) {
      removed.push(row);
      return;
    }
    const patch = updateById.get(id);
    if (patch !== undefined) {
      const merged = { ...(row as object), ...(patch as object) } as T;
      next.push(merged);
      updated.push(merged);
      return;
    }
    next.push(row);
  });

  const added = [...(tx.add ?? [])];
  if (added.length) {
    const at =
      tx.addIndex === undefined
        ? next.length
        : Math.max(0, Math.min(tx.addIndex, next.length));
    next.splice(at, 0, ...added);
  }

  return { rows: next, added, updated, removed };
}
