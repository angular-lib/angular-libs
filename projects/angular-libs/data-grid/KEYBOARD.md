# @angular-libs/data-grid — keyboard matrix (K0)

Published body keyboard contract. Header / floating-filter realms: OVERVIEW §5c
(Wave 2+). Edit start/stop policies: OVERVIEW §5b.

Roving `tabindex`: only the focused cell is `tabindex="0"`; others `-1`. Arrow
keys move focus inside the grid; Tab leaves to the next page control.

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

## Header — Wave 2+

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

- [ ] Arrow keys move focus without mouse
- [ ] Only one cell has `tabindex="0"` at a time
- [ ] Home/End and PageUp/PageDown behave as above
- [ ] Enter/F2 / type-to-edit / double-click start edit on editable columns
- [ ] `syncDomFocus` puts focus on the editor when the cell is in an edit session
- [ ] fullRow + excel: ←→ move between cell editors; default: caret stays in field
- [ ] Space toggles selection in multi mode
- [ ] Escape cancels edit
- [ ] Group Enter expands/collapses
- [ ] Tab from focused cell leaves the grid (page citizen)
