import type {
  CellClickEvent,
  CellEditEvent,
  ColumnOrderChangeEvent,
  DataGridContextMenuContext,
  DataGridQuery,
  DataGridState,
  FilterChangeEvent,
  PasteEvent,
  RowClickEvent,
  RowEditCancelEvent,
  RowEditContext,
  RowEditEvent,
  RowReorderEvent,
  SelectionChangeEvent,
  SortChangeEvent,
} from '../components/data-grid/data-grid.types';
import type { FindMatchesChangeEvent } from '../utils/find';
import type { DataGridApi } from './grid-api';

/** Unsubscribe function returned by {@link GridEventBus.on} / {@link GridEventBus.onAny}. */
export type GridEventUnsubscribe = () => void;

/**
 * Typed map of grid events — mirrors Angular `output()`s on {@link DataGrid}.
 * Tool panels and plugins subscribe via {@link DataGridApi.events}.
 */
export interface DataGridEventMap<T = unknown> {
  sortChange: SortChangeEvent;
  filterChange: FilterChangeEvent;
  cellEdit: CellEditEvent<T>;
  rowEdit: RowEditEvent<T>;
  rowEditStart: RowEditContext<T>;
  rowEditCancel: RowEditCancelEvent<T>;
  cellClick: CellClickEvent<T>;
  rowClick: RowClickEvent<T>;
  selectionChange: SelectionChangeEvent<T>;
  queryChange: DataGridQuery;
  stateChange: DataGridState;
  columnOrderChange: ColumnOrderChangeEvent;
  contextMenuOpened: DataGridContextMenuContext<T>;
  contextMenuClosed: undefined;
  findMatchesChange: FindMatchesChangeEvent;
  rowReorder: RowReorderEvent<T>;
  paste: PasteEvent<T>;
  nearEnd: undefined;
  apiReady: DataGridApi<T>;
}

export type DataGridEventName = keyof DataGridEventMap;

/**
 * Typed pub/sub mirror of grid outputs (AG-style tool-panel access without
 * stringly host listeners). Host apps still use Angular `output()` bindings.
 */
export class GridEventBus<T = unknown> {
  private readonly listeners = new Map<
    DataGridEventName,
    Set<(payload: never) => void>
  >();
  private readonly global = new Set<
    (name: DataGridEventName, payload: DataGridEventMap<T>[DataGridEventName]) => void
  >();

  /**
   * Subscribe to one event. Returns an unsubscribe function.
   */
  on<K extends DataGridEventName>(
    name: K,
    handler: (payload: DataGridEventMap<T>[K]) => void,
  ): GridEventUnsubscribe {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    const wrapped = handler as (payload: never) => void;
    set.add(wrapped);
    return () => set!.delete(wrapped);
  }

  /**
   * Subscribe to every event (debug / event-log panels).
   */
  onAny(
    handler: <K extends DataGridEventName>(
      name: K,
      payload: DataGridEventMap<T>[K],
    ) => void,
  ): GridEventUnsubscribe {
    const wrapped = handler as (
      name: DataGridEventName,
      payload: DataGridEventMap<T>[DataGridEventName],
    ) => void;
    this.global.add(wrapped);
    return () => this.global.delete(wrapped);
  }

  /**
   * @internal Published by DataGrid beside each `output().emit`.
   */
  emit<K extends DataGridEventName>(name: K, payload: DataGridEventMap<T>[K]): void {
    const set = this.listeners.get(name);
    if (set) {
      for (const handler of [...set]) {
        try {
          (handler as (payload: DataGridEventMap<T>[K]) => void)(payload);
        } catch {
          /* isolate listener failures */
        }
      }
    }
    for (const handler of [...this.global]) {
      try {
        handler(name, payload);
      } catch {
        /* isolate listener failures */
      }
    }
  }

  /** Drop all listeners (grid destroy). */
  clear(): void {
    this.listeners.clear();
    this.global.clear();
  }
}
