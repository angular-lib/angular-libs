import { InjectionToken } from '@angular/core';

/**
 * Parent ↔ nested detail focus handoff (Angular Aria **Grid** cell-widget model).
 *
 * The default master-detail view provides this token; the nested `<al-data-grid>`
 * injects it. Parent arrows never enter the nested grid — Enter on an expanded
 * master expand-column activates the widget; idle Escape returns to the master.
 *
 * Not `@angular/aria` — same mental model, implemented in this grid.
 */
export interface DataGridNestedRealm {
  readonly masterRowId: string | number;
  /** Focus the nested grid's first body cell. */
  enter(): boolean;
  /** Return focus to the master expand cell (or first master column). */
  exitToMaster(): boolean;
}

export const DATA_GRID_NESTED_REALM = new InjectionToken<DataGridNestedRealm>(
  'DATA_GRID_NESTED_REALM',
);
