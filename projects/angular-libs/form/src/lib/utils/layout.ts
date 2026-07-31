import type { FormElement, FormResponsiveWidth, FormWidth } from '../types';
import { FORM_LAYOUT_BREAKPOINTS } from './layout-breakpoints';

export { FORM_LAYOUT_BREAKPOINTS } from './layout-breakpoints';

export function parseFormWidth(width: string | undefined): string | null {
  if (!width) {
    return null;
  }
  const trimmed = width.trim();
  if (!trimmed || trimmed === 'auto') {
    return trimmed || null;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}%`;
  }
  return trimmed;
}

export function normalizeResponsiveWidth(width: FormWidth | undefined): FormResponsiveWidth | null {
  if (!width) {
    return null;
  }
  if (typeof width === 'string') {
    const xs = parseFormWidth(width);
    return xs ? { xs } : null;
  }
  return {
    xs: parseFormWidth(width.xs) ?? undefined,
    sm: parseFormWidth(width.sm) ?? undefined,
    md: parseFormWidth(width.md) ?? undefined,
    lg: parseFormWidth(width.lg) ?? undefined,
  };
}

function firstDefined(
  map: FormResponsiveWidth,
  keys: readonly (keyof FormResponsiveWidth)[],
): string | null {
  for (const key of keys) {
    const value = map[key];
    if (value) {
      return value;
    }
  }
  return null;
}

/**
 * Resolve the effective CSS width for a container size (JS fallback / tests).
 * Missing smaller breakpoints fall back to `100%` so `{ sm: '50%' }` stacks on xs.
 */
export function resolveWidthForContainer(
  width: FormWidth | undefined,
  containerPx: number,
): string | null {
  const map = normalizeResponsiveWidth(width);
  if (!map) {
    return null;
  }

  if (containerPx >= FORM_LAYOUT_BREAKPOINTS.lg) {
    return firstDefined(map, ['lg', 'md', 'sm', 'xs']);
  }
  if (containerPx >= FORM_LAYOUT_BREAKPOINTS.md) {
    return firstDefined(map, ['md', 'sm', 'xs']);
  }
  if (containerPx >= FORM_LAYOUT_BREAKPOINTS.sm) {
    return firstDefined(map, ['sm', 'xs']) ?? '100%';
  }
  return firstDefined(map, ['xs']) ?? '100%';
}

/** CSS custom properties consumed by `AlFormItem` container-query rules. */
export function widthToCssVars(width: FormWidth | undefined): {
  xs: string | null;
  sm: string | null;
  md: string | null;
  lg: string | null;
} {
  const map = normalizeResponsiveWidth(width);
  if (!map) {
    return { xs: null, sm: null, md: null, lg: null };
  }
  return {
    xs: map.xs ?? null,
    sm: map.sm ?? null,
    md: map.md ?? null,
    lg: map.lg ?? null,
  };
}

/** Default flex grow/shrink when width is unset vs set. */
export function resolveFlexGrow(el: Pick<FormElement, 'type' | 'width' | 'flex'>): string {
  if (el.type === 'line-break') {
    return '0';
  }
  if (el.flex !== undefined && el.flex !== null) {
    const parts = String(el.flex).trim().split(/\s+/);
    return parts[0] ?? '0';
  }
  return el.width ? '0' : '1';
}

export function resolveFlexShrink(el: Pick<FormElement, 'type' | 'width' | 'flex'>): string {
  if (el.type === 'line-break') {
    return '0';
  }
  if (el.flex !== undefined && el.flex !== null) {
    const parts = String(el.flex).trim().split(/\s+/);
    return parts[1] ?? '1';
  }
  return el.width ? '0' : '1';
}

/** @deprecated Prefer resolveFlexGrow/Shrink + CSS vars. Kept for tests / callers. */
export function resolveFlexStyle(el: Pick<FormElement, 'type' | 'width' | 'flex'>): string | null {
  if (el.type === 'line-break') {
    return null;
  }
  if (el.flex !== undefined && el.flex !== null) {
    return `${el.flex}`;
  }
  return el.width ? '0 0 auto' : '1';
}
