import type { FormSelectCreatableOptions } from '../../types';
import type { DropdownItem } from './dropdown-utils';
import { formatItemLabel, resolveCreatable } from './dropdown-utils';
import { hasExactLabelMatch } from './search';

export interface CreateEligibility {
  show: boolean;
  term: string;
  error: string | null;
}

export function getCreateEligibility(
  creatable: boolean | FormSelectCreatableOptions | undefined,
  searchTerm: string | undefined | null,
  items: readonly DropdownItem[],
  labelKeys: string[],
  valueMode: 'id' | 'object',
): CreateEligibility {
  const cfg = resolveCreatable(creatable);
  const term = (searchTerm ?? '').trim();
  if (!cfg.enabled || !term) {
    return { show: false, term, error: null };
  }
  if (hasExactLabelMatch(items, term, labelKeys)) {
    return { show: false, term, error: null };
  }
  // S2 without onCreate is not allowed
  if (valueMode === 'id' && !cfg.onCreate) {
    return {
      show: false,
      term,
      error: 'creatable with valueMode "id" requires onCreate',
    };
  }
  if (cfg.validate) {
    const result = cfg.validate(term);
    if (result === false) {
      return { show: false, term, error: 'Invalid value' };
    }
    if (typeof result === 'string') {
      return { show: false, term, error: result };
    }
  }
  return { show: true, term, error: null };
}

export async function createItemFromTerm(
  creatable: boolean | FormSelectCreatableOptions | undefined,
  term: string,
  valueKey: string,
  labelKeys: string[],
): Promise<DropdownItem | null> {
  const cfg = resolveCreatable(creatable);
  if (!cfg.enabled) {
    return null;
  }
  const trimmed = term.trim();
  if (!trimmed) {
    return null;
  }
  if (cfg.onCreate) {
    return await cfg.onCreate(trimmed);
  }
  const labelKey = labelKeys[0] ?? 'label';
  return {
    [valueKey]: trimmed,
    [labelKey]: trimmed,
  };
}

export function createRowLabel(term: string, createText?: string): string {
  const prefix = createText?.trim() || 'Create';
  return `${prefix} "${term}"`;
}

export function formatChipLabel(item: DropdownItem, labelKeys: string[]): string {
  return formatItemLabel(item, labelKeys) || String(Object.values(item)[0] ?? '');
}
