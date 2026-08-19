# @angular-libs/data-grid — architecture

Lightweight, **signal-first Angular grid**: host-owned immutable data, typed
plugins, Signal Forms for row edit. Inspired by AG Grid’s useful core — not an
API clone.

See [OVERVIEW.md](./OVERVIEW.md) for the product map and next backlog,
[ROADMAP.md](./ROADMAP.md) for phased delivery, and [PLUGINS.md](./PLUGINS.md)
for authoring. Breaking changes OK until first publish.

---

## Product position

| Principle | Meaning |
| --- | --- |
| **Angular-native editable grid** | Differentiate on signals + Signal Forms row edit, not AG feature parity |
| **Host owns rows** | Immutable `T[]` on the host; grid emits edits / paste suggestions; helpers like `applyCellEdit` |
| **Held plugins** | Compose `fooPlugin()` values (store adapters + dialog lifecycle); no `withX()` DSL |
| **Kernel stays small** | Focus, viewport plumbing, display pipeline orchestration, editing seams — not every feature |
| **No cell-framework explosion** | Typed component editors/renderers + content projection; no string renderer registry |

### Explicit non-goals

| Anti-pattern | Why |
| --- | --- |
| AG `ModuleRegistry` + string modules | Heavy; poor tree-shake; not Angular-native |
| God `gridOptions` bag | Mixes schema, state, features, handlers |
| `withFind()` / feature DSL | Prefer held objects + `defaultGridPlugins()` |
| Everything-is-a-plugin (incl. virtualization / focus) | Kernel must stay |
| Separate “headless product tier” | One consumer surface: `<al-data-grid>` + `createGrid`; deepen the controller in place |

---

## Target shape

```
createGrid({ columns, plugins, viewport, chrome, … })
        │                              ← schema + held plugins + UX flags
        ▼
GridController                          ← schema + writable UX flags (+ computeRowModel for tests)
        │
        ▼
createDataGridSession(…)                ← runtime root (mounted grid)
        ├── GridKernel                  ← plugin lifecycle, slots, capabilities, focus/find
        ├── behavioral hosts            ← domain state (columns, viewport, edit, …)
        ├── live row pipeline           ← processedRows / displayRows
        └── DataGridApi                 ← composed from hosts
        │
        ▼
<al-data-grid>                          ← thin binder: IO + template binds session/hosts
```

**Rules**

1. **Do not** put feature logic in `data-grid.ts`.
2. **Do not** add new feature inputs on `DataGrid` — plugins + controller only.
   `[controller]` from `createGrid` is **required**; schema (`columns`, `rowId`,
   `selection`, `editMode`) is controller-only (no binder overrides).
   Viewport / chrome / multiSort / serverSide live on `createGrid` / `GridController`.
3. Prefer `capabilities` / `slots` over reaching into the component.
4. Editing is **kernel-adjacent** (always available), not an optional chrome plugin.
5. Plugin activation is **imperative** on `GridKernel` only — never from an Angular
   `effect` (slot/capability writes would re-trigger it). Chrome toggles use held
   adapters (`sideBar.setEnabled`); rare list changes use `setPlugins` →
   `api.recomposePlugins`. Open tool-panel state uses `linkedSignal`, never an
   effect that writes `activeSidePanel`.

---

## Ownership: session / host / plugin

Where new code belongs. Enforced in spirit by
[`src/lib/hosts/GOVERNANCE.md`](./src/lib/hosts/GOVERNANCE.md) (LOC gates on the binder).

### Session (`createDataGridSession`)

**Runtime root** for one mounted grid. Not a feature layer — orchestration.

| Owns | Examples |
| --- | --- |
| Wiring | controller + IO bridges → kernel + hosts + API |
| Live row pipeline | `processedRows`, `displayRows` |
| Kernel | focus, find, slots, capabilities |
| Cross-cutting paint | range overlays (`paintedOverlays`) |
| `DataGridApi` | façade composed from hosts |

Binder constructs the session; the template reads it.

### Host (`src/lib/hosts/*`)

