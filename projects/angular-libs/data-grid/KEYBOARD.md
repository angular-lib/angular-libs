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
| Printable / Backspace / Delete | Type-to-edit (`typeToEdit: 'replace'`; Space reserved for selection) |
| Space | Toggle row selection (group: expand/collapse) |
| Escape | Cancel edit / close context menu |
| Ctrl/Cmd+A | Select all visible rows when `selection: 'multi'` |

## Body — edit (cell editor open)

| Key | Action |
| --- | --- |
| Enter | Commit (`excel`: commit + move down) |
| Tab / Shift+Tab | `tabEditing: 'commitAndMove'` → commit + next/prev cell (wrap); `'browser'` → leave page (default) |
| Escape | Cancel edit |
| ← → (fullRow + `arrowEditing: 'moveHorizontal'`) | Move to adjacent cell editor |
| Home / End / ↑ ↓ while editing | Stay with the input |

## Header — Done (Wave 2+)

| Key | Action |
| --- | --- |
| ← → | Move across header cells |
| ↑ ↓ | Header rows / into body (↓ from leaf → body row 0) |
| PageDown | Jump into body row 0 (same column) |
| Enter | Toggle sort: asc → desc → none (Shift+Enter multi-sort) |
| Alt+↓ | Open lean column menu (pin / sort / autosize / hide) |
| Escape | Close menu |

## Body PageUp / PageDown continuum

| Key | From | Action |
| --- | --- | --- |
| PageDown | Header / floating filter | Body row 0, same column |
| PageUp | Body row 0 | Header (or floating filter if present) |
| PageUp / PageDown | Body (other rows) | Viewport-sized jump |

## Checklist (manual / CI)

- [x] Arrow keys move focus without mouse — `keyboard.spec.ts`
- [ ] Only one cell has `tabindex="0"` at a time
- [x] Home/End and PageUp/PageDown behave as above — `keyboard.spec.ts`
- [x] Enter/F2 start edit on editable columns — `keyboard.spec.ts` (controller callbacks)
- [ ] `syncDomFocus` puts focus on the editor when the cell is in an edit session
- [ ] fullRow + excel: ←→ move between cell editors; default: caret stays in field
- [x] Space toggles selection in multi mode — `keyboard.spec.ts`
- [x] Escape cancels edit — `keyboard.spec.ts`
- [x] Group Enter/Space expands/collapses — `keyboard.spec.ts` + existing specs
- [x] Tab from focused cell leaves the grid (page citizen) — `keyboard.spec.ts` (`handleKeydown` returns false)
- [x] Header continuum (ArrowUp/Down, PageUp/Down, Enter, Alt+↓) — `keyboard.spec.ts`
- [x] Shift+arrows extend range when `onExtendRange` returns true — `keyboard.spec.ts`
