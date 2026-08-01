import type { FormDropdownColumn } from '../../types';
import {
  type DropdownItem,
  getSearchableText,
  itemMatchesTerms,
  normalizeSearchTerms,
} from './dropdown-utils';

export function filterItemsBySearch(
  items: readonly DropdownItem[],
  searchTerm: string | undefined | null,
  labelKeys: string[],
  columns?: readonly FormDropdownColumn[],
  disableFiltering = false,
): DropdownItem[] {
  if (disableFiltering) {
    return [...items];
  }
  const terms = normalizeSearchTerms(searchTerm);
  if (!terms.length) {
    return [...items];
  }
  return items.filter((item) =>
    itemMatchesTerms(getSearchableText(item, labelKeys, columns), terms),
  );
}

export function hasExactLabelMatch(
  items: readonly DropdownItem[],
  term: string,
  labelKeys: string[],
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle || !labelKeys.length) {
    return false;
  }
  const primary = labelKeys[0];
  return items.some((item) => String(item[primary] ?? '').trim().toLowerCase() === needle);
}

/** Apply groupBy: insert non-selectable header rows (synthetic). */
export function applyGrouping(
  items: readonly DropdownItem[],
  groupBy: string | ((item: DropdownItem) => string) | undefined,
): Array<DropdownItem & { __groupHeader?: boolean; __groupLabel?: string }> {
  if (!groupBy) {
    return items.map((i) => ({ ...i }));
  }
  const getLabel =
    typeof groupBy === 'function' ? groupBy : (item: DropdownItem) => String(item[groupBy] ?? '');
  const out: Array<DropdownItem & { __groupHeader?: boolean; __groupLabel?: string }> = [];
  let last = '';
  for (const item of items) {
    const label = getLabel(item);
    if (label !== last) {
      out.push({
        __groupHeader: true,
        __groupLabel: label,
        [Symbol.for('al-group')]: label,
      } as DropdownItem & { __groupHeader?: boolean; __groupLabel?: string });
      last = label;
    }
    out.push(item);
  }
  return out;
}

export function isGroupHeader(item: DropdownItem): boolean {
  return !!(item as { __groupHeader?: boolean }).__groupHeader;
}

export function groupHeaderLabel(item: DropdownItem): string {
  return String((item as { __groupLabel?: string }).__groupLabel ?? '');
}
