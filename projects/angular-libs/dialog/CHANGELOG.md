# Changelog

## Unreleased

### Added
- Independent `closeOnEscape` / `closeOnBackdrop` ( `disableClose` remains a both-off shorthand )
- Optional `hasBackdrop` and `backdropClass`
- `role?: 'dialog' | 'alertdialog'` — `confirm()` / `alert()` default to `alertdialog`
- `fullscreenBelow?: 'sm' | 'md' | 'lg' | 'xl'` for mobile-fullscreen modals
- Popover flip (and shift/clamp fallback) near viewport edges; `flip: false` keeps clamp-only
- Design-system embed: `appearance: 'headless'`, `scheme`, and `tokens` on `provideDialog` / `open` / confirm / toast
- Token bridge helpers: `applyDialogTokens`, `dialogTokenStyle`, `dialogTokensAsCss`, `DIALOG_TOKEN_VARS`
- Stable hooks: `data-al-dialog-intent`, `data-al-dialog-chrome`, `data-al-dialog-appearance`, `data-al-dialog-scheme`, and `[data-al-dialog-part]` / `[data-al-dialog-action]`
- Global `contentClass` / `panelClass` now merge with per-call classes
- `@angular-libs/dialog/styles/bridge.css` mapping reference

### Changed
- Built-in `prefers-color-scheme: dark` tokens apply only when `data-al-dialog-scheme="auto"` (still the default for `appearance: 'default'`)
- DefaultDialog leftover hardcoded colors now go through tokens; headless chrome is structural only

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
