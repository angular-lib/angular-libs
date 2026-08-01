import { describe, expect, it, vi } from 'vitest';
import { createItemFromTerm, getCreateEligibility } from './create';
import { createDatasourceController } from './datasource';
import {
  formatItemLabel,
  getItemKey,
  highlightSearchParts,
  resolveCreatable,
  resolveTree,
} from './dropdown-utils';
import { firstFocusableIndex, moveFocusIndex } from './keyboard';
import {
  applyGrouping,
  filterItemsBySearch,
  hasExactLabelMatch,
  isGroupHeader,
} from './search';
import {
  isItemSelected,
  mergeDisplayRows,
  normalizeIds,
  resolveEmptyValue,
} from './selection';
import {
  collectDescendantKeys,
  flattenVisibleTree,
  initialExpandedIds,
} from './tree';

describe('dropdown-utils', () => {
  it('formats labels and keys', () => {
    const item = { id: 1, name: 'Admin', code: 'A' };
    expect(formatItemLabel(item, ['name', 'code'])).toBe('Admin — A');
    expect(getItemKey(item, 'id')).toBe(1);
  });

  it('highlights search parts', () => {
    const parts = highlightSearchParts('Hello World', 'wor');
    expect(parts.some((p) => p.hit && p.text.toLowerCase() === 'wor')).toBe(true);
  });

  it('resolves creatable and tree flags', () => {
    expect(resolveCreatable(true).enabled).toBe(true);
    expect(resolveCreatable(undefined).enabled).toBe(false);
    expect(resolveTree(true).childrenKey).toBe('children');
    expect(resolveTree({ childrenKey: 'nodes' }).childrenKey).toBe('nodes');
  });
});

describe('search', () => {
  const items = [
    { id: 1, name: 'Alpha', group: 'A' },
    { id: 2, name: 'Beta', group: 'B' },
    { id: 3, name: 'Alpine', group: 'A' },
  ];

  it('filters with multi-term AND', () => {
    expect(filterItemsBySearch(items, 'al', ['name']).map((i) => i['id'])).toEqual([1, 3]);
    expect(filterItemsBySearch(items, 'al be', ['name'])).toEqual([]);
  });

  it('detects exact label match', () => {
    expect(hasExactLabelMatch(items, 'Beta', ['name'])).toBe(true);
    expect(hasExactLabelMatch(items, 'bet', ['name'])).toBe(false);
  });

  it('applies group headers', () => {
    const sorted = [
      { id: 1, name: 'Alpha', group: 'A' },
      { id: 3, name: 'Alpine', group: 'A' },
      { id: 2, name: 'Beta', group: 'B' },
    ];
    const grouped = applyGrouping(sorted, 'group');
    expect(grouped.filter(isGroupHeader)).toHaveLength(2);
  });
});

describe('selection', () => {
  it('normalizes ids and selection checks', () => {
    expect(normalizeIds([1, 2], 'id', 'id')).toEqual([1, 2]);
    expect(normalizeIds([{ id: 1 }, { id: 2 }], 'object', 'id')).toEqual([1, 2]);
    expect(isItemSelected({ id: 1 }, 1, 'id', false, 'id')).toBe(true);
    expect(isItemSelected({ id: 1 }, [1, 2], 'id', true, 'id')).toBe(true);
  });

  it('merges display rows and empty values', () => {
    expect(mergeDisplayRows([1, 2], { id: 2, name: 'B' }, 2, 'id', [{ id: 1, name: 'A' }])).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
    expect(resolveEmptyValue(undefined, 5)).toBe(0);
    expect(resolveEmptyValue(undefined, 'x')).toBe('');
    expect(resolveEmptyValue(-1, 5)).toBe(-1);
  });
});

describe('keyboard', () => {
  it('skips disabled and group headers', () => {
    const rows = [
      { isGroupHeader: true },
      { disabled: true },
      { disabled: false },
      { disabled: false },
    ];
    expect(firstFocusableIndex(rows)).toBe(2);
    expect(moveFocusIndex(rows, 2, 1)).toBe(3);
    expect(moveFocusIndex(rows, 3, 1)).toBe(2);
  });
});

describe('create', () => {
  it('requires onCreate for S2 id mode', () => {
    const blocked = getCreateEligibility(true, 'New', [], ['name'], 'id');
    expect(blocked.show).toBe(false);

    const ok = getCreateEligibility(
      { onCreate: (term) => ({ id: 99, name: term }) },
      'New',
      [],
      ['name'],
      'id',
    );
    expect(ok.show).toBe(true);
  });

  it('allows object-mode create without onCreate', async () => {
    const el = getCreateEligibility(true, 'Tag', [], ['name'], 'object');
    expect(el.show).toBe(true);
    const item = await createItemFromTerm(true, 'Tag', 'id', ['name']);
    expect(item).toEqual({ id: 'Tag', name: 'Tag' });
  });

  it('hides create when exact match exists', () => {
    expect(
      getCreateEligibility(true, 'Alpha', [{ id: 1, name: 'Alpha' }], ['name'], 'object').show,
    ).toBe(false);
  });
});

describe('tree', () => {
  const treeItems = [
    {
      id: 1,
      name: 'Root',
      children: [
        { id: 2, name: 'Child', children: [{ id: 3, name: 'Leaf' }] },
        { id: 4, name: 'Other' },
      ],
    },
  ];
  const tree = resolveTree(true);

  it('flattens expanded nodes', () => {
    const flat = flattenVisibleTree(treeItems, 'id', new Set(['1']), tree, '', ['name']);
    expect(flat.map((n) => n.key)).toEqual(['1', '2', '4']);
  });

  it('keeps ancestors when searching', () => {
    const flat = flattenVisibleTree(treeItems, 'id', new Set(), tree, 'Leaf', ['name']);
    expect(flat.map((n) => n.item['name'])).toEqual(['Root', 'Child', 'Leaf']);
  });

  it('collects descendants and initial expanded', () => {
    expect(collectDescendantKeys(treeItems[0], 'id', tree)).toEqual([2, 3, 4]);
    const expanded = initialExpandedIds(treeItems, 'id', new Set([3]), tree);
    expect(expanded.has('1')).toBe(true);
    expect(expanded.has('2')).toBe(true);
  });
});

describe('datasource', () => {
  it('pages with loader and abort-safe reset', async () => {
    const pages: Record<string, unknown>[][] = [
      [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ],
      [{ id: 3, name: 'c' }],
    ];
    let call = 0;
    const onItems = vi.fn();
    const ctrl = createDatasourceController(
      {
        chunkSize: 2,
        debounceMs: 0,
        loader: async ({ startRow }) => {
          const idx = startRow === 0 ? 0 : 1;
          call++;
          return pages[idx] ?? [];
        },
      },
      onItems,
      vi.fn(),
      vi.fn(),
    );
    ctrl.reset('');
    await vi.waitFor(() => expect(onItems).toHaveBeenCalled());
    expect(ctrl.items()).toHaveLength(2);
    await ctrl.loadNext();
    expect(ctrl.items()).toHaveLength(3);
    expect(call).toBeGreaterThanOrEqual(2);
    ctrl.destroy();
  });
});
