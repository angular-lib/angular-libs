# @angular-libs/data-grid

Lightweight, **modern Angular-only** data grid (signals, standalone, CSS-variable theming).
Inspired by AG Grid’s useful core — not an API clone.

See [OVERVIEW.md](./OVERVIEW.md) for the product map (what we build / refuse,
AG-informed line, next backlog), [KEYBOARD.md](./KEYBOARD.md) for the body
keyboard matrix, [ARCHITECTURE.md](./ARCHITECTURE.md) for the
modularization spec, [ROADMAP.md](./ROADMAP.md) for phased delivery, and
[PLUGINS.md](./PLUGINS.md) for the kernel + capability plugin authoring guide.

**Governance:** do not add new feature inputs on `DataGrid` — compose plugins +
`createGrid` instead.

## Install

Peer deps: `@angular/core` / `@angular/common` / `@angular/forms` ≥22.

## Quick start (held objects + `createGrid`)

Prefer **holding plugin instances** (store-style adapters) and a small controller:

```ts
import { applyCellEdit, createGrid, DataGrid } from '@angular-libs/data-grid';
import {
  defaultGridPlugins,
  rowDragPlugin,
  rowGroupPlugin,
} from '@angular-libs/data-grid/plugins';

const groups = rowGroupPlugin({ columns: ['department'] });

const grid = createGrid({
  columns,
  rowId: (r) => r.id,
  selection: 'multi',
  viewport: { virtual: true, pageSize: 25 },
  chrome: { showToolbar: true, contextMenu: true },
  plugins: [...defaultGridPlugins({ sideBar: false }), rowDragPlugin(), groups],
});

// adapter DX — no host helpers required
groups.setColumns(['role']);
groups.clear();
```

```html
<al-data-grid
  [controller]="grid"
  [data]="rows()"
  [(selectedIds)]="selected"
  (cellEdit)="onEdit($event)"
  (paste)="onPaste($event)"
/>
```

When `createGrid({ rows })` owns the same signal, paste / cell / row edits
**auto-apply** onto it (`autoApplyWrites`, default true). Hosts that intercept
`(paste)` / `(cellEdit)` to transform first should pass `autoApplyWrites: false`.

Compose plugins once on `createGrid`. Toggle chrome via held adapters
(e.g. `sideBar.setEnabled(false)`) or controller UX signals
(`grid.viewport.pagination.set(true)`, `grid.chrome.contextMenu.set(true)`).

After mount, `grid.setPlugins(...)` **does** recompose (by plugin `id` list key).
Prefer held adapters for intentional updates — avoid churning the list on every
CD cycle.

## Full-row edit (Signal Forms) — canonical DX

Host owns the form tree; the grid loads the editing row into it:

```ts
import { form, FormField } from '@angular/forms/signals';
import { applyRowEdit, createGrid } from '@angular-libs/data-grid';

const draft = signal<Emp>({ id: '', name: '', role: '' });
const employeeForm = form(draft, (s) => {
  // schema…
});

const grid = createGrid({
  columns,
  rowId: (r) => r.id,
  editMode: 'fullRow',
  plugins: defaultGridPlugins(),
});
```

```html
<al-data-grid
  [controller]="grid"
  [data]="rows()"
  [rowForm]="employeeForm"
  [(rowEditSession)]="session"
  (rowEdit)="rows.set(applyRowEdit(rows(), $event, idOf))"
/>
```

- **Canonical:** host `[rowForm]` + `createGrid({ editMode: 'fullRow' })` (toggle with `grid.editMode.set`) + `(rowEdit)` / `applyRowEdit`
- **Fallback:** omit `rowForm`, pass `rowEditSchema` / `createRowForm` (grid creates a session form)
- **Optional sugar:** `gridRef.rowEditAdapter` / `api.startEditingRow` / `api.startEditingCell` / `api.stopEditing`
- Observe session with `[(rowEditSession)]` when the host needs commit/cancel metadata

## Plugins

Capability plugins register **behavior** (row-model builders, interactions,
aggregates) and/or **chrome** (toolbar / status / sidebar). See [PLUGINS.md](./PLUGINS.md).

| Plugin | Role |
| --- | --- |
| `findPlugin()` | Find UI + Ctrl/Cmd+F / F3 shortcuts |
| `sideBarPlugin(config?)` | Columns / filters tool panels |
| `statusBarPlugin()` | Footer counts (uses `api.getLocale()`) |
| `clipboardPlugin()` | Owns copy + paste listeners → `(paste)` |
| `csvExportPlugin()` / `autosizePlugin()` | Opt-in toolbar CSV / autosize actions |
| `notesPlugin({ notes, save })` | Cell notes — pass `notesResource.value` + `save` / `reload` |
| `rowDragPlugin()` | Drag handle → `(rowReorder)` with `fromId`/`toId` |
| `aggregateRowPlugin()` | Pinned footer aggregates (`column.aggFunc`) |
| `infiniteScrollPlugin()` | Scroll + resize near-end → `(nearEnd)` |
| `rowGroupPlugin({ columns })` | Display builder + `RowGroupAdapter` |
| `treeDataPlugin({ getDataPath })` | Tree display builder + `TreeDataAdapter` |
| `masterDetailPlugin({ getDetailRows, detailGrid })` | Expand + nested detail `<al-data-grid>`; `expandColumn()` |

Also available **only** from `@angular-libs/data-grid/plugins` (preferred).

