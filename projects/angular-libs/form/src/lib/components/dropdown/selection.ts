import type { DropdownItem } from './dropdown-utils';
import { getItemKey } from './dropdown-utils';

export function rowKey(row: unknown, valueKey: string): unknown {
  if (row && typeof row === 'object' && valueKey in (row as object)) {
    return (row as DropdownItem)[valueKey];
  }
  return row;
}

export function normalizeIds(
  current: unknown,
  mode: 'id' | 'object',
  valueKey: string,
): unknown[] {
  if (!Array.isArray(current)) {
    return [];
  }
  if (mode === 'object') {
    return current.map((r) => rowKey(r, valueKey));
  }
  return [...current];
}

export function isItemSelected(
  item: DropdownItem,
  fieldValue: unknown,
  valueKey: string,
  multiple: boolean,
  valueMode: 'id' | 'object',
): boolean {
  const key = getItemKey(item, valueKey);
  if (valueMode === 'object') {
    if (multiple) {
      return Array.isArray(fieldValue) && fieldValue.some((row) => rowKey(row, valueKey) === key);
    }
    return rowKey(fieldValue, valueKey) === key;
  }
  if (multiple) {
    return Array.isArray(fieldValue) && fieldValue.includes(key);
  }
  return fieldValue === key;
}

export function mergeDisplayRows(
  nextIds: unknown[],
  toggled: DropdownItem,
  toggledId: unknown,
  valueKey: string,
  existingDisplay: readonly unknown[],
): DropdownItem[] {
  const existing = existingDisplay.filter((row) =>
    nextIds.includes((row as DropdownItem)[valueKey]),
  ) as DropdownItem[];
  const hasToggled = nextIds.includes(toggledId);
  const without = existing.filter((row) => row[valueKey] !== toggledId);
  return hasToggled ? [...without, toggled] : without;
}

/** Closed-UI rows: object mode reads the field; id mode uses seeded selectionDisplay. */
export function resolveDisplayRows(
  valueMode: 'id' | 'object',
  fieldValue: unknown,
  multiple: boolean,
  seeded: readonly unknown[] | undefined,
): DropdownItem[] {
  if (valueMode === 'object') {
    if (multiple) {
      return Array.isArray(fieldValue) ? (fieldValue as DropdownItem[]) : [];
    }
    if (fieldValue != null && typeof fieldValue === 'object') {
      return [fieldValue as DropdownItem];
    }
    return [];
  }
  return Array.isArray(seeded) ? ([...seeded] as DropdownItem[]) : [];
}

export function resolveEmptyValue(
  emptyValue: unknown | undefined,
  current: unknown,
): unknown {
  if (emptyValue !== undefined) {
    return emptyValue;
  }
  if (typeof current === 'string') {
    return '';
  }
  if (typeof current === 'number') {
    return 0;
  }
  return null;
}
