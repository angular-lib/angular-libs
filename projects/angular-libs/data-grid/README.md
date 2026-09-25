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

**Typing:** `T` is inferred from `rows` or typed `columns` (`ColumnDef<Person>[]`),
so `rowId: (r) => r.id` is typed without annotating plugin factories — row-agnostic
factories (`defaultGridPlugins()`, `sideBarPlugin()`, held `rowGroupPlugin()`) fit
any row type. Inline column literals without `rows` need `createGrid<Person>(…)`;
so do inline row-typed plugins (`treeDataPlugin({ getDataPath: (r) => … })`).

**Runtime schema:** `grid.columns.set(next)` (order / pin / width / hidden kept for
surviving ids), `grid.selection.set('single')`, `grid.rowClickSelects`,
`grid.isRowSelectable`, `grid.selectAll`, `grid.setEditInteraction('excel')`.

When `createGrid({ rows })` owns the same signal, paste / cell / row edits
**auto-apply** onto it (`autoApplyWrites`, default true). Hosts that intercept
`(paste)` / `(cellEdit)` to transform first should pass `autoApplyWrites: false`.

### Row identity (`rowId`)

`rowId(row, index)` identifies rows for selection, edits, find, paste write-back
and transactions. `index` is **always the row's index in the source `[data]`
array** — never its filtered / sorted / paged position — so ids from display
rows, `api.getSelectedRows()`, `applyCellEdit` / `applyRowEdit` (called with the
source rows) all agree. The default is that source index, which is only safe
for static data: ids shift when rows are added, removed or reordered. Pass a
field-based id (`rowId: (r) => r.id`) whenever rows change.

- `createGrid({ rows })` without `rowId` logs a one-time dev warning.
- `grid.applyTransaction()` **throws** without an explicit `rowId` (update/remove
  payloads have no source index to match on).
- `(paste)` events carry `rowIds` aligned with `suggestedRows`; write back with
  `mergeRowsById(rows(), e.suggestedRows, idOf, e.rowIds)` (required for
  index-based ids, harmless otherwise).

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
| `statusBarPlugin()` | Footer counts (processed data rows + selection; uses `api.getLocale()`) |
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

**Mutually exclusive:** only one display builder is active (row group, tree, **or**
master-detail). Registering another replaces the previous builder with a console
warning.

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
- Tree: held `TreeDataAdapter` (`collapsedIds`, `expandAll`, `collapseAll`). The row
  at a path **is** that node (e.g. `['UK']` is the parent of `['UK', 'London']`);
  group rows are synthesized only for missing ancestors. Parent data rows show an
  expand toggle in the first column (click, or Space / Enter with that cell
  focused); `DataDisplayRow.groupId` / `hasChildren` / `expanded` describe it.
- One expansion store per grid: the active row-group / tree adapter. Mouse,
  keyboard, `api.toggleGroup` / `expandAll` / `collapseAll` and the held adapter
  all read and write it.
- Group ids are opaque, collision-free strings (type-tagged, percent-encoded
  segments): `1` and `'1'`, blank and `'(blank)'`, `'a/b'` and `['a', 'b']` are
  distinct. Use the `id` from display rows / `collectAllGroupIds` — don't build them.
- Master/detail: nested detail grid via `detailGrid` / `detailColumns`; `expandColumn()`
- Pagination counts **master / group slots**, not open detail panels
- `keepDetailGrids` evicts nested controllers when a master leaves source `[data]` (filter-out still keeps state)
- Nested detail is a **cell widget**: Enter on an open expand column focuses the nested grid; idle Escape returns to the master. Parent arrows skip the detail shell (`aria-details` on the master row).
- Find / cell-range / clipboard operate on master data rows; open detail panels do not consume a range step or a find match. Nested detail cells are **Never** searched in 1.0 (`api.getDisplayedRowCount()` counts data rows only; `getDisplayRowCount()` is the full display list).
- **Server-side + master-detail:** `getDetailRows` is synchronous (**Never** lazy/async for 1.0). With `serverSide: true`, the host must embed detail arrays on each payload.

## Row drag

Enabled only for a **flat** client-side list with **no** active sort/filter/quick-filter/
`externalFilter` and not `serverSide`. `(rowReorder)` includes `fromId` / `toId` plus
`rows` — the **full source** `[data]` order with the row moved, so it is always safe to
assign back:

```html
(rowReorder)="rows.set($event.rows)"
```

## Pagination & server-side paging

Client pagination keeps the current page on data edits, transactions and sorts
(clamped to the last page); filters / quick filter / `externalFilter` / page size
reset to page 1. Changing page scrolls back to the top.

For server paging, pass the total and bind only the current page as `[data]`:

```ts
const grid = createGrid({ columns, serverSide: true, viewport: { pagination: true, pageSize: 50 } });
// (queryChange)="load($event)" — { sorts, filters, quickFilter, pageIndex, pageSize }
async load(q: DataGridQuery) {
  const res = await api.fetch(q);
  this.rows.set(res.rows);
  grid.serverRowCount.set(res.total);
}
```

`queryChange` is derived from the live query (`grid.query()` / `api.query()`): it
fires once on mount (including `initialState`) and on every real change of sort,
filter, quick filter (UI, API or the `[(quickFilter)]` model), page or page size
(`grid.viewport.pageSize.set`) — never twice for the same query.

