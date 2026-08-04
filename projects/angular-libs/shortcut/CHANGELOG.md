# Changelog

## 0.0.1

Initial release.

### Core
- `ALShortcutService`, `[alShortcut]` directive, `onShortcut()` hook
- `provideShortcut()` / `SHORTCUT_CONFIG` for bootstrap plugins
- Shared `normaliseShortcut()`, `formatShortcut()`, `getModKey()`, `resolveShortcutFromEvent()`
- `mod` → Meta on Apple, Ctrl elsewhere
- `ALShortcutHost` plugin surface (no circular types↔service coupling)
- `getPlugin(id)` / `unregisterPlugin(id)` (idempotent register by id)
- `getLayoutMap()`, `getConflicts()`
- Config: `when`, `stopPropagation`, `stopImmediatePropagation`, `id`, `group`
- Directive: `alShortcutType`, optional id/group/stopPropagation; empty default description
- Headless plugins: input suppressor, chord, twice, context guard, rebind

### Experimental UI (`@angular-libs/shortcut/plugins`)
- `commandPalettePlugin` — dialog ARIA, CSS variables (`--al-pal-*`)
- `visualHintsPlugin` — group ARIA, CSS variables (`--al-hint-*`)
- Imperative DOM overlays; class names are not a stable contract
