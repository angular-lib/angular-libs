# Writing data-grid plugins

Plugins are the extension surface for `@angular-libs/data-grid` — same spirit as
`@angular-libs/dialog` (own listeners/lifecycle) and `@angular-libs/store`
(return adapters), sitting on top of a small **grid kernel**.

Factories live in `@angular-libs/data-grid/plugins` so unused features tree-shake.

**Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md) (phases, non-goals, package
boundaries, [session / host / plugin ownership](./ARCHITECTURE.md#ownership-session--host--plugin)).
**Do not** add feature inputs on `DataGrid` — register via `capabilities` / `slots` only.

### Plugin vs host

| | **Plugin** (this doc) | **Host** (`src/lib/hosts/`) |
| --- | --- | --- |
| When | Opt-in feature, tree-shakeable, held adapter | Core table behavior always available |
| Examples | row group, clipboard, cell range, flash, notes | sort/filter/layout, edit sync, selection, viewport |
| Registers via | `slots` / `capabilities` in `setup` | Owned signals + methods on the session |

If you are unsure: core keyboard/edit/selection/layout → **host**; everything else that
can be left out of the default bundle → **plugin**.

## Consumer DX (held objects)

Do **not** introduce a `withX()` / `createGridFeatures` DSL. Hold plugin values
and compose once on `createGrid`. Toggle chrome via adapters
(`sideBar.setEnabled(false)`) — avoid rebuilding the plugin list for UI toggles.

Plugin activation is **imperative** on `GridKernel` (mount + rare
`setPlugins` → `api.recomposePlugins`). Never drive activation from an Angular
`effect` that can track slot/capability writes — that freezes the app.

```ts
import { createGrid } from '@angular-libs/data-grid';
import { defaultGridPlugins, rowGroupPlugin } from '@angular-libs/data-grid/plugins';

const groups = rowGroupPlugin({ columns: ['department'] });

const grid = createGrid({
  columns,
  rowId: (r) => r.id,
  selection: 'multi',
  plugins: [...defaultGridPlugins(), groups],
});

groups.setColumns(['role']); // store-style adapter
```

```html
<al-data-grid [controller]="grid" [data]="rows()" />
```

`defaultGridPlugins()` = find + clipboard + statusBar + sideBar (each can be opted out).
Toolbar tools like CSV export and autosize are **not** defaults — import
`csvExportPlugin()` / `autosizePlugin()` when you want them.

## Architecture

```
createGrid → GridController
createDataGridSession → kernel + hosts + live pipeline + API
plugins register on kernel (slots / capabilities)
DataGrid binder → IO + template binds session/hosts
```

**Do not** put feature logic in `data-grid.ts`. Core behavior → host; opt-in → plugin
(see [ownership](./ARCHITECTURE.md#ownership-session--host--plugin)).

## Plugin contract

```ts
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export function myPlugin<T>(): DataGridPlugin<T> {
  return {
    id: 'myPlugin', // stable id → deduped when listed twice
    setup(context: DataGridPluginContext<T>): (() => void) | void {
      // register contributions; return cleanup
    },
  };
}
```

`context` gives you:

| Field | Use for |
| --- | --- |
| `api` | Read grid state, emit paste, bind adapters |
| `capabilities` | Row-model / interaction / aggregate registration |
| `slots` | Toolbar / status / sidebar / find / sideBar chrome |
| `element` | Host root (prefer `registerInteraction` over raw listeners) |
| `injector` | Create DI-backed UI |

## Capability API

### Display builder

Maps processed `T[]` → `DisplayRow[]` (group / tree / custom).

**Exclusive:** only one display builder may be active. Registering another
replaces the previous (row group and tree cannot run together).

```ts
context.capabilities.registerDisplayBuilder({
  id: 'myGrouping',
  build: (rows, ctx) => /* DisplayRow<T>[] */,
});
```

### Data stage

Runs after filter/sort, before display:

```ts
context.capabilities.registerDataStage({
  id: 'myStage',
  order: 10,
  transform: (rows, ctx) => rows,
});
```

### Interaction

Own DOM listeners; return cleanup:

```ts
context.capabilities.registerInteraction({
  id: 'myKeys',
  setup: (element) => {
    const onKey = (e: KeyboardEvent) => { /* … */ };
    element.addEventListener('keydown', onKey);
    return () => element.removeEventListener('keydown', onKey);
  },
});
```

### Aggregate footer

```ts
context.capabilities.registerAggregate({
  id: 'myAgg',
  values: (rows, columns) => new Map([['salary', 0]]),
});
```

### Display-kind view

Register a component for plugin display rows (`kind: 'plugin'`, matched by
`pluginKind`), or override built-in `'group'` / `'data'` chrome:

```ts
context.capabilities.registerDisplayView({
  kind: 'summary',
  component: MySummaryRow,
});

// Override group headers:
context.capabilities.registerDisplayView({
  kind: 'group',
  component: MyGroupRow,
});

// In a display builder:
return [{ kind: 'plugin', pluginKind: 'summary', id: 's1', payload: { total } }];
```

## Locale

Plugins should call `context.api.getLocale()` for chrome strings (status bar,
toolbar labels, sidebar panel titles). Do not hardcode English when a key exists
on `DataGridLocale`.

## Store-style adapters

`rowGroupPlugin()` returns a **plugin + adapter**:

```ts
const groups = rowGroupPlugin({ columns: ['department'] });

plugins = [groups, sideBarPlugin()];

// Later, without touching the grid host helpers:
groups.setColumns(['role']);
groups.clear();
```

The plugin registers the display builder and binds the adapter on `api` so
Groups UI / `api.setRowGroupColumns` stay in sync.

## Cell notes

Opt-in cell annotations stored **outside** row data. Host owns async load
(`resource`); plugin takes `notesResource.value` directly.

```ts
notesResource = resource({
  loader: async ({ abortSignal }) => {
    const res = await fetch('/api/notes', { signal: abortSignal });
    return (await res.json()) as NotesMap; // keys via noteKey(rowId, columnId)
  },
});

const notes = notesPlugin({
  notes: notesResource.value,
  save: async ({ rowId, columnId, note }) => {
    await api.putNote(rowId, columnId, note); // undefined → delete
  },
  reload: () => notesResource.reload(),
});

plugins = [...defaultGridPlugins(), notes];
```

UI: corner marker, hover preview (read-only), `Shift+F2` / context-menu Add/Edit/Remove for the editor.
Writes are optimistic (`notes.set`) then `save`; failed saves call `reload`.

**Overlay paint vs floating UI:** floating popovers (notes, tooltips) may append under
`context.element` with binder-owned CSS (`data-grid.css` — no `document.head` injection).
Absolute paint overlays (range ring, fill handle, etc.) must use `registerOverlay` /
binder paint — not plugin-owned DOM measurement of `.al-data-grid__range-layer`.

## Flash cells

Opt-in imperative highlight — hold the plugin and call `flashCells` with cells
and/or rows plus optional `color` / `duration`.

```ts
const flash = flashCellsPlugin(); // optional defaults: { color, duration }
plugins = [...defaultGridPlugins(), flash];

flash.flashCells({
  cells: [{ rowId: 1, columnId: 'price' }],
  color: '#ffe082',
  duration: 1000,
});

flash.flashCells({
  rowIds: [1, 2],
  columnIds: ['price', 'qty'], // omit → all visible columns
  color: '#81c784',
});

flash.clearFlash();
```

Not included in `defaultGridPlugins()`. Requires a stable `rowId`.

## Cell range

Opt-in single-rectangle cell range (OVERVIEW §5). Coexists with row selection;
copy prefers the range when present.

```ts
const ranges = cellRangePlugin();
plugins = [...defaultGridPlugins(), ranges];

ranges.getRange();   // { anchor, active } | null
ranges.clearRange();
```

- **Keyboard:** Shift+arrows extend the active corner
- **Pointer:** drag-select on cells; fill-handle copy-fills via `(paste)`
- **Esc** clears the range

Not included in `defaultGridPlugins()`.

## Chrome slots

Toolbar `actionClick` / `disabled` receive:

| Param | Meaning |
| --- | --- |
| `api` | Bound `DataGridApi` (selection, export, focus, …) |
| `controller` | Required `[controller]` from `createGrid` |
| `context` | Opaque host bag (`[context]`) — services, notifications, held plugins |
| `event` | Click event (present for `actionClick`) |

**Call-site rule:** UI ops → `api`; row writes / schema → `controller`; app services → `context`.  
Prefer `params.api` over `params.controller.api()` in handlers (`controller.api` is bind plumbing).

Do **not** put `GridController` in `context` — use `controller` for `applyTransaction` / `setRows`.

```ts
context.slots.registerToolbar({
  id: 'x',
  icon: '★',
  ariaLabel: 'Do thing',
  actionClick: async ({ api, controller, context }) => {
    api.exportCsv();
    controller.applyTransaction({ add: [] }); // when createGrid({ rows }) was used
    // context = host bag only (e.g. services), never the grid controller
  },
});
context.slots.registerStatusBar({ id: 'y', text: () => '…' });
context.slots.registerSidebar({ id: 'z', label: 'Panel', component: MyPanel });
context.slots.enableFind({ caseSensitive: false });
context.slots.enableSideBar(true);
context.slots.enableRowDrag();
```

Host-declared actions use the same params via `[toolbarActions]` + `[context]`:

```html
<al-data-grid
  [controller]="grid"
  [context]="hostCtx"
  [toolbarActions]="actions"
  [data]="grid.rows()!"
/>
```

Sidebar panels inject `DATA_GRID_SIDEBAR_HOST` (provided by the core shell).
The host includes `api`, `controller`, and host `[context]` — same call-site
rule as toolbar actions: UI ops → `api`; row writes → `controller`; app
services → `context`.

Subscribe to grid events like AG tool panels:

```ts
inject(DATA_GRID_SIDEBAR_HOST).api.events.on('selectionChange', (ids) => { … });
inject(DATA_GRID_SIDEBAR_HOST).api.events.onAny((name, payload) => { … });
```

Pass typed config into the panel via Angular `input()`s (preferred over AG’s
opaque `toolPanelParams`):

```ts
context.slots.registerSidebar({
  id: 'stats',
  label: 'Stats',
  component: StatsPanel,
  // Factory keeps signal reads reactive while the panel is open
  inputs: () => ({
    title: 'Live stats',
    threshold: threshold(),
  }),
  // Optional: panel-local services / stores
  providers: [{ provide: MY_STORE, useValue: store }],
});

@Component({ … })
export class StatsPanel {
  readonly title = input.required<string>();
  readonly threshold = input(10);
  readonly host = inject(DATA_GRID_SIDEBAR_HOST); // api · controller · context
}
```

`api.events` mirrors every Angular `output()` on `DataGrid`. Host apps should still
bind template outputs for app logic; the bus is for plugins / tool panels.

Built-in columns/filters panels are registered by `sideBarPlugin()`; the groups
panel is registered by `rowGroupPlugin()`. The filters panel is card-based
(add/remove/expand); filter values set elsewhere auto-open a card.

## Checklist for a third-party plugin

1. Stable `id`
2. Register via `capabilities` / `slots` only (no patches to `DataGrid`)
3. Return cleanups from `setup`
4. Prefer `api` / `controller` over reaching into the component; keep `context` host-only
5. Export a factory from your package; consumers add it via `createGrid({ plugins })` / `setPlugins`

## Reference plugins

| Factory | Capabilities |
| --- | --- |
| `clipboardPlugin` | `registerInteraction` paste/copy + owns paste matrix → `api.emitPaste` |
| `rowGroupPlugin` | `registerDisplayBuilder` + `RowGroupAdapter` |
| `treeDataPlugin` | `registerDisplayBuilder` + `TreeDataAdapter` |
| `aggregateRowPlugin` | `registerAggregate` |
| `infiniteScrollPlugin` | `registerInteraction` → `api.notifyNearEnd` (scroll + ResizeObserver) |
| `findPlugin` | `enableFind` + key interaction |
| `notesPlugin` | `registerCellDecorator` + context menu + hover preview / `Shift+F2` editor (`api.getLocale()`) |
| `flashCellsPlugin` | `registerCellDecorator` + held `flashCells` / `clearFlash` adapter |
| `cellRangePlugin` | decorator + copy-fill (`FillEvent` via `(paste)`); `fillHandle: false` hides the handle; Shift+arrow via focus |
| `statusBarPlugin` / `sideBarPlugin` / `rowDragPlugin` | chrome slots (localized) |
| `csvExportPlugin` / `autosizePlugin` | toolbar slot actions |

See the demo’s `sampleStatusPlugin` for a minimal third-party-style example.
