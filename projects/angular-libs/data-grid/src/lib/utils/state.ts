import type {
  ColumnPin,
  DataGridState,
  SideBarPanelId,
} from '../components/data-grid/data-grid.types';

export function createEmptyGridState(): DataGridState {
  return {
    sorts: [],
    filters: {},
    quickFilter: '',
    hiddenColumnIds: [],
    columnOrder: [],
    widthOverrides: {},
    columnPins: {},
    pageIndex: 0,
    activeSidePanel: null,
  };
}

function parseColumnPins(raw: unknown): Record<string, ColumnPin | null> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const out: Record<string, ColumnPin | null> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) {
      out[id] = null;
    } else if (value === 'left' || value === 'right') {
      out[id] = value;
    }
  }
  return out;
}

export function serializeGridState(state: DataGridState): string {
  return JSON.stringify(state);
}

export function parseGridState(raw: string): DataGridState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DataGridState>;
    return {
      ...createEmptyGridState(),
      ...parsed,
      sorts: Array.isArray(parsed.sorts) ? parsed.sorts : [],
      filters: parsed.filters && typeof parsed.filters === 'object' ? parsed.filters : {},
      quickFilter: typeof parsed.quickFilter === 'string' ? parsed.quickFilter : '',
      hiddenColumnIds: Array.isArray(parsed.hiddenColumnIds) ? parsed.hiddenColumnIds : [],
      columnOrder: Array.isArray(parsed.columnOrder) ? parsed.columnOrder : [],
      widthOverrides:
        parsed.widthOverrides && typeof parsed.widthOverrides === 'object'
          ? parsed.widthOverrides
          : {},
      columnPins: parseColumnPins(parsed.columnPins),
      pageIndex: typeof parsed.pageIndex === 'number' ? parsed.pageIndex : 0,
      activeSidePanel: (parsed.activeSidePanel as SideBarPanelId | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}
