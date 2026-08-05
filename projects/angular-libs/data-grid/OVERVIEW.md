# @angular-libs/data-grid — product overview

Living product map: what we build, what we refuse, and where the line sits
relative to AG Grid. Use AG docs as a **checklist of problems**, not APIs to
clone.

**Related:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [ROADMAP.md](./ROADMAP.md) ·
[PLUGINS.md](./PLUGINS.md) · [README.md](./README.md)

Breaking changes OK until first publish.

---

## 1. North star

| | |
| --- | --- |
| **For** | Angular 22+ apps that need editable, virtualized tables with signal-first DX |
| **Not for** | Excel-in-the-browser product identity (pivot, charts, formulas, deep SSRM, column virtualization) |
| **Capability** | Spreadsheet *interactions* (keyboard, range/fill later) without cloning Excel |
| **Differentiator** | Host-owned immutable rows + Signal Forms full-row edit + held plugins |
| **Success** | Minutes to first grid; predictable data flow; a11y baseline; lean default bundle |

### AG references (problem checklist)

| Layer | Docs |
| --- | --- |
| Grid | [Options](https://www.ag-grid.com/angular-data-grid/grid-options/), [Events](https://www.ag-grid.com/angular-data-grid/grid-events/), [API](https://www.ag-grid.com/angular-data-grid/grid-api/) |
| Column | [Properties](https://www.ag-grid.com/angular-data-grid/column-properties/), [Column object](https://www.ag-grid.com/angular-data-grid/column-object/), [Column events](https://www.ag-grid.com/angular-data-grid/column-events/), [Column group](https://www.ag-grid.com/angular-data-grid/column-object-group/) |
| Row | [RowNode](https://www.ag-grid.com/angular-data-grid/row-object/), [Row events](https://www.ag-grid.com/angular-data-grid/row-events/) |

---

## 2. Design stance (better paths)

| AG pattern | Our path | Why |
| --- | --- | --- |
| God `gridOptions` | `createGrid` schema + signals/`model()` + held plugins | Schema, UI state, and features stay separable and typed |
| `ModuleRegistry` + string modules | `fooPlugin()` objects + adapters | Tree-shakeable; Angular-native composition |
| Mutable `RowNode` / grid-owned default | Host-owned `T[]` by default; **opt-in controller-owned rows** (§5a) for transaction DX | Predictable signals; Excel-like API without AG ownership as default |
| Live `Column` + per-column events | Lean `ColumnDef` + resolved layout + grid outputs | No long-lived column instance API |
| `RowNode` event bus | `DisplayRow` + focused `(rowClick)` / selection models | Rows are data, not event emitters |
| String component registries | Typed `Type` + `alGridCell` / projection | Idiomatic Angular |
| Mega `GridApi` | Small `DataGridApi` + plugin adapters | Feature ops live on held plugins (`groups.setColumns`) |
| Event-listener soup | Focused Angular `output()`s | Discoverable, typed, OnPush-friendly |

```
createGrid({ columns, plugins, … })
        │
        ▼
GridController  →  GridKernel (slots, capabilities, focus/find)
        │
        ▼
<al-data-grid>  thin binder + DisplayRow views
```

**Governance:** do not add new feature inputs on `DataGrid` — compose plugins +
`createGrid`.

---

## 3. Status legend

| Status | Meaning |
| --- | --- |
| **Done** | Shipped and used in demos/tests |
| **Partial** | Useful core exists; intentional gaps remain |
| **Better-path** | Same problem, deliberately different API |
| **Later** | Planned; design notes below or in backlog |
| **Never** | Out of product identity (revisit only under hard need + metrics) |

---

## 4. Domain map (AG → ours)

### 4.1 Columns & layout

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Column defs | **Done** | `ColumnDef` / `ColumnGroupDef` / `ColumnOrGroupDef` | Lean vs AG ColDef; typed renderers/editors |
| Default / typed columns | **Partial** | `type` infers filter/editor | No `defaultColDef` / `columnTypes` map — compose helpers in app if needed |
| Column groups | **Done** | Nested `ColumnGroupDef`; membership + colspan | No AG padding-group / dual ColumnGroup objects |
| Pin / hide / order / width / flex | **Done** | Inputs + `DataGridState` + `api.setColumnPinned` | Header pin context menu |
| Resize / reorder | **Done** | Interactions + `(columnOrderChange)` | Reorder constrained within groups |
| Autosize | **Done** | `api.autoSizeColumns` / `autosizePlugin` | |
| Column object API | **Better-path** | Resolved columns via `api.getColumnsById` / layout state | No mutable `Column`, no `addEventListener` |
| Column events | **Better-path** | Grid-level `sortChange`, `filterChange`, `columnOrderChange`, `stateChange` | No per-column event bus |
| Column header menu | **Later** | Header pin menu today | Lean menu later — not AG legacy/new dualism |
| Column virtualization | **Never** | — | Row virtualization only |

**ColumnDef checklist** (vs [column-properties](https://www.ag-grid.com/angular-data-grid/column-properties/)):

| Concern | We have | We skip / later |
| --- | --- | --- |
| Identity / field / header | `id`, `field`, `header` | `headerValueGetter` (later if needed) |
| Size | `width`, `minWidth`, `flex` | `maxWidth`, auto-height columns |
| Sort / filter / edit | `sortable`, `filter`, `editable`, editors | Advanced filter params / AG filter framework |
| Pin / hide / align / type | `pinned`, `hide`, `align`, `type` | Pivot / row-group allow flags on col (plugin owns grouping) |
| Values | `valueGetter` / `Formatter` / `Setter` | Value parsers as separate AG concept |
| Render | `cellRenderer` Type + templates | String registry, sparklines |
| Agg | `aggFunc` + `aggregateRowPlugin` | Pivot value columns |

### 4.2 Rows & display

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Row identity | **Done** | `rowId` on createGrid / input | Host `T`; no `RowNode` |
| Display pipeline | **Done** | filter → sort → stages → `DisplayRow[]` → page/virtual | `computeRowModel` / `runGridRowModel` |
| Display kinds | **Done** | `data` \| `group` \| `plugin` + `registerDisplayView` | |
| Row class | **Done** | `[rowClass]` | |
| Row events | **Better-path** | `(rowClick)`, `(selectionChange)`, `(rowReorder)` | No per-row listener API |
| Row pinning (top/bottom data) | **Partial** | Aggregate footer via plugin | Full pinned-row model **Later** if needed |
| Full-width rows | **Later** | Via display view / plugin kind | Keep out of binder |
| Master/detail | **Later** | — | Prefer plugin + display kind if ever |
| Mutable RowNode | **Never** | — | Host owns data |

### 4.3 Sorting, filtering, selection

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Multi-sort | **Done** | `[multiSort]`, `api.get/setSortModel`, `(sortChange)` | Custom `comparator` |
| Column filters | **Done** | text/number/boolean/date/set + floating | Simple string models, not AG filter instances |
| Quick / external filter | **Done** | `[(quickFilter)]`, `[externalFilter]` | |
| Filter API | **Partial** | `get/setFilterModel`, `clearFilters` | No `getColumnFilterInstance` |
| Custom filter components | **Later** | — | Typed seam; refuse AG filter-module explosion |
| Row selection | **Done** | `none` \| `single` \| `multi`, `[(selectedIds)]` | Depth / coexistence — §5d |
| Cell range selection | **Later** | Prepared seam — §5 | Coexists with rows — §5d (not AG exclusive) |
| Checkbox selection UX | **Partial** | Multi selection column | Polish in Wave 3 per §5d |

### 4.4 Editing

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Cell edit | **Done** | `(cellEdit)` + `applyCellEdit` | Built-in + custom editors |
| Full-row Signal Forms | **Done** | `[rowForm]`, `[(rowEditSession)]`, `(rowEdit)` | Canonical DX |
| Start/stop interaction | **Partial** | dblclick, Enter/F2, Escape, blur→commit | Policy design — §5b (not AG flag soup) |
| Read-only / host commit | **Better-path** | Always host-owned writes | Same spirit as AG `readOnlyEdit` without the flag maze |
| Batch edit | **Later** | Host drafts / Signal Forms | Not a grid-owned pending map |
| Undo / redo | **Later** | Host history helper over apply events | Not a mutable in-grid stack |
| Fill handle | **Later** | Same primitive as paste — §5 | |

### 4.5 Clipboard, find, export

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Copy / paste | **Done** | `clipboardPlugin` → `(paste)` + `suggestedRows` | TSV matrix |
| Process cell hooks | **Partial** | Host transforms on `(paste)` | Prefer host/plugin options over AG callback soup |
| Find | **Done** | `findPlugin`, `api.findNext/Prev` | |
| CSV | **Done** | `api.exportCsv` / `csvExportPlugin` | |
| Excel | **Never** | — | |

### 4.6 Chrome & accessories

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Toolbar / status / sidebar / find bar | **Done** | Slot-owned chrome + plugins | |
| Context menu | **Done** | `[contextMenu]`, typed items, plugin items | |
| Side bar API | **Better-path** | Held `sideBar` adapter | No mega accessory API on `DataGridApi` |
| Column chooser | **Done** | Columns sidebar panel | |
| Overlays | **Partial** | loading / empty projection | |

### 4.7 Grouping, tree, aggregation

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Row grouping | **Done** | `rowGroupPlugin` + adapter | Exclusive with tree |
| Tree data | **Done** | `treeDataPlugin` + adapter | |
| Expand / collapse | **Done** | API + adapter + keyboard | |
| Aggregate footer | **Done** | `aggregateRowPlugin` + `aggFunc` | |
| Pivot | **Never** | — | |
| Group agg UI like AG Enterprise | **Never** / measured later | — | |

### 4.8 Row models & scrolling

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Client-side pipeline | **Done** | Default | |
| Pagination XOR virtual | **Done** | `[pagination]` / `[virtual]` | Custom window, not CDK |
| Infinite scroll | **Done** | `infiniteScrollPlugin` → `(nearEnd)` | |
| Thin server-side | **Partial** | `[serverSide]` + `(queryChange)` | Host fetches |
| Deep SSRM (block cache, server group) | **Later** | Contract v2 only under boundaries | Refuse AG SSRM sprawl |
| Viewport row model | **Never** | — | |

### 4.9 Keyboard, a11y, styling

| Domain | Status | Our surface | Notes |
| --- | --- | --- | --- |
| Body focus / arrows / Home End / Page | **Done** | `FocusController` + roving `tabindex` on cells | |
| Edit keys / select-all / group Space | **Done** | | |
| Header keyboard navigation | **Later** | — | Enterprise gap — §5c |
| Body ↔ header continuum | **Later** | — | §5c |
| Tab enter/leave grid | **Partial** | Roving tabindex into body | Full page-citizen Tab — §5c |
| Custom nav / suppress hooks | **Later** | — | Sparse; not AG’s five callbacks |
| Full a11y matrix | **Later** | Kernel priority — §5c + backlog | Leave room for cell `aria-selected` (range) |
| Theming | **Done** | `--al-dg-*` CSS variables | No AG theme packs |
| Tooltips | **Done** | `AlTooltipDirective` (no CDK) | |
| Locale | **Done** | `[locale]` + `api.getLocale()` | |

### 4.10 Misc AG surfaces → Never

Integrated charts, formulas / calculated columns, AI toolkit, canvas cell layer,
AG `components` string map, `ModuleRegistry`, Excel export, column virtualization.

---

## 5. Cell range + fill (prepared seam)

We will likely need range/fill. **Do not clone AG** multi-disjoint ranges and
fill-handle identity. Prefer **simpler and better**.

### Target model

| Principle | Choice |
| --- | --- |
| Scope v1 | **One contiguous rectangle**: `anchor` + `active` (`FocusCell`) |
| Packaging | Opt-in `cellRangePlugin()` (name TBD) — not kernel identity |
| Coordinates | `{ rowIndex, columnId }` on **display** rows; resolve data via `DisplayRow` + `rowId` |
| vs row selection | **Separate** from `[(selectedIds)]` — never overload row selection for cells |
| Keyboard | Shift+arrows extend `active`; focus stays kernel-owned |
| Clipboard | When a range exists, copy/paste use the range matrix (extend `clipboardPlugin`) |
| Fill | **Same as paste**: emit `(fill)` or reuse `(paste)` with `suggestedRows` → host applies |
| Multi-range | **v2+ / Never unless measured** |
| Series fill | Start with **copy-fill**; smart series (dates/numbers) as optional pure util later |

### Direction score

| Approach | Score |
| --- | --- |
| Single-range + immutable fill | **86** |
| AG multi-range / fill-handle parity | **~45** |

### Prepare now (do not implement yet)

1. Keep `FocusCell` as `{ rowIndex, columnId }` — stable coordinate system.
2. Keep paste → `(paste)` + `suggestedRows` as the write primitive for fills.
3. Do not put cell selection into `selectedIds`.
4. Reserve a plugin id + `registerInteraction` capability — **no** new `DataGrid` inputs.
5. A11y work must not forbid cell-level `aria-selected` later.
6. Document `CellRange` / `FillEvent` shapes in this file when implementation starts:

```ts
// Sketch only — not shipped
interface CellRange {
  anchor: FocusCell;
  active: FocusCell;
}

interface FillEvent<T> {
  range: CellRange;
  source: CellRange; // cells dragged from
  matrix: string[][];
  suggestedRows: T[];
}
```

### Implementation phases (when picked from backlog)

1. Types + highlight CSS + Shift+arrow extend (read-only range)
2. Clipboard copy/paste bound to range
3. Drag-select + fill handle → suggested rows
4. Optional: series fill util; still host-applied (or controller rows when opted in)

---

## 5a. Row data updates — opt-in controller-owned rows (**chosen**)

AG [`applyTransaction`](https://www.ag-grid.com/angular-data-grid/data-update-transactions/)
assumes the grid owns the client row model. We will **not** put that on
`DataGridApi` against one-way `[data]`.

**Chosen direction (score 88):** opt-in writable rows on `GridController`.
Default remains host-owned `[data]`. Pure `applyRowTransaction` util backs both.

### Why not the alternatives

| Option | Score | Verdict |
| --- | --- | --- |
| Pure util only | 92 | Still ship — foundation for controller tx |
| **Controller-owned rows (opt-in)** | **88** | **Chosen** for transaction / paste / fill write-back |
| Optional `[(data)]` model on binder | 84 | Defer; controller ownership is clearer than two writers on the component |
| `api.applyTransaction` mutating internal copy | 28 | Rejected — AG trap |
| Grid-owned rows as default | 35 | Rejected — erases north star |

### Target API (shipped Wave 3)

```ts
import { signal } from '@angular/core';
import { applyRowTransaction, createGrid } from '@angular-libs/data-grid';

const rows = signal<Emp[]>([...initial]);

const grid = createGrid({
  columns,
  rowId: (r) => r.id,
  rows, // opt-in WritableSignal<readonly T[]>
  plugins: defaultGridPlugins(),
});

// Imperative batch updates (immutable replace under the hood)
grid.applyTransaction({
  add: [{ id: '4', name: 'Billy' }],
  update: [{ id: '2', name: 'Bob' }],
  remove: [{ id: '5' }], // id-only ok when rowId is set
});

grid.setRows(next);           // full replace
grid.rows();                  // readonly read
```

```html
<!-- Same signal drives the binder — one source of truth -->
<al-data-grid [controller]="grid" [data]="grid.rows()" />
```

Or pass the same `rows` signal the host already holds:

```ts
const rows = signal<Emp[]>([...]);
const grid = createGrid({ columns, rowId: (r) => r.id, rows });
// host may still rows.set(...) directly; grid.applyTransaction uses the same signal
```

### Rules

1. **`rows` option omitted** → no `applyTransaction` / `setRows` (or they throw / no-op with clear error). Host uses `applyCellEdit` / `applyRowEdit` / `applyRowTransaction` + `rows.set`.
2. **`rows` provided** → controller methods write that signal; binder still takes `[data]` (typically `grid.rows()`). No silent second copy inside the grid component.
3. **`rowId` required** (or strongly recommended) for `update` / `remove` matching — no object-reference matching (AG’s slow path).
4. **Server-side mode** → transactions are host/server concerns; controller tx may be disabled or documented as client-only.
5. **Edit / paste / fill** → when controller owns rows, optional convenience: grid (or thin helper) can `applyTransaction` / `setRows` from suggested payloads so demos need less boilerplate. One-way `[data]` apps unchanged.
6. **Not on `DataGridApi`** — lives on `GridController` (same place as schema). Keeps the API façade small.
7. **No `RowNode` transaction result** — return `{ rows: T[]; added: T[]; updated: T[]; removed: T[] }` plain data (or just void + new `rows()`).

### Pure util (ship with or before controller wiring)

```ts
interface RowTransaction<T> {
  add?: readonly T[];
  /** Insert add[] at this index in the source array (optional). */
  addIndex?: number;
  update?: readonly T[];  // matched by rowId
  remove?: readonly T[];  // matched by rowId; partial rows ok if id present
}

function applyRowTransaction<T>(
  rows: readonly T[],
  tx: RowTransaction<T>,
  rowId: (row: T, index: number) => string | number,
): T[];
```

`grid.applyTransaction(tx)` ≡ `rows.set(applyRowTransaction(rows(), tx, rowId))`.

### Implementation phases

1. `applyRowTransaction` util + unit tests (id match, addIndex, missing ids)
2. `createGrid({ rows })` + `grid.rows` / `setRows` / `applyTransaction`
3. Docs + demo: CRUD buttons without host reimplementing merge
4. Optional: paste/edit auto-apply when controller has `rows` (feature-flag / opt-in on createGrid, not a new DataGrid input)

### Prepare / non-goals

- Do **not** grow `DataGridApi` with AG transaction methods.
- Do **not** make controller rows the default.
- Do **not** implement AG delta-sort / changed-path until measured pain.
- Defer binder `[(data)]` unless controller path proves insufficient.

---

## 5b. Edit start/stop interaction (**shipped: presets + sparse overrides**)

AG [start/stop editing](https://www.ag-grid.com/angular-data-grid/cell-editing-start-stop/) is a useful
**behavior checklist**. Copying `singleClickEdit` + `enterNavigatesVertically` +
`enterNavigatesVerticallyAfterEdit` + `stopEditingWhenCellsLoseFocus` +
`suppressClickEdit` as separate options is the trap.

We want the good UX, on `createGrid`, without locking into a wrong nested bag.

### Current behavior (with `editInteraction`)

| Action | `'default'` | `'excel'` |
| --- | --- | --- |
| Pointer start | Double-click | Single click |
| Keyboard start | Enter / F2 start edit | Same |
| Enter while editing | Commit | Commit + move down |
| Editor blur | Commit | Commit |
| Boolean cell | Enter/F2 toggles value (no draft editor) | Same |
| Cancel | Escape | Same |

Sparse overrides: `{ pointerStart, enterIdle, enterEditing, editorBlur }`.
`enterIdle: 'moveDown'` moves focus on Enter without opening an editor (F2 still edits).
`pointerStart: 'none'` ≈ suppress click/dblclick edit (API / custom UI starts edit).

### Why the first `editInteraction` sketch needs adjustment

| Sketch field | Risk | Adjustment |
| --- | --- | --- |
| `start: 'dblclick' \| 'click' \| 'keyboard-only'` | Mixes pointer + keyboard into one axis; “keyboard-only” hides that Enter/F2 should usually stay on | Split **pointer** vs **keyboard** |
| `enter: 'edit' \| 'moveDown' \| 'editThenMoveDown'` | Idle vs editing are different moments; one enum forces awkward combos | Split **idle Enter** vs **editing Enter**, or use a **preset** |
| `tab: 'commitAndMove' \| 'browser'` | Underspecified (next cell vs next *editable*; Shift+Tab; fullRow) | Defer until Tab is implemented; don’t freeze the union early |
| `blur: 'commit' \| 'cancel'` | Blur of editor ≠ focus leaving the grid; AG’s painful case is “save button outside” | Name as **editor blur**; grid-leave can follow later |
| `typeToEdit: boolean` | Too coarse; fights find/selection shortcuts | Later: `'off' \| 'replace'` (maybe more) — not in v1 |
| Fat nested object on day one | Becomes mini-`gridOptions`; hard to evolve | Prefer **presets** + sparse overrides; ship fields only when wired |

### Design principles (anti lock-in)

1. **Presets first** — name the product behaviors (`'default' | 'excel'`), then allow sparse overrides.
2. **Orthogonal axes** — pointer start ≠ Enter idle ≠ Enter while editing ≠ blur ≠ Tab.
3. **Cell-mode scoped v1** — full-row keeps its own Enter/commit; don’t pretend one bag rules both.
4. **Lives on `createGrid` / controller** — binder reads it; **no** new `DataGrid` feature inputs.
5. **FocusController stays the seam** — policy configures callbacks (`onStartEdit`, commit+move), not a parallel key router.
6. **Ship incrementally** — each field lands only with tests + demo; undocumented keys do not exist.
7. **Open to rename until `0.1`** — treat this section as the working draft.

### Proposed shape (draft — subject to change)

```ts
/** Product presets — preferred DX over hand-rolling every axis. */
type EditInteractionPreset = 'default' | 'excel';

/**
 * Sparse overrides. All keys optional; omitted = preset default.
 * Only add a key here when an implementation ships it.
 */
interface EditInteractionConfig {
  /** Pointer gesture to enter cell edit. Default: 'dblclick'. */
  pointerStart?: 'dblclick' | 'click' | 'none';

  /**
   * Enter when focused cell is idle (not editing).
   * Default: 'startEdit'. Excel preset: 'moveDown' is wrong for most forms —
   * excel preset uses startEdit idle + commitAndMoveDown while editing.
   */
  enterIdle?: 'startEdit' | 'moveDown';

  /** Enter while cell editor is open. Default: 'commit'. */
  enterEditing?: 'commit' | 'commitAndMoveDown';

  /** Built-in text/number (etc.) editor blur. Default: 'commit' (current). */
  editorBlur?: 'commit' | 'cancel';

  // --- not in v1 (documented intent only) ---
  // tabEditing?: 'commitAndMove' | 'browser';
  // typeToEdit?: 'off' | 'replace';
}

type EditInteractionInput = EditInteractionPreset | EditInteractionConfig;

createGrid({
  editMode: 'cell',
  editInteraction: 'default', // or 'excel' or { pointerStart: 'click', enterEditing: 'commitAndMoveDown' }
});
```

**Preset meanings (draft):**

| Preset | pointerStart | enterIdle | enterEditing | editorBlur |
| --- | --- | --- | --- | --- |
| `'default'` | `dblclick` | `startEdit` | `commit` | `commit` |
| `'excel'` | `click` | `startEdit` | `commitAndMoveDown` | `commit` |

Keyboard **F2** always starts edit when idle (unless we later add an explicit suppress).  
`pointerStart: 'none'` ≈ AG `suppressClickEdit` (API / custom UI starts edit).

### Resolved behaviors to keep explicit in docs

- **Boolean columns:** toggle on activation — not governed by `enterEditing` draft flow.
- **Moving down:** uses focus `move(1, 0)` after successful commit; skip non-data rows.
- **Failed validation (fullRow):** do not move; cell mode usually has weak validation today.
- **Server-side / read-only host:** interaction only opens editors; writes still via events / controller rows (§5a).

### Phased delivery (when scheduled)

| Phase | Ship | Status |
| --- | --- | --- |
| 0 | Document current contract in README/OVERVIEW | ✅ |
| 1 | `editInteraction: 'default' \| 'excel' \| { pointerStart }` | ✅ Wave 3 |
| 2 | `enterIdle` + `enterEditing` | ✅ Wave 3 |
| 3 | `editorBlur` override | ✅ Wave 3 |
| 4 | Tab policy (new keys after real design) | Later |
| 5 | `typeToEdit` after shortcut matrix is stable | Later |

Also: `api.startEditingCell(rowId, columnId)` when we need symmetry with row edit — independent of the policy bag.

### Rejected

| Idea | Why |
| --- | --- |
| AG’s five separate gridOptions | Flag soup; poor discoverability |
| Single `enter` enum for idle+editing | Ambiguous; hard to extend |
| Putting policy on `DataGrid` inputs | Violates governance |
| Shipping full `EditInteractionConfig` on day one | Locks names before use teaches us |

### Score

| Approach | Score |
| --- | --- |
| Presets + sparse orthogonal overrides (§5b) | **91** |
| First nested sketch as-is | **68** | Too easy to freeze wrong unions |
| AG option parity | **32** |

---

## 5c. Keyboard navigation & focus (**enterprise keystone**)

AG [keyboard navigation](https://www.ag-grid.com/angular-data-grid/keyboard-navigation/)
is one of the strongest reasons teams pick an “enterprise” grid. Body arrows alone
are not enough — **header navigation, Tab as a page citizen, and a published key
matrix** are what make a grid feel serious.

This is backlog priority **#1** (tied with a11y). Design here before growing
`FocusController` into an untested switch jungle.

### What AG does well (learn)

| AG idea | Why it’s good | Take for us |
| --- | --- | --- |
| Body cell navigation (arrows, Home/End, Page, Ctrl+line) | Expected spreadsheet muscle memory | Keep / complete (we have most body keys) |
| **Header is a first-class focus target** | Sort, menu, filters without the mouse | **Must have** for enterprise |
| Arrow from first body row → header (and back) | One continuous surface | **Must have** |
| Group Enter expand/collapse | Obvious | Done |
| Space toggles row selection | Common pattern | Done |
| Tabbing into/out of the grid | Grid lives in forms/pages | Restore last focus; don’t trap forever |
| Escape hatch for custom cell content | Renderers with buttons/inputs | Inner-focus mode + sparse suppress |
| Documented key behaviour | Supportable product | Publish a **Keyboard Matrix** doc |

### What AG does poorly (avoid)

| AG pattern | Why avoid |
| --- | --- |
| Huge header key combo matrix (Alt/Ctrl/Shift+Enter variants for range, sort, filter, menu) | Cognitive overload; couple range before we have range |
| Five separate nav callbacks + `rowIndex: -1` magic for “go to header” | Opaque; hard to type; mini framework |
| `suppressCellFocus` / `suppressHeaderFocus` as god-options | Prefer focus realms + “chrome only” if needed |
| `cellKeyDown` as primary extension | Prefer typed actions / sparse hooks; hosts can still listen to DOM if needed |
| Per-column `suppressKeyboardEvent` as the default extension story | Escape hatch OK; don’t make every app implement it |

### Better model: focus realms + action map

Evolve kernel focus from “body cell only” to an explicit **focus model**:

```ts
// Draft — not shipped
type FocusRealm = 'body' | 'header' | 'floatingFilter';

interface GridFocus {
  realm: FocusRealm;
  columnId: string;
  /** Body: display row index. Header: header row index (0 = groups, 1 = leaves, …). */
  rowIndex: number;
}
```

**Roving tabindex** (already started on body cells): one Tab stop into the grid
surface; arrows move focus; Tab leaves to the next page control (unless editing /
inner-focus). This matches the ARIA grid pattern better than tabbing every cell.

```
Page Tab order:  … → [grid: one stop] → toolbar/pager/outside → …
Inside grid:     arrows / Home / End / Page / Enter / Space / F2
```

### Default key matrix (product contract)

**K0 published:** see [KEYBOARD.md](./KEYBOARD.md) for the body matrix + checklist.

**Body (data / group rows)** — Done (K0):

| Key | Action |
| --- | --- |
| ←↑→↓ | Move focus |
| Home / End | First / last column on row |
| Ctrl/Cmd+Home / End | First / last row |
| PageUp / PageDown | Viewport-sized jump |
| Enter / F2 | Start edit (or group toggle) — see §5b |
| Space | Toggle row selection / group |
| Escape | Cancel edit / close menu |
| Ctrl/Cmd+A | Select all (multi) |
| Shift+arrows | Extend cell range (**when** §5 plugin active) |

**Header (Later — enterprise gap):**

| Key | Action |
| --- | --- |
| ←→ | Move across header cells |
| ↑↓ | Between header rows (groups ↔ leaves); ↓ from leaf header → body row 0 |
| Enter | Toggle sort (Shift+Enter multi-sort) |
| Alt+↓ | Open lean column menu (§ backlog) |
| Escape | Close menu / return focus |

**Floating filters (Later):** Enter focuses filter control; Escape returns to
header cell (AG’s pattern is good here — steal it).

**Do not** ship AG’s range-selection header Enter variants until §5 exists.

### Customization (sparse, typed)

Prefer **one** extension point over AG’s five callbacks:

```ts
// Draft — on createGrid / FocusController
navigateFocus?(ctx: {
  event: KeyboardEvent;
  from: GridFocus;
  intent: 'arrow' | 'tab' | 'home' | 'end' | 'page';
  proposed: GridFocus | null; // null = stay
}): GridFocus | null | 'default' | 'browser';
```

- Return `'default'` → use built-in matrix  
- Return `'browser'` → don’t preventDefault (Tab out, etc.)  
- Return a `GridFocus` → go there (including `realm: 'header'`)  
- No magic `rowIndex: -1`

Optional later: `column.suppressKeys?: ...` or `keyboard?: 'cell' | 'inner'` for
custom renderers that contain focusable controls (Tab cycles inside, then moves).

### Integration with other seams

| Seam | Keyboard link |
| --- | --- |
| §5b editInteraction | Enter/F2/Tab-while-editing owned by edit policy; focus owns idle navigation |
| §5 cell range | Shift+arrows extend `active`; focus `anchor` stays |
| §5a controller rows | Irrelevant to focus; writes stay separate |
| Find plugin | Ctrl/Cmd+F should not fight type-to-edit (§5b phase 5) |
| Plugins | May register **key actions** via capability later — don’t fork another keydown on the binder |

### Implementation phases

| Phase | Work | Done when |
| --- | --- | --- |
| **K0** | Publish Keyboard Matrix (current body behaviour) in docs | ✅ [KEYBOARD.md](./KEYBOARD.md) |
| **K1** | ARIA pass: `role=grid` tree, row/col indexes, focused header/cell tabindex | ✅ Wave 1 |
| **K2** | Header focus realm + sort via Enter; roving tabindex on headers | ✅ Wave 2 |
| **K3** | Body ↔ header arrow bridge; floating filter Enter/Esc | ✅ Wave 2 |
| **K4** | Tab enter/leave: restore last `GridFocus`; frame tabindex | ✅ Wave 2 |
| **K5** | Wire §5b Enter-move-down / Tab-while-editing | Edit + nav feel Excel-capable |
| **K6** | Sparse `navigateFocus` hook + custom-cell inner focus pattern | Escape hatches without AG soup |
| **K7** | Shift+arrows → cell range (§5) | Range keyboard complete |

Keep logic in **`FocusController` (or a thin `KeyboardController` beside it)** —
not in `data-grid.ts` feature branches. Unit-test the matrix without the template.

### Scores

| Approach | Score |
| --- | --- |
| Realms + published matrix + phased header/Tab (**§5c**) | **94** |
| Body-only forever | **50** | Fine for lite tables; not enterprise |
| Clone AG header combo + 5 nav callbacks | **40** | Power, but wrong DX/complexity |
| Make every cell a Tab stop | **35** | Fights forms; poor a11y for large grids |

---

## 5d. Selection policy — row + cell range coexistence (**chosen**)

AG made row selection and cell selection mutually exclusive (painful for apps that
need both). We do **not**.

### Defaults

| Rule | Choice |
| --- | --- |
| Coexistence | Row selection (`selectedIds`) and cell range are **both allowed** |
| Pointer — rows | Checkbox / selection column toggles **rows** |
| Pointer — range | Drag / Shift+arrows on cells own **range** (when `cellRangePlugin` is on) |
| Clearing | Starting a cell range **does not clear** row selection (status can show both) |
| Space | Toggles **row** under focus (unchanged) |
| Copy priority | If range is non-empty → copy **range**; else → selected **rows** |
| Exclusive modes | **Rejected** as default (AG trap) |

### Implementation notes

- Never store cell selection in `selectedIds`.
- Range state lives on the range plugin / focus anchor+active (§5).
- `isRowSelectable` and optional `rowClickSelects` shipped in Wave 3 (selection depth).
- Default: checkbox / Space toggle rows; row click does **not** select unless `rowClickSelects: true`.
- Clipboard plugins read coexistence rules when both are active.

**Score:** coexistence **90**; AG exclusive default **35**.

---

## 6. Our public surface (inventory)

### Outputs (`DataGrid`)

`sortChange`, `filterChange`, `cellEdit`, `rowEdit`, `rowEditStart`, `rowEditCancel`,
`cellClick`, `rowClick`, `selectionChange`, `queryChange`, `stateChange`,
`columnOrderChange`, `contextMenuOpened`, `contextMenuClosed`, `findMatchesChange`,
`rowReorder`, `paste`, `nearEnd`, `apiReady`

### Models / key inputs

Models: `selectedIds`, `quickFilter`, `hiddenColumnIds`, `findQuery`, `rowForm`,
`rowEditSession`, `rowEditDraft`

Layout / behavior inputs (non-feature): **`controller` (required)**, `data` (required),
pagination/virtual, `serverSide`, `externalFilter`, `editMode`, `locale`, optional
`[plugins]` / `[columns]` overrides, chrome toggles like `showToolbar` / `floatingFilters`, etc.

Toolbar actions (`[toolbarActions]` / plugin `registerToolbar`) receive
`{ api, controller, context, event }` — `controller` is always the bound `createGrid`
instance; `context` stays host-only. See [PLUGINS.md](./PLUGINS.md).

**Rule:** new *features* → plugins, not new feature-flag inputs.

### `DataGridApi` (intentional small set)

CSV / autosize · filter/sort/quick models · state get/set · selection · find ·
focus · row edit start/stop · row group / tree bind + expand · clipboard text ·
locale · `recomposePlugins`

Feature-heavy ops prefer **held adapters** (`rowGroupPlugin().setColumns`).

### Plugins (`@angular-libs/data-grid/plugins`)

| Default preset | Opt-in |
| --- | --- |
| find, clipboard, statusBar, sideBar | csvExport, autosize, rowDrag, aggregateRow, infiniteScroll, rowGroup, treeData, notes, flashCells |

Future: `cellRangePlugin` (§5).

---

## 7. Prioritized next backlog

Ordered by **foundation waves** (§10). Score ≥ 75 to schedule.

| Wave | Item | Score | Acceptance sketch |
| --- | --- | --- | --- |
| 0 | **Selection policy §5d** + gap/perf stubs | 90 | Docs locked (this file) |
| 1 | **Keyboard matrix K0 + ARIA K1** | 94 | §5c; checklist green |
| 1 | **`applyRowTransaction` util** | 92 | Exported + tests; §5a phase 1 |
| 2 | **Focus continuum K2–K4** + column-menu stub | 94 | Header realm, bridge, Tab citizen |
| 3 | **Edit interaction §5b** (presets first) | 91 | ✅ `'default'\|'excel'` + sparse overrides |
| 3 | **Controller-owned rows §5a** | 88 | ✅ `createGrid({ rows })` + `applyTransaction` |
| 3 | **Selection depth** per §5d | 86 | ✅ Click/checkbox/Space; `isRowSelectable` |
| 4 | **Lean column menu** | 80 | Pin / autosize / hide / sort |
| 4 | **Cell range + fill §5** | 86 | Single rect; copy priority §5d |
| 5 | **SSRM v2 / publish / filters / …** | — | After foundation — §10 Wave 5 |

Optional / lower:

| Item | Score | Note |
| --- | --- | --- |
| Public surface freeze / changelog | 90 | Continuous until `0.1` |
| Undo/redo host helper | 81 | Pure util over edit/paste/fill events |
| Binder `[(data)]` model mode | 84 | Deferred — prefer §5a |
| Enterprise package split | 83 | Only if bundle metrics demand |
| Master/detail via display kind | 74 | Below threshold until needed |

---

## 8. Success themes (beyond features)

### DX

- Held plugins + adapters (store-style)
- Signal Forms full-row edit as canonical
- Immutable apply helpers
- TypeScript-first `ColumnDef`
- Demo-as-spec in the workspace demo app

### UX

- Clear focus ring; empty/loading states
- Density via `--al-dg-*`
- Find / clipboard / sidebar affordances that feel native, not bolted-on Excel

### A11y

- Kernel-owned keyboard map
- Target a practical WCAG-oriented grid pattern
- Regression checklist in CI-friendly tests where possible

### Testing

- Pipeline / controller unit tests without template
- Plugin isolation (one bad plugin does not break others)
- Demo scenarios for edit, group, paste, state restore

### Packaging

- `@angular-libs/data-grid` + `/plugins`
- Enterprise split only when measured
- No CDK dependency

### Interop

- Optional bridges (e.g. form `toColumnDefs`) — no AG compatibility layer

### Docs pillars

| Doc | Role |
| --- | --- |
| **OVERVIEW.md** | Product map, AG-informed line, lista |
| KEYBOARD.md | Body keyboard matrix (K0) + checklist |
| ARCHITECTURE.md | Kernel / plugin rules |
| ROADMAP.md | Delivery checkboxes |
| README.md | Quick start |
| PLUGINS.md | Extension contract |

### Versioning

Breaking OK until first publish / `0.1`. After that: semver + migration notes.

---

## 9. Working agreement

1. When tempted by an AG option/event/API, add a row here first — status + better path.
2. Prefer extending plugins/capabilities over growing `DataGrid` / `DataGridApi`.
3. Range/fill follows §5; multi-range is not a stealth requirement.
4. Row write-back follows §5a (controller-owned rows) — not AG `api.applyTransaction`.
5. Edit start/stop follows §5b (presets + sparse overrides) — do not freeze the full bag early.
6. Keyboard / focus follows §5c (realms + matrix) — header nav is required for “enterprise”; don’t clone AG’s combo soup.
7. Selection coexistence follows §5d — row + range both allowed; range wins copy when present.
8. Build order follows §10 — don’t pull Wave 5 ahead of the interactive spine.
9. Update this file in the same PR as surface changes.
10. Wave 2+ PRs: prefer shrinking or flat `data-grid.ts`; put logic in controllers/modules.

---

## 10. Foundation waves (build order)

Principle: design locks before features that hard-code against them; keyboard/a11y
spine before spreadsheet layers. Spreadsheet *interactions* without Excel product identity.

| Wave | Focus | Ship |
| --- | --- | --- |
| **0** | Design locks | §5d selection, perf stub (§12), this section, §11 gaps |
| **1** | Interactive spine | K0 matrix docs, K1 ARIA, `applyRowTransaction` |
| **2** | Focus continuum | K2 header realm, K3 body↔header, K4 Tab citizen, column-menu stub |
| **3** | Policies | §5b editInteraction, §5a controller rows, selection depth |
| **4** | Spreadsheet layer | Lean column menu, cell range §5, fill via paste |
| **5** | Harden & ship | Validation, state, filters, SSRM v2, touch/RTL/SSR notes, publish |

Defer coding range / full menu / edit bag until Waves 0–2 are in place.

---

## 11. Gap checklist (`Review` until designed)

| Topic | Status | Notes |
| --- | --- | --- |
| Row selection depth | **Done (Wave 3)** | Checkbox / Space; optional `rowClickSelects`; `isRowSelectable` |
| Row ↔ cell coexistence | **Done (design)** | §5d |
| Accessibility (full SR) | **Review** | Beyond §5c K1; announcements / DOM order |
| Grid state completeness | **Review** | Compare AG save list vs `DataGridState` |
| Cell edit validation | **Review** | fullRow has Signal Forms; cell mode weak |
| Column menu design | **Review** | Stub in Wave 2; UI in Wave 4 |
| Performance contract | **Partial** | §12 stub |
| Touch / mobile | **Review** | |
| RTL | **Review** | Locale exists; layout mirroring unknown |
| Consumer testing guide | **Review** | |
| AG → al migration outline | **Review** | Publish wave |
| SSR / hydration | **Review** | |
| Print / density | **Review** | Theming vars only |
| Filter extensibility | **Later** | Wave 5 |
| Master/detail, pinned rows, undo | **Later** | Light mentions only |

**Never (unless revisited):** pivot, Excel export, charts, formulas, AI toolkit,
column virtualization, canvas, ModuleRegistry, viewport row model, AG theme packs,
multi-disjoint ranges.

---

## 12. Performance contract (stub)

| Rule | Meaning |
| --- | --- |
| Row virtualization | Default on; pagination XOR virtual |
| Column virtualization | **Never** (for now) |
| Data updates | Immutable `[data]` replace → full client pipeline (filter→sort→display) |
| Transactions | Host/controller replace arrays; no AG delta-sort / changed-path until measured pain |
| Budgets | TBD: document target row counts after first profile of demo (Wave 5) |
| Binder | Do not grow `data-grid.ts` for features — controllers / plugins |