**Domain state + behavior inside one grid** (always available / kernel-adjacent).

| Host | Area |
| --- | --- |
| `ColumnLayoutHost` | sort, filter, layout, pin, resize, reorder, widths |
| `ViewportHost` | scroll, page/virtual window, find UI state, collapse, row-drag, sidebar open |
| `EditSyncHost` | cell/row edit draft, `rowEditMgr`, start/commit/cancel |
| `SelectionHost` | selection-derived UI, toggle, select-all, selection clipboard |
| `MenuHost` | context menu + lean column menu state |

If it is **core table behavior** that should exist without an opt-in package, it belongs on a host — not a plugin.

### Plugin (`@angular-libs/data-grid/plugins`)

**Opt-in features** that register via slots / capabilities. Authoring contracts:
[`@angular-libs/data-grid/plugin`](./src/plugin-api.ts) — see [PLUGINS.md](./PLUGINS.md).

| Kind | Examples |
| --- | --- |
| Chrome slots | find bar, sidebar, status, toolbar actions |
| Row model | row group, tree, aggregate, data stages |
| Interaction | clipboard, infinite scroll, row-drag enable, cell range |
| Cell décor | notes marker, flash, range fill class |
| Held adapters | `groups.setColumns()`, `flash.flashCells()`, `range.clearRange()` |

Plugin owns **feature state + registration**. Absolute paint overlays → session/binder.
Floating UI (notes popover, tooltips) may append under `context.element` with
binder-owned CSS — documented exception, not `registerOverlay`.

### Binder (`DataGrid` / `data-grid.ts`)

Outside the triangle: inputs / models / outputs, template, thin keyboard coordinators.
Does **not** own domain state.

### Thumb rule

```
New thing?
 ├─ Always part of the grid core?     → Host (or session if cross-cutting)
 ├─ Opt-in / tree-shake / adapter?    → Plugin
 └─ Only wire IO ↔ runtime?           → Session (rarely new feature code)
```

---

## Spec plan (score ≥ 75)

