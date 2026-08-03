# Changelog

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