With `serverRowCount` set the grid skips client slicing, pages by the total, emits
`queryChange` on page change, and offsets `aria-rowindex` / `aria-rowcount` by it.
Grouping, aggregates, find, CSV export and select-all only cover the **current page**.
Leave `serverRowCount` `null` to page the returned rows on the client.

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

### Parsing & validation (edit, paste, fill)

Editor text, pasted cells, and cross-column fill go through one strict parser
(`parseCellInput`). Invalid input is **never written**: the cell editor stays open
with `aria-invalid` (Enter / Tab / click-elsewhere are refused), and paste / fill
report it in `PasteEvent.invalidCells`.

- **Numbers** — decimal / group separators from `locale.numberLocale` (BCP 47,
  default runtime locale): `[locale]="{ numberLocale: 'nb-NO' }"` accepts `1 234,5`.
  Optional currency affix; `abc`, `10-20`, `0x10`, `(100)`, `50%` are rejected.
  Number editors are `type="text" inputmode="decimal"` (no browser `""` for `1,5`).
- **Dates** — ISO `yyyy-mm-dd` or the locale's numeric order with a 4-digit year
  (`25.09.2026` nb); components are validated. The previous value's shape is kept
  (Date stays Date, ISO string stays string; empty cells get an ISO string).
- **Custom** — `valueParser: (input, params) => ({ value }) | ({ error })`.
- Paste / fill skip non-editable columns and `valueGetter`-only columns
  (no `field` / `valueSetter`). Clipboard text is TSV (quoted fields may hold tabs /
  newlines); commas never split a cell.

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
grid.api()?.exportCsv({ filename: 'people.csv', columnKeys: ['name', 'city'], onlySelected: true });
grid.api()?.setFilterModel({ name: 'Ada' });
grid.api()?.getState();
grid.api()?.getLocale(); // plugins use this for chrome strings
```

Feature ops prefer held plugin adapters (`groups.setColumns`, `ranges.clearRange`).
`DataGridApi` methods are thin façades over those adapters (or host passthrough).
`bind*Adapter` / host-passthrough wiring is `@internal`.

CSV export (`api.exportCsv(filenameOrOptions)`, `csvExportPlugin(options)`) writes
processed rows (filter + sort order) with a UTF-8 BOM, CRLF line endings, `;` as
separator when the locale's decimal mark is `,` (else `,`), and prefixes text
starting with `= + - @` (not plain numbers) with `'` against formula injection.
Options: `columnKeys`, `onlySelected`, `columnSeparator`, `locale`, `useFormatter`,
`processCell`, `includeHeaders`, `escapeFormulas`, `bom`. Columns with
`suppressExport: true` (e.g. the master-detail expand column) are skipped unless
listed in `columnKeys`.

## Grid state (persist / restore)

`DataGridState` (schema `version: 1`): sorts, filters, quick filter, column order /
pins / widths / hidden, page index / size, selected ids, open tool panel, and
plugin `slices` (e.g. `rowGroup: { columns, collapsedIds }`).

```ts
const grid = createGrid({
  columns,
  rowId: (r) => r.id,
  // Applied before the first render and the first queryChange — no flash / refetch.
  initialState: parseGridState(localStorage.getItem('grid') ?? ''),
});
```

```html
<!-- save(s) { localStorage.setItem('grid', serializeGridState(s)); } -->
<al-data-grid [controller]="grid" [data]="rows()" (stateChange)="save($event)" />
```

- `grid.state()` / `api.state()` — live, structurally memoized signal; `(stateChange)`
  and plugin `onStateChange` derive from it (once per real change, not on mount,
  column resize reports on drop).
- `api.setState(partial, { ignore: ['selectedIds'] })` — absent / invalid fields and
  ignored keys stay as they are; fires `sortChange` / `filterChange` /
  `selectionChange` for what changed.
- `parseGridState(raw)` / `migrateGridState(obj)` validate untrusted input (bad
  sort directions, non-model filter values, … are dropped) and upgrade unversioned
  snapshots; ids of columns the grid does not have are dropped on apply.
- Plugins contribute slices with `capabilities.registerStateSlice` (see PLUGINS.md).

## Locale

Pass `[locale]` partials; plugins read `api.getLocale()` for status bar, sidebar
tabs, Expand/Collapse/Ungroup, and panel titles.

Client string sorting uses a cached `Intl.Collator` (numeric, accent/case-
insensitive). Set `collatorLocale` (BCP-47, e.g. `[locale]="{ collatorLocale: 'nb' }"`)
to sort by a specific language (Æ/Ø/Å after Z); default is the runtime locale.
Blank values (`null` / `''` / `NaN` / invalid Date) sort first ascending.

## Aggregates (`column.aggFunc`)

Built-ins skip blank values (`null` / `undefined` / `''`): `count` is the number
of non-blank values; `sum` / `avg` / `min` / `max` use finite numbers only
(numbers or numeric strings). `valueFormatter` runs on footer values with
`row: undefined`, `rowIndex: -1` (not for `count`).

## Features

- Signals / models, OnPush, CSS variables, test ids
- Sort, filter (text/number/boolean/date/set), quick filter, external filter
- Selection (header select-all scope: `createGrid({ selectAll: 'filtered' | 'page' | 'all' })`,
  default `'filtered'`; adds to / removes from the existing selection)
- Pagination or virtualization, flex widths (resolved to px from the measured
  viewport; resizing one column leaves flex columns flexing), pin/reorder/resize
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