Ideas below 75, and any that fight the principles above, are out of scope for
this plan. Conflicts resolved in [Conflicts & omissions](#conflicts--omissions).

### Phase 0 — Governance & docs

| ID | Work | Score |
| --- | --- | --- |
| G1 | Hard rule: no new feature inputs on `DataGrid` (docs + review checklist) | 93 |
| G2 | This architecture doc + roadmap phases | — |

### Phase 1 — Plugins-only feature flags

| ID | Work | Score |
| --- | --- | --- |
| P1 | Drop legacy `[find]` / `[sideBar]` / `[enableClipboard]` inputs | 94 |
| P2 | Isolate plugin `setup` / notify errors (store/event-bus style) | 76 |
| P3 | Keep `@angular-libs/data-grid/plugins` secondary entry; split “enterprise” only if measured | 80 |

**Done when:** demos/tests use plugins only; one bad plugin cannot break activation of others.

### Phase 2 — Controller owns the row model

| ID | Work | Score |
| --- | --- | --- |
| C1 | Pipeline as pure functions / signals on `GridController` (`runClientRowPipeline` is source of truth) | 89 |
| C2 | Deepen `createGrid` for schema/state wiring only (columns, selection, plugins, optional edit schema) — never a feature-flags bag | 90 |
| C3 | Controller can compute filter→sort→stages→`DisplayRow[]` for tests without relying on template logic | 92* |

\*Deepens the existing controller; does **not** introduce a second public “headless grid” product.

**Done when:** unit tests assert display rows from controller/pipeline helpers; component reads pipeline outputs instead of re-implementing them.

### Phase 3 — Thin the API host

| ID | Work | Score |
| --- | --- | --- |
| A1 | Split `DataGridApiHost` into focused hosts (selection, columns, editing, viewport, events) | 87 |
| A2 | Typed plugin adapters on `createGrid` (replace duck-typed `rowGroup` lookup) | 81 |

**Done when:** `DataGrid` composes narrow hosts; `createGrid` exposes adapters with real types.

**Follow-up (P0a → Foundation v2):** Behavioral hosts under [`src/lib/hosts/`](./src/lib/hosts/) own domain state. `createDataGridSession` is the runtime root. The binder template binds hosts/session directly (F3); see [`src/lib/hosts/GOVERNANCE.md`](./src/lib/hosts/GOVERNANCE.md).

### Phase 4 — Chrome leaves the binder

| ID | Work | Score |
| --- | --- | --- |
| U1 | Extract chrome UI into slot-owned views (find bar, status, toolbar, sidebar shell) | 96 |
| U2 | Move sidebar panels into `@angular-libs/data-grid/plugins` (or a thin sidebar secondary entry) | 86 |

**Done when:** `data-grid.html` has no hard-coded find/sidebar panel feature trees; panels register via `slots.registerSidebar`.

### Phase 5 — Editing seams (Signal Forms)

| ID | Work | Score |
| --- | --- | --- |
| E1 | Dedicated editing module (kernel-adjacent): cell draft + full-row Signal Forms | 91 |
| E2 | Column editor registry (built-ins + custom resolve the same way) | 84 |
| E3 | Host-owned `rowForm` is the recommended path; session-owned form is a thin fallback | 85 |
| E4 | Optional thin `RowEditAdapter` (`start` / `commit` / `cancel` / `draft`) — not the primary DX | 78 |

**Done when:** edit template matrix shrinks; docs show host `form()` + `[(rowEditSession)]` as canonical.

### Phase 6 — Interactions & display kinds

| ID | Work | Score |
| --- | --- | --- |
| I1 | Column resize / reorder / row DnD as `registerInteraction` (or dedicated capability) contributions | 83 |
| V1 | Display-kind view registry beyond host `@switch` (plugins register kind → view) | 88 |

**Done when:** new row kinds and pointer interactions do not require editing `data-grid.ts` / `.html` feature branches.

---

## Broader product principles

| | Principle | Pros | Cons |
| --- | --- | --- | --- |
| **A** | Angular-native editable grid (not lite AG) | Clear niche; Signal Forms differentiator; easier to refuse Excel/canvas/col-virtualization | Feature checklists vs AG always look incomplete — docs must be sharp |
| **B** | Immutable host-owned rows + apply helpers | Predictable with signals; no hidden mutability | Slightly more host boilerplate than grids that own the row model |
| **D** | Held plugins + slots/capabilities | Matches store/dialog; tree-shakeable; expandable | Authors must learn slots vs capabilities |
| **E** | First-class column schema (display + edit + validation composed) | One coherent column story | Keep `ColumnDef` lean; compose Signal Forms schema beside it when needed |
| **F** | A11y & keyboard as kernel | Correct layer; raises quality vs many lite grids | Continuous investment; easy to regress during chrome extraction |
| **G** | Thin server-side contract (`serverSide` + query events) | Enough for real apps; plugins own fetch/infinite scroll | Temptation to grow into AG SSRM — hard boundaries |
| **H** | Demo-as-spec + PLUGINS.md as extension contract | Third-party plugins become realistic | Docs must ship with every extraction PR |
| **I** | Optional enterprise packaging later (group/tree/agg) | Smaller default bundle if measured | Premature until bundle metrics demand it |
| **J** | Resist string cell-renderer registries | Idiomatic Angular templates/components | AG migrants may miss string ids — mitigate with typed components + projection |

Skipped from the idea list: **C. Two-tier API** (binder + separate headless product). The controller deepens under the same DX; we do not market or maintain a second primary API surface.

---

## Conflicts & omissions

| Omitted / tempered | Reason |
| --- | --- |
| Two-tier / headless product (C) | Conflicts with single DX surface; controller work stays in Phase 2 without a second product |
| Preset packs beyond `defaultGridPlugins` (score 74) | Below threshold; easy to over-bundle |
| Directive/hook companions (70), per-plugin injectors (72) | Below threshold / later optional |
| Editing as optional plugin | Fights “kernel must stay” and Signal Forms positioning — use a **module**, not opt-in chrome |
| `RowEditAdapter` as primary API | Tempered by host-owned `rowForm` (E3); adapter is optional sugar (E4) |
| Virtualization / focus as plugins | Kernel concerns |
| `withX()` / ModuleRegistry | Non-goals |

---

## Package layout

| Package | Owns |
| --- | --- |
| `@angular-libs/data-grid` | Consumer surface: binder, `createGrid`, `DataGridApi`, editing, locale, chrome |
| `@angular-libs/data-grid/plugins` | Feature factories + `defaultGridPlugins` + sidebar panel components |
| `@angular-libs/data-grid/plugin` | Plugin-authoring contracts (slots, capabilities, kernel, focus, adapters) |
| `@angular-libs/data-grid/internals` | Unstable test/tooling (pipeline, column layout, hosts, row display) |

Optional later: `…/plugins/enterprise` **only** if bundle size demands it (I / P3).

`DataGridApi` feature methods are thin façades — prefer held adapters
(`groups.setColumns`, `ranges.clearRange`). `bind*Adapter` is `@internal`.

---

## Consumer DX (canonical)

```ts
import { applyCellEdit, createGrid } from '@angular-libs/data-grid';
import { form } from '@angular/forms/signals';
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
  viewport: { virtual: true },
  chrome: { contextMenu: true },
  plugins: [...defaultGridPlugins({ sideBar: false }), rowDragPlugin(), groups],
});

groups.setColumns(['role']);
```

```html
<al-data-grid
  [controller]="grid"
  [data]="rows()"
  [rowForm]="employeeForm"
  [(rowEditSession)]="session"
  [(selectedIds)]="selected"
  (cellEdit)="rows.set(applyCellEdit(rows(), $event, idOf))"
  (paste)="rows.set($event.suggestedRows)"
/>
```

Host owns `rows` and (for full-row edit) the Signal Forms tree; plugins own feature behavior; controller owns UX flags (`viewport` / `chrome` / `multiSort` / `serverSide`); kernel owns focus/viewport/editing seams.

## Delivery snapshot

| Phase | Status |
| --- | --- |
| 0 Governance & docs | ✅ |
| 1 Plugins-only flags + error isolation | ✅ |
| 2 Controller / `runGridRowModel` | ✅ |
| 3 Split API hosts + `getAdapter` | ✅ `composeDataGridApiHost` from behavioral hosts; typed `getAdapter` / guards |
| 4 Chrome extraction | ✅ toolbar / find / status / sidebar shell; panels in plugins |
| 5 Editing seams | ✅ host `rowForm` canonical (docs) + `RowEditSession` |
| 6 Interactions + display views | ✅ view registry overrides `group`; exclusive display builders |

### Foundation v2 (ownership)

| Wave | Status | Notes |
| --- | --- | --- |
| F0 | ✅ | Schema only on `createGrid` (no binder column/selection/editMode overrides); C1 flash/range; notes floating DOM = documented exception |
| F1 | ✅ | `ColumnLayoutHost` owns column writables + layout computeds |
| F2 | ✅ | `createDataGridSession` owns kernel + hosts + live row pipeline + API |
| F3 | ✅ | Template binds hosts/session directly; binder **~857 LOC** (governance ≤910; prefer ≤1000); tooltip CSS in binder styles; public host-slice types → `/plugin` |

Binder = Angular IO + template + keyboard coordinators. Runtime state lives on session/hosts.

### Follow-ups landed (post Phase 6 polish)

| Item | Status |
| --- | --- |
| Reactive `setPlugins` recomposition (id-key) | ✅ |
| `api.getLocale()` + localized plugin chrome | ✅ |
| Tree adapter + exclusive display builders | ✅ |
| Row reorder `fromId`/`toId` + drag gating | ✅ |
| Group-row keyboard focus / Enter expand | ✅ |
| Column id reconciliation | ✅ |

See [ROADMAP.md](./ROADMAP.md) for per-ID checkboxes.
