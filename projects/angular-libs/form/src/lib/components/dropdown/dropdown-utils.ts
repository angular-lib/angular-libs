import type { FormDropdownColumn, FormSelectTreeOptions } from '../../types';

export type DropdownItem = Record<string, unknown>;

export function getItemKey(item: DropdownItem, valueKey: string): unknown {
  return item[valueKey];
}

export function formatItemLabel(item: DropdownItem, labelKeys: string[]): string {
  return labelKeys
    .map((k) => item?.[k])
    .filter((v) => v != null && v !== '')
    .join(' — ');
}

export function getPropByPath(obj: unknown, path: string): unknown {
  if (!path || obj == null || typeof obj !== 'object') {
    return undefined;
  }
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function getSearchableText(
  item: DropdownItem,
  labelKeys: string[],
  columns?: readonly FormDropdownColumn[],
): string {
  if (columns?.length) {
    const parts: string[] = [];
    for (const col of columns) {
      if (col.hide || col.ignoreInSearch) {
        continue;
      }
      if (col.valueGetter) {
        parts.push(String(col.valueGetter(item) ?? ''));
      } else if (col.field) {
        parts.push(String(getPropByPath(item, col.field) ?? ''));
      }
    }
    if (parts.some((p) => p.trim())) {
      return parts.join(' ');
    }
  }
  return formatItemLabel(item, labelKeys);
}

export function normalizeSearchTerms(term: string | undefined | null): string[] {
  if (!term?.trim()) {
    return [];
  }
  return term
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function itemMatchesTerms(text: string, terms: string[]): boolean {
  if (!terms.length) {
    return true;
  }
  const lower = text.toLowerCase();
  return terms.every((t) => lower.includes(t));
}

/** Split text into highlight segments (safe for text interpolation). */
export function highlightSearchParts(
  text: string,
  term: string | undefined | null,
): Array<{ text: string; hit: boolean }> {
  const terms = normalizeSearchTerms(term);
  if (!terms.length || !text) {
    return [{ text, hit: false }];
  }
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');
  const parts: Array<{ text: string; hit: boolean }> = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ text: text.slice(last, index), hit: false });
    }
    parts.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), hit: false });
  }
  return parts.length ? parts : [{ text, hit: false }];
}

/** @deprecated Prefer highlightSearchParts for templates. */
export function highlightSearchHtml(text: string, term: string | undefined | null): string {
  const escaped = escapeHtml(text);
  const terms = normalizeSearchTerms(term);
  if (!terms.length) {
    return escaped;
  }
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveCreatable(
  creatable: boolean | { onCreate?: unknown; createOnBlur?: boolean; createOnComma?: boolean; validate?: unknown } | undefined,
): {
  enabled: boolean;
  createOnBlur: boolean;
  createOnComma: boolean;
  validate?: (term: string) => boolean | string;
  onCreate?: (term: string) => Promise<DropdownItem> | DropdownItem;
} {
  if (!creatable) {
    return { enabled: false, createOnBlur: false, createOnComma: false };
  }
  if (creatable === true) {
    return { enabled: true, createOnBlur: false, createOnComma: true };
  }
  return {
    enabled: true,
    createOnBlur: !!creatable.createOnBlur,
    createOnComma: creatable.createOnComma !== false,
    validate: creatable.validate as ((term: string) => boolean | string) | undefined,
    onCreate: creatable.onCreate as
      | ((term: string) => Promise<DropdownItem> | DropdownItem)
      | undefined,
  };
}

export function resolveTree(
  tree: boolean | FormSelectTreeOptions | undefined,
): FormSelectTreeOptions & { enabled: boolean } {
  if (!tree) {
    return { enabled: false };
  }
  if (tree === true) {
    return {
      enabled: true,
      childrenKey: 'children',
      defaultExpanded: 'selected-ancestors',
      selectDescendants: false,
    };
  }
  return {
    enabled: true,
    childrenKey: tree.childrenKey ?? 'children',
    getChildren: tree.getChildren,
    defaultExpanded: tree.defaultExpanded ?? 'selected-ancestors',
    selectDescendants: !!tree.selectDescendants,
  };
}

export function getChildrenOf(
  item: DropdownItem,
  opts: FormSelectTreeOptions & { enabled: boolean },
): readonly DropdownItem[] {
  if (!opts.enabled) {
    return [];
  }
  if (opts.getChildren) {
    return opts.getChildren(item) ?? [];
  }
  const key = opts.childrenKey ?? 'children';
  const kids = item[key];
  return Array.isArray(kids) ? (kids as DropdownItem[]) : [];
}
