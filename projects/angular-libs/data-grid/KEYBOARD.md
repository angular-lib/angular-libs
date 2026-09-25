# @angular-libs/data-grid — keyboard matrix (K0)

Published body + header continuum keyboard contract (OVERVIEW §4.9 / §5c).
Executable coverage: `src/lib/controllers/keyboard.spec.ts`.

Edit start/stop policies: OVERVIEW §5b.

Roving `tabindex`: only the focused cell is `tabindex="0"`; others `-1`. Arrow
keys move focus inside the grid; **Tab is not captured** by `FocusController`
(page citizen — default browser Tab / Shift+Tab leave or enter the grid via
roving tabindex + `restoreOrFocusDefault`). Whenever the focused cell is not
rendered (virtualized away, loading, column hidden) the grid frame is the tab
stop (`tabindex="0"`); focusing it restores the last / default cell.

Focus follows **row identity** (`DisplayRow.id`): after sort / filter / paging /
column hide it is re-anchored to the same row (or clamped to the nearest valid
row / column). DOM focus follows only when it was on this grid's own cell.

**Scope:** grid keys run only when the event target is this grid's own
cell / header (or the frame). Toolbar, pager, sidebar, menus and nested detail
grids keep their native keys. Inside an editor (`isEditorEventTarget`, incl.
custom editor hosts) only Escape (and fullRow ←→ hand-off) reach the grid.
Escape acts only when focus is inside this grid, or to close this grid's menu.

Cell `aria-selected`: `true` when the row is selected **or** the cell is inside
the active cell range (`cellRangePlugin`); omitted otherwise.

## Body (data / group rows) — current

| Key | Action |
| --- | --- |
| ← ↑ → ↓ | Move focused cell (skip master-detail plugin/detail shells) |
| Enter on expand (open) | Enter nested detail grid (cell widget) — does **not** collapse |
| Escape (idle, in detail) | Exit nested grid → master expand cell |
| Home / End | First / last **column** on the current row |
| Ctrl/Cmd+Home / End | First / last **row** (same column) |
| PageUp / PageDown | Jump by viewport-sized page |
| Enter / F2 | Start cell/row edit (group row or master-detail expand column: Enter toggles expand) |
| Printable / Backspace / Delete | Type-to-edit (`typeToEdit: 'replace'`; caret after the seed; AltGr chars count; Space reserved for selection except boolean cells) |
| Space | Toggle row selection (group or expand column: expand/collapse; focused boolean cell: toggle value) |
| Shift+F2 | Notes editor (`notesPlugin`) — does **not** start cell/row edit |
| Escape | Cancel edit (does not clear range); second Escape clears range / close context menu |
| Ctrl/Cmd+A | Select all rows in the `selectAll` scope (default: filtered) when `selection: 'multi'` |

## Body — edit (cell editor open)

| Key | Action |
| --- | --- |
| Enter | Commit (`excel`: commit + move down); ignored during IME composition; invalid draft stays open (`aria-invalid`) |
| Tab / Shift+Tab | `tabEditing: 'commitAndMove'` → commit + next/prev cell (wrap); **fullRow** walks cells without committing the row; `'browser'` → leave page (default) |
| Escape | Cancel edit (range stays); second Escape clears range |
| ← → (fullRow + `arrowEditing: 'moveHorizontal'`) | Move to adjacent cell editor |
| Home / End / ↑ ↓ while editing | Stay with the input |

## Header — Done (Wave 2+)

| Key | Action |
| --- | --- |
| ← → | Move across header cells |
| ↑ ↓ | Header rows (group ↔ leaf when column groups exist) / into body (↓ from leaf → body row 0) |
| PageDown | Jump into body row 0 (same column) |
| Enter | Toggle sort on **leaf** headers: asc → desc → none (Shift+Enter multi-sort) |
| Alt+↓ | Open lean column menu (pin / sort / autosize / hide) — leaf headers |
| Escape | Close menu |

## Column / context menu

| Key | Action |
| --- | --- |
| ↑ ↓ / Home / End | Move between items (first item focused on open; custom templates: the menu) |
| Enter / Space | Activate the item (never reaches the grid) |
| Escape / Tab | Close; focus returns to the invoking header / cell |

## Floating filters

| Key | Action |
| --- | --- |
| ← → | Move across filter cells |
| Enter | Focus the inner filter control |
| Escape | From the control → filter cell; from the cell → leaf header |

## Body PageUp / PageDown continuum

| Key | From | Action |
| --- | --- | --- |
| PageDown | Header / floating filter | Body row 0, same column |
| PageUp | Body row 0 | Header (or floating filter if present) |
| PageUp / PageDown | Body (other rows) | Viewport-sized jump |

## Checklist (manual / CI)

- [x] Arrow keys move focus without mouse — `keyboard.spec.ts`
- [x] Only one cell has `tabindex="0"` at a time — `data-grid.spec.ts`
- [x] Home/End and PageUp/PageDown behave as above — `keyboard.spec.ts`
- [x] Enter/F2 start edit on editable columns — `keyboard.spec.ts` (controller callbacks)
- [x] `syncDomFocus` puts focus on the editor when the cell is in an edit session — `data-grid.spec.ts`
- [x] fullRow + excel: ←→ move between cell editors; default: caret stays in field — `data-grid.spec.ts`
- [x] Space toggles selection in multi mode — `keyboard.spec.ts`
- [x] Escape cancels edit without clearing the cell range — `data-grid.spec.ts`
- [x] Group Enter/Space expands/collapses — `keyboard.spec.ts` + existing specs
- [x] Group rows use roving tabindex + `aria-rowindex` — `data-grid.spec.ts`
- [x] Space on a focused boolean cell toggles the value — `data-grid.spec.ts`
- [x] Tab from focused cell leaves the grid (page citizen) — `keyboard.spec.ts` (`handleKeydown` returns false)
- [x] Header continuum (ArrowUp/Down, PageUp/Down, Enter, Alt+↓) — `keyboard.spec.ts`
- [x] Column-group header ↑↓ (leaf rowIndex 1) — `keyboard.spec.ts`
- [x] Floating filter Enter focuses control — `keyboard.spec.ts` (`onFloatingFilterEnter`)
- [x] Shift+F2 does not start edit — `keyboard.spec.ts` (notes chord)
- [x] Shift+arrows extend range when `onExtendRange` returns true — `keyboard.spec.ts`
- [x] Nested master-detail is a separate keyboard/SR realm (Enter / Escape) — `data-grid.spec.ts`

## Nested detail (cell widget)

Angular Aria **Grid** mental model, implemented in this grid (no `@angular/aria`):

| Surface | Contract |
| --- | --- |
| Parent arrows / range / Home–End | Skip the detail **shell** (`kind: 'plugin'`) |
| Enter on expand column | Collapsed → expand. Already open → **enter** nested grid |
| Space on expand column | Toggle expand/collapse |
| Idle Escape in nested grid | Return focus to the master expand cell |
| Tab | Page citizen — nested frame is its own tab stop |
| Find | **Never (1.0):** master processed rows only |

Master row `aria-details` points at the detail region (`id="al-dg-detail-{rowId}"`).
The nested `<al-data-grid>` is its own `role="grid"` with `detailGridAriaLabel`.
