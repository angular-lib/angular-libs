# @angular-libs/data-grid — roadmap

Lightweight, **signal-first Angular grid**: host-owned immutable data, typed
plugins, no AG `ModuleRegistry` / god `gridOptions`.

Breaking changes OK until first publish.

**Full spec:** [ARCHITECTURE.md](./ARCHITECTURE.md) · **Product map:** [OVERVIEW.md](./OVERVIEW.md) · **Plugins:** [PLUGINS.md](./PLUGINS.md) · **Quick start:** [README.md](./README.md)

**Out of scope (for now):** column virtualization, Excel export, canvas cell layer,
separate headless product tier, `withX()` DSL. Cell range/fill is **planned**
(simpler than AG) — see OVERVIEW §5.

---

## Current foundation (done)

| Area | Status |
| --- | --- |
| **Kernel** | ✅ `GridKernel` — focus, find, chrome slots, plugin lifecycle |
| **Capabilities** | ✅ `GridCapabilities` — data stages, display builders, interactions, aggregates |
| **Plugins own behavior** | ✅ clipboard, find keys, infinite scroll, row group, tree, aggregate |
| **Store-style adapters** | ✅ `rowGroupPlugin()` → `RowGroupAdapter` |
| **Held-objects DX** | ✅ hold plugin instances; no `withX()` DSL |
| **`createGrid` / `[controller]`** | ✅ bootstrap columns + plugins; binds `api` on mount |
| **`defaultGridPlugins()`** | ✅ find + clipboard + status + sidebar preset |
| **Display pipeline** | ✅ filter → sort → plugin stages → `DisplayRow[]` → page/virtual |
| **Package split** | ✅ core + `@angular-libs/data-grid/plugins` |
| **Architecture spec** | ✅ [ARCHITECTURE.md](./ARCHITECTURE.md) — phases 0–6 |

### Deliberate non-goals

| Anti-pattern | Why avoided |
| --- | --- |
| AG `ModuleRegistry` + string modules | Heavy; poor tree-shake; not Angular-native |
| God `gridOptions` bag | Mixes schema, state, features, handlers |
| `withFind()` / router-style feature DSL | Prefer held objects + `defaultGridPlugins()` |
| Everything-is-a-plugin (incl. virtualization) | Kernel must stay |
| Two-tier headless product API | One surface: `<al-data-grid>` + `createGrid`; deepen controller in place |

---

## Phased delivery (from architecture spec)

### Phase 0 — Governance & docs

| ID | Item | Status |
| --- | --- | --- |
| G1 | No new feature inputs on `DataGrid` — plugins + controller only | ✅ documented |
| G2 | Architecture + roadmap aligned | ✅ |

### Phase 1 — Plugins-only feature flags

| ID | Item | Status |
| --- | --- | --- |
| P1 | Drop legacy `[find]` / `[sideBar]` / `[enableClipboard]` | ✅ |
| P2 | Plugin `setup` / notify error isolation | ✅ |
| P3 | Keep secondary plugins entry; enterprise split only if measured | ✅ policy |

### Phase 2 — Controller owns the row model

| ID | Item | Status |
| --- | --- | --- |
| C1 | Pipeline source of truth on controller / pure helpers | ✅ `runGridRowModel` |
| C2 | `createGrid` schema/state wiring only (no feature-flag bag) | ✅ editMode / rowEditSchema |
| C3 | Assert display rows in tests without template logic | ✅ `computeRowModel` |

### Phase 3 — Thin the API host

| ID | Item | Status |
| --- | --- | --- |
| A1 | Split `DataGridApiHost` into focused hosts | ✅ |
| A2 | Typed plugin adapters on `createGrid` | ✅ `pickAdapter` |

### Phase 4 — Chrome leaves the binder

| ID | Item | Status |
| --- | --- | --- |
| U1 | Slot-owned chrome views (find / status / toolbar / sidebar shell) | ✅ |
| U2 | Move sidebar panels into plugins package | ✅ + `DATA_GRID_SIDEBAR_HOST` |

### Phase 5 — Editing seams (Signal Forms)

| ID | Item | Status |
| --- | --- | --- |
| E1 | Kernel-adjacent editing module | ✅ `RowEditSession` |
| E2 | Column editor registry | ✅ `resolveCellEditor` |
| E3 | Host-owned `rowForm` canonical; session form fallback | ✅ |
| E4 | Optional thin `RowEditAdapter` | ✅ `rowEditAdapter` on `DataGrid` |

### Phase 6 — Interactions & display kinds

| ID | Item | Status |
| --- | --- | --- |
| I1 | Resize / reorder / row DnD via interaction capabilities | ✅ helpers extracted (`column-interactions` / `row-interactions`); handles stay template-bound |
| V1 | Display-kind view registry | ✅ `registerDisplayView` + `kind: 'plugin'` |

### Later (optional)

Prioritized product lista lives in [OVERVIEW.md](./OVERVIEW.md) §7. Snapshot:

| Item | Notes |
| --- | --- |
| A11y & keyboard matrix | Kernel quality; unblocks range a11y |
| Keyboard realms + header nav | Enterprise keystone — OVERVIEW §5c |
| Header / column menu (lean) | Not AG legacy/new dualism |
| Filter extensibility seam | Typed; no AG filter framework |
| Cell range + fill | Single rectangle + immutable fill — OVERVIEW §5 |
| Controller-owned rows + transactions | Opt-in `createGrid({ rows })` + `applyTransaction` — OVERVIEW §5a |
| Edit start/stop interaction | Presets + sparse overrides — OVERVIEW §5b (design first) |
| Server-side contract v2 | Hard boundaries vs AG SSRM |
| Enterprise packaging for group/tree/agg | Only if bundle size demands it (I / P3) |
| Publish prep | Changelog, semver, peer-deps note, demo polish |

---

## Consumer shape (canonical)

```ts
import { applyCellEdit, createGrid } from '@angular-libs/data-grid';
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
  [(selectedIds)]="selected"
  (cellEdit)="rows.set(applyCellEdit(rows(), $event, idOf))"
  (paste)="rows.set($event.suggestedRows)"
/>
```

## Current delivery status

Phases **0–6** complete for the modularization spec.

Post-phase polish (score ≥ 76 from expert review):

| Item | Status |
| --- | --- |
| Reactive `[plugins]` / `setPlugins` parity | ✅ |
| Host-owned `rowForm` docs as canonical DX | ✅ |
| `composeDataGridApiHost` narrow hosts | ✅ |
| Display view overrides (`group` / `plugin`) | ✅ |
| `api.getLocale()` + localized plugins | ✅ |
| Tree adapter + exclusive display builders | ✅ |
| Row reorder `fromId`/`toId` + drag gating | ✅ |
| Group a11y focus + viewport PageUp/Down | ✅ |
| Column-def id reconciliation | ✅ |

Remaining optional: server-side depth, further binder thinning, enterprise packaging, publish prep.

