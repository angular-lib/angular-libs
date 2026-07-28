# @angular-libs/data-grid — architecture

Lightweight, **signal-first Angular grid**: host-owned immutable data, typed
plugins, Signal Forms for row edit. Inspired by AG Grid’s useful core — not an
API clone.

See [ROADMAP.md](./ROADMAP.md) for phased delivery and [PLUGINS.md](./PLUGINS.md)
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
createGrid({ columns, plugins, … })     ← schema + held plugins (not feature flags)
        │
        ▼
GridController                          ← owns pipeline signals (filter→sort→stages→display)
        │
        ▼
GridKernel                              ← plugin lifecycle, slots, capabilities, focus/find
        │
        ├── slots          → chrome only (toolbar / status / sidebar / find flag / drag)
        └── capabilities   → row-model, interactions, aggregates, (later) editors / views
        │
        ▼
<al-data-grid>                          ← thin binder: bind controller, project templates,
                                          switch on DisplayRow.kind via view registry
```

**Rules**

1. **Do not** put feature logic in `data-grid.ts`.
2. **Do not** add new feature inputs on `DataGrid` — plugins + controller only.
3. Prefer `capabilities` / `slots` over reaching into the component.
4. Editing is **kernel-adjacent** (always available), not an optional chrome plugin.
5. Plugin activation is **imperative** on `GridKernel` only — never from an Angular
   `effect` (slot/capability writes would re-trigger it). Chrome toggles use held
   adapters (`sideBar.setEnabled`); rare list changes use `setPlugins` →
   `api.recomposePlugins`. Open tool-panel state uses `linkedSignal`, never an
   effect that writes `activeSidePanel`.

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
| `@angular-libs/data-grid` | Component binder, kernel, contracts, editing module, pipeline, `createGrid`, utils |
| `@angular-libs/data-grid/plugins` | Feature factories + `defaultGridPlugins` + sidebar panel components (Phase 4) |

Optional later: `…/plugins/enterprise` **only** if bundle size demands it (I / P3).

---

## Consumer DX (canonical)

```ts
import { applyCellEdit, createGrid, form } from '@angular-libs/data-grid'; // form from @angular/forms/signals
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

Host owns `rows` and (for full-row edit) the Signal Forms tree; plugins own feature behavior; kernel owns focus/viewport/editing seams.

## Delivery snapshot

| Phase | Status |
| --- | --- |
| 0 Governance & docs | ✅ |
| 1 Plugins-only flags + error isolation | ✅ |
| 2 Controller / `runGridRowModel` | ✅ |
| 3 Split API hosts + `pickAdapter` | ✅ `composeDataGridApiHost` + tree `pickAdapter` |
| 4 Chrome extraction | ✅ toolbar / find / status / sidebar shell; panels in plugins |
| 5 Editing seams | ✅ host `rowForm` canonical (docs) + `RowEditSession` |
| 6 Interactions + display views | ✅ view registry overrides `group`; exclusive display builders |

### Follow-ups landed (post Phase 6 polish)

| Item | Status |
| --- | --- |
| Reactive `[plugins]` recomposition (id-key) | ✅ |
| `api.getLocale()` + localized plugin chrome | ✅ |
| Tree adapter + exclusive display builders | ✅ |
| Row reorder `fromId`/`toId` + drag gating | ✅ |
| Group-row keyboard focus / Enter expand | ✅ |
| Column id reconciliation | ✅ |

See [ROADMAP.md](./ROADMAP.md) for per-ID checkboxes.
