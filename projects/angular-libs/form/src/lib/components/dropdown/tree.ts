import type { FormSelectTreeOptions } from '../../types';
import {
  type DropdownItem,
  getChildrenOf,
  getItemKey,
  getSearchableText,
  itemMatchesTerms,
  normalizeSearchTerms,
} from './dropdown-utils';

export interface FlatTreeNode {
  item: DropdownItem;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  key: string;
}

function keyOf(item: DropdownItem, valueKey: string): string {
  return String(getItemKey(item, valueKey));
}

export function collectAllKeys(
  items: readonly DropdownItem[],
  valueKey: string,
  tree: FormSelectTreeOptions & { enabled: boolean },
): Set<string> {
  const keys = new Set<string>();
  const walk = (list: readonly DropdownItem[]) => {
    for (const item of list) {
      keys.add(keyOf(item, valueKey));
      walk(getChildrenOf(item, tree));
    }
  };
  walk(items);
  return keys;
}

export function findAncestorKeys(
  items: readonly DropdownItem[],
  valueKey: string,
  selectedKeys: ReadonlySet<unknown>,
  tree: FormSelectTreeOptions & { enabled: boolean },
): Set<string> {
  const ancestors = new Set<string>();
  const walk = (list: readonly DropdownItem[], path: string[]): boolean => {
    let found = false;
    for (const item of list) {
      const k = keyOf(item, valueKey);
      const selfSelected = selectedKeys.has(getItemKey(item, valueKey));
      const childFound = walk(getChildrenOf(item, tree), [...path, k]);
      if (selfSelected || childFound) {
        for (const a of path) {
          ancestors.add(a);
        }
        found = true;
      }
    }
    return found;
  };
  walk(items, []);
  return ancestors;
}

export function flattenVisibleTree(
  items: readonly DropdownItem[],
  valueKey: string,
  expandedIds: ReadonlySet<string>,
  tree: FormSelectTreeOptions & { enabled: boolean },
  searchTerm: string | undefined | null,
  labelKeys: string[],
): FlatTreeNode[] {
  if (!tree.enabled) {
    return items.map((item) => ({
      item,
      depth: 0,
      hasChildren: false,
      expanded: false,
      key: keyOf(item, valueKey),
    }));
  }

  const out: FlatTreeNode[] = [];
  const terms = normalizeSearchTerms(searchTerm);
  if (terms.length) {
    flattenWithSearch(items, 0, out, valueKey, labelKeys, terms, tree, expandedIds);
  } else {
    flattenExpanded(items, 0, out, valueKey, tree, expandedIds);
  }
  return out;
}

function flattenExpanded(
  list: readonly DropdownItem[],
  depth: number,
  out: FlatTreeNode[],
  valueKey: string,
  tree: FormSelectTreeOptions & { enabled: boolean },
  expandedIds: ReadonlySet<string>,
): void {
  for (const item of list) {
    const kids = getChildrenOf(item, tree);
    const hasChildren = kids.length > 0;
    const k = keyOf(item, valueKey);
    const expanded = hasChildren && expandedIds.has(k);
    out.push({ item, depth, hasChildren, expanded, key: k });
    if (expanded) {
      flattenExpanded(kids, depth + 1, out, valueKey, tree, expandedIds);
    }
  }
}

function flattenWithSearch(
  list: readonly DropdownItem[],
  depth: number,
  out: FlatTreeNode[],
  valueKey: string,
  labelKeys: string[],
  terms: string[],
  tree: FormSelectTreeOptions & { enabled: boolean },
  expandedIds: ReadonlySet<string>,
): void {
  for (const item of list) {
    const kids = getChildrenOf(item, tree);
    const hasChildren = kids.length > 0;
    const selfMatch = itemMatchesTerms(getSearchableText(item, labelKeys), terms);
    const childOut: FlatTreeNode[] = [];
    if (hasChildren) {
      flattenWithSearch(kids, depth + 1, childOut, valueKey, labelKeys, terms, tree, expandedIds);
    }
    const descendantMatch = childOut.length > 0;
    if (!selfMatch && !descendantMatch) {
      continue;
    }
    const k = keyOf(item, valueKey);
    const expanded = hasChildren && (descendantMatch || expandedIds.has(k));
    out.push({ item, depth, hasChildren, expanded, key: k });
    if (expanded) {
      out.push(...childOut);
    }
  }
}

export function collectDescendantKeys(
  item: DropdownItem,
  valueKey: string,
  tree: FormSelectTreeOptions & { enabled: boolean },
): unknown[] {
  const keys: unknown[] = [];
  const walk = (nodes: readonly DropdownItem[]) => {
    for (const n of nodes) {
      keys.push(getItemKey(n, valueKey));
      walk(getChildrenOf(n, tree));
    }
  };
  walk(getChildrenOf(item, tree));
  return keys;
}

export function initialExpandedIds(
  items: readonly DropdownItem[],
  valueKey: string,
  selectedKeys: ReadonlySet<unknown>,
  tree: FormSelectTreeOptions & { enabled: boolean },
): Set<string> {
  if (!tree.enabled) {
    return new Set();
  }
  const mode = tree.defaultExpanded ?? 'selected-ancestors';
  if (mode === 'none') {
    return new Set();
  }
  if (mode === 'all') {
    return collectAllKeys(items, valueKey, tree);
  }
  return findAncestorKeys(items, valueKey, selectedKeys, tree);
}
