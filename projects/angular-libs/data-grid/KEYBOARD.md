# @angular-libs/data-grid — keyboard matrix (K0)

Published body + header continuum keyboard contract (OVERVIEW §4.9 / §5c).
Executable coverage: `src/lib/controllers/keyboard.spec.ts`.

Edit start/stop policies: OVERVIEW §5b.

Roving `tabindex`: only the focused cell is `tabindex="0"`; others `-1`. Arrow
keys move focus inside the grid; **Tab is not captured** by `FocusController`
(page citizen — default browser Tab / Shift+Tab leave or enter the grid via
roving tabindex + `restoreOrFocusDefault`).

Cell `aria-selected`: `true` when the row is selected **or** the cell is inside
the active cell range (`cellRangePlugin`); omitted otherwise.

## Body (data / group rows) — current

| Key | Action |
| --- | --- |
| ← ↑ → ↓ | Move focused cell |
| Home / End | First / last **column** on the current row |
| Ctrl/Cmd+Home / End | First / last **row** (same column) |
| PageUp / PageDown | Jump by viewport-sized page |
| Enter / F2 | Start cell/row edit (group row: Enter toggles expand) |
| Printable / Backspace / Delete | Type-to-edit (`typeToEdit: 'replace'`; Space reserved for selection except boolean cells) |
| Space | Toggle row selection (group: expand/collapse; focused boolean cell: toggle value) |
| Shift+F2 | Notes editor (`notesPlugin`) — does **not** start cell/row edit |
| Escape | Cancel edit (does not clear range); second Escape clears range / close context menu |
| Ctrl/Cmd+A | Select all visible rows when `selection: 'multi'` |

## Body — edit (cell editor open)

| Key | Action |
| --- | --- |
| Enter | Commit (`excel`: commit + move down) |
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
