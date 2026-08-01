export type DropdownNavRow = {
  disabled?: boolean;
  isGroupHeader?: boolean;
  isCreateRow?: boolean;
};

/**
 * Move focus index skipping disabled / group headers.
 * Returns new index, or -1 if none.
 */
export function moveFocusIndex(
  rows: readonly DropdownNavRow[],
  from: number,
  direction: 1 | -1,
): number {
  if (!rows.length) {
    return -1;
  }
  let i = from;
  for (let step = 0; step < rows.length; step++) {
    i += direction;
    if (i < 0) {
      i = rows.length - 1;
    } else if (i >= rows.length) {
      i = 0;
    }
    const row = rows[i];
    if (!row.isGroupHeader && !row.disabled) {
      return i;
    }
  }
  return -1;
}

export function firstFocusableIndex(rows: readonly DropdownNavRow[]): number {
  return moveFocusIndex(rows, -1, 1);
}
