# Changelog

## Unreleased

### Added
- `alDialog` — Aria-style headless attribute directive on the consumer’s `<dialog>` (focus trap, restore focus, Escape, backdrop, scroll lock; no CSS import)
- `DialogService` now layers default chrome on that same primitive (`dialog[al-dialog-surface]` + host directive) so dismiss / focus / ARIA are not a second implementation
- Slimmer combo: scroll lock follows `modal`; `aria-label` / `role` stay native attributes; batteries open via `presentDialogSurface`
- Independent `closeOnEscape` / `closeOnBackdrop` ( `disableClose` remains a both-off shorthand )
- Optional `hasBackdrop` and `backdropClass`
- `role?: 'dialog' | 'alertdialog'` — `confirm()` / `alert()` default to `alertdialog`
- `fullscreenBelow?: 'sm' | 'md' | 'lg' | 'xl'` for mobile-fullscreen modals
- Popover flip (and shift/clamp fallback) near viewport edges; `flip: false` keeps clamp-only

## 0.1.0

### Added
- Toast corner `position` (`top-left` | `top-right` | `bottom-left` | `bottom-right`), stacking offsets, and `role="status"` / `aria-live="polite"`
- Toast styles in `styles/core.css`
- `DialogStrings` keys for confirm/alert defaults: `confirmTitle`, `alertTitle`, `ok`, `cancel`
- `ConfirmOptions.animation`, `ariaDescribedBy`, and per-call `strings`
- Dark-friendly token defaults via `prefers-color-scheme: dark`
- LICENSE and this changelog

### Fixed
- `sideEffects` now includes CSS so style imports are not dropped by bundlers
- DefaultDialog `min-width` no longer fights size presets (`sm` 320px, etc.)
- DefaultDialog header omitted when there is nothing to show
- Minimized window styles use theme tokens instead of hardcoded whites

### Docs
- Desktop-oriented note for `window()` drag / dock / tile features
- Toast position and string i18n examples