Sidebar panel components (`DataGridColumnsPanel`, `DataGridFiltersPanel`,
`DataGridRowGroupPanel`) live in the plugins package and register via slots.
The filters tool panel shows filter cards (add / remove / expand) for open
filters — values set from floating filters are auto-added.

### Custom tool panels

Register your own sidebar panels from a plugin:

```ts
context.slots.registerSidebar({
  id: 'events',
  label: 'Events',
  component: EventsPanel,
  inputs: () => ({ title: 'Live events' }), // Angular input()s — reactive
  providers: [/* optional panel stores */],
});
```

Panels inject `DATA_GRID_SIDEBAR_HOST` (`api`, `controller`, `context`) and can
subscribe with `api.events.on` / `onAny`. Open/collapse imperatively via
`api.openToolPanel(id)` / `api.getOpenedToolPanel()`. See [PLUGINS.md](./PLUGINS.md).

`clipboardPlugin` owns paste **and** copy listeners. `findPlugin` owns Ctrl/Cmd+F / F3 navigation.

Use plugins for find / sidebar / clipboard — there are no legacy feature-shortcut
inputs on `DataGrid` (see architecture Phase 1).

## Row grouping & tree

**Mutually exclusive:** only one display builder is active (row group **or** tree).
Registering both replaces the previous builder with a console warning.

```ts
const groups = rowGroupPlugin({ columns: ['department'] });
plugins = [groups, sideBarPlugin()]; // Groups tool panel appears here
```

```ts
const tree = treeDataPlugin({ getDataPath: (r) => r.path });
plugins = [tree];
tree.expandAll();
```

```ts
const md = masterDetailPlugin({
  getDetailRows: (r) => r.orders,
  detailGrid: {
    columns: [{ field: 'sku' }, { field: 'qty', type: 'number' }],
    rowId: (r) => r.sku,
  },
  isRowMaster: (r) => r.orders.length > 0,
});
plugins = [...defaultGridPlugins({ sideBar: false }), md];
columns = [md.expandColumn(), { field: 'name' }];
```

- **Groups** sidebar tab: check columns to group, reorder levels, **Ungroup**
- Expand / Collapse / Ungroup live on the held adapter (`groups.expandAll()`, `groups.collapseAll()`, `groups.clear()`) and `DataGridApi` — no default toolbar buttons
- API: `api.setRowGroupColumns(['role'])`, `api.clearRowGroup()`, `api.toggleGroup(id)`
- Tree: held `TreeDataAdapter` (`collapsedIds`, `expandAll`, `collapseAll`)
- Master/detail: nested detail grid via `detailGrid` / `detailColumns`; `expandColumn()`

## Row drag

Enabled only for a **flat** client-side list with **no** active sort/filter/quick-filter
and not `serverSide`. `(rowReorder)` includes `fromId` / `toId` plus suggested `rows`:

```html
(rowReorder)="rows.set($event.rows)"
```

Prefer applying by id when syncing back to unsorted source data.

## Editors & renderers

```ts
{
  field: 'role',
  editable: true,
  cellEditor: 'select',
  cellEditorParams: { values: ['Engineer', 'Designer', 'PM'] },
}
```

- Built-ins: `text` | `number` | `boolean` | `date` | `select`
- Optional `cellRenderer` / `cellEditor` as a typed Angular `Type` (inputs: `params`)
- `alGridCell` templates win over `cellRenderer` when both are set

## Column groups

Groups are **membership**, not decoration:

- Each leaf belongs to one top-level group (from `ColumnGroupDef.children`)
- The group header `colspan` follows the *current visible* leaves in that group
- Column reorder (header drag + columns panel) only allows moves **within** the same group

```ts
columns: ColumnOrGroupDef<Emp>[] = [
  {
    headerName: 'Identity',
    children: [
      { field: 'name', filter: true },
      { field: 'role', filter: 'set' },
    ],
  },
];
```

## GridApi

```ts
grid.api()?.exportDataAsCsv();
grid.api()?.setFilterModel({ name: 'Ada' });
grid.api()?.getState();
grid.api()?.getLocale(); // plugins use this for chrome strings
```

Feature ops prefer held plugin adapters (`groups.setColumns`, `ranges.clearRange`).
`DataGridApi` methods are thin façades over those adapters (or host passthrough).
`bind*Adapter` / host-passthrough wiring is `@internal`.

## Locale

Pass `[locale]` partials; plugins read `api.getLocale()` for status bar, sidebar
tabs, Expand/Collapse/Ungroup, and panel titles.

## Features

- Signals / models, OnPush, CSS variables, test ids
- Sort, filter (text/number/boolean/date/set), quick filter, external filter
- Selection, pagination or virtualization, flex widths, pin/reorder/resize
  (header right-click: Pin left / Pin right / Unpin; drag onto a pinned/unpinned
  column also changes pin; `api.setColumnPinned`)
- Cell + full-row Signal Forms editing, header/cell templates
- CSV export, autosize, copy selection, paste plugin, row drag
- Keyboard: arrows, Home/End, PageUp/Down (viewport-sized), Enter/F2, Space (group toggle), Ctrl/Cmd+A
- Display-kind view registry (`registerDisplayView` can override `group` / `plugin` rows)
- State get/set, server-side query events, context menu, locale

## Theming

Defaults follow a spreadsheet-style palette (visible grid lines, cool header, selection blue).
Override any `--al-dg-*` token on the host:

```css
al-data-grid {
  --al-dg-accent: #0f766e;
  --al-dg-header-bg: #f0fdfa;
  --al-dg-border: #99f6e4;
  --al-dg-row-selected: #ccfbf1;
}
```
