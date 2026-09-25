import type {
  ColumnPin,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  SortState,
} from '../components/data-grid/data-grid.types';

/** Current {@link DataGridState} schema version. */
export const GRID_STATE_VERSION = 1 as const;

export function createEmptyGridState(): DataGridState {
  return {
    version: GRID_STATE_VERSION,
    sorts: [],
    filters: {},
    quickFilter: '',
    hiddenColumnIds: [],
    columnOrder: [],
    widthOverrides: {},
    columnPins: {},
    pageIndex: 0,
    pageSize: 25,
    selectedIds: [],
    activeSidePanel: null,
    slices: {},
  };
}

/**
 * Validation hook for one column's value inside `DataGridState.filters`.
 * The state layer treats the filter model as opaque per-column values; this is
 * the only place that knows their shape (update it with the filter model).
 */
export function isValidFilterValue(value: unknown): value is DataGridFilterState[string] {
  return typeof value === 'string' && value !== '';
}

export function serializeGridState(state: DataGridState): string {
  return JSON.stringify(state);
}

/**
 * Parse a persisted snapshot (JSON). Returns only the valid fields (older
 * versions migrated), or `null` for non-JSON / non-object / unsupported-version
 * input. Pass the result to `api.setState` / `createGrid({ initialState })` —
 * ids of columns the grid does not have are dropped there.
 */
export function parseGridState(raw: string): Partial<DataGridState> | null {
  try {
    return migrateGridState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Validate + upgrade an untrusted snapshot object to the current version.
 * v0 (no `version`) → v1. Unknown (future) versions → `null`.
 */
export function migrateGridState(input: unknown): Partial<DataGridState> | null {
  if (!isPlainObject(input)) {
    return null;
  }
  const version = input['version'];
  if (version !== undefined && version !== GRID_STATE_VERSION) {
    return null;
  }
  // v0 → v1: same field names; v1 added `version`, `pageSize`, `selectedIds`, `slices`.
  return { ...sanitizeGridState(input), version: GRID_STATE_VERSION };
}

/**
 * Keep only the well-formed fields of an untrusted (partial) state. With
 * `columnIds`, column-keyed entries for unknown columns are dropped too.
 * Invalid fields are omitted (not defaulted) so `setState` leaves them alone.
 */
export function sanitizeGridState(
  input: unknown,
  columnIds?: ReadonlySet<string> | null,
): Partial<DataGridState> {
  if (!isPlainObject(input)) {
    return {};
  }
  const known = (id: string): boolean => !columnIds || columnIds.has(id);
  const out: Partial<DataGridState> = {};

  const sorts = input['sorts'];
  if (Array.isArray(sorts)) {
    const seen = new Set<string>();
    out.sorts = [];
    for (const entry of sorts) {
      if (!isPlainObject(entry)) {
        continue;
      }
      const columnId = entry['columnId'];
      const direction = entry['direction'];
      if (
        typeof columnId === 'string' &&
        (direction === 'asc' || direction === 'desc') &&
        !seen.has(columnId) &&
        known(columnId)
      ) {
        seen.add(columnId);
        out.sorts.push({ columnId, direction } satisfies SortState);
      }
    }
  }

  const filters = input['filters'];
  if (isPlainObject(filters)) {
    const next: DataGridFilterState = {};
    for (const [id, value] of Object.entries(filters)) {
      if (known(id) && isValidFilterValue(value)) {
        next[id] = value;
      }
    }
    out.filters = next;
  }

  if (typeof input['quickFilter'] === 'string') {
    out.quickFilter = input['quickFilter'];
  }

  const hidden = stringList(input['hiddenColumnIds']);
  if (hidden) {
    out.hiddenColumnIds = hidden.filter(known);
  }

  const order = stringList(input['columnOrder']);
  if (order) {
    out.columnOrder = order.filter(known);
  }

  const widths = input['widthOverrides'];
  if (isPlainObject(widths)) {
    const next: Record<string, number> = {};
    for (const [id, value] of Object.entries(widths)) {
      if (known(id) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
        next[id] = value;
      }
    }
    out.widthOverrides = next;
  }

  const pins = input['columnPins'];
  if (isPlainObject(pins)) {
    const next: Record<string, ColumnPin | null> = {};
    for (const [id, value] of Object.entries(pins)) {
      if (known(id) && (value === null || value === 'left' || value === 'right')) {
        next[id] = value;
      }
    }
    out.columnPins = next;
  }

  const pageIndex = input['pageIndex'];
  if (typeof pageIndex === 'number' && Number.isInteger(pageIndex) && pageIndex >= 0) {
    out.pageIndex = pageIndex;
  }

  const pageSize = input['pageSize'];
  if (typeof pageSize === 'number' && Number.isInteger(pageSize) && pageSize >= 1) {
    out.pageSize = pageSize;
  }

  const selected = input['selectedIds'];
  if (Array.isArray(selected)) {
    out.selectedIds = [
      ...new Set(
        selected.filter(
          (id): id is string | number =>
            typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)),
        ),
      ),
    ];
  }

  const panel = input['activeSidePanel'];
  if (panel === null || typeof panel === 'string') {
    out.activeSidePanel = panel;
  }

  const slices = input['slices'];
  if (isPlainObject(slices)) {
    out.slices = { ...slices };
  }

  return out;
}

/** Structural equality for JSON-like values (state / query snapshots). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, i) => jsonEqual(value, b[i]))
    );
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ak = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const bk = Object.keys(rb).filter((k) => rb[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => jsonEqual(ra[k], rb[k]));
}

export const gridStateEqual: (a: DataGridState, b: DataGridState) => boolean = jsonEqual;
export const gridQueryEqual: (a: DataGridQuery, b: DataGridQuery) => boolean = jsonEqual;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return [...new Set(value.filter((id): id is string => typeof id === 'string'))];
}
