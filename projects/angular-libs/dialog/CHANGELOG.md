# Changelog

## Unreleased — 0.2.0 (rewrite)

Smaller, platform-first rewrite: about half the code of 0.1, one way to do each thing.

### Breaking
- `dialog.open(component, inputs?, options?)` — inputs are a separate argument; `ref.closed` resolves `{ ok: true, value, source } | { ok: false, source }` and never rejects
- Result type inferred from a public `injectDialog<R>()` / `DialogRef<R>` property (the `dialogRef` name and `DialogResultBrand` are gone)
- Options trimmed to `size`, `mobile` (`sheet` / `fullscreen` below 640px), `panelClass`, `closeOnEscape`, `closeOnBackdrop`, `closeOnNavigation`, `ariaLabel`, `role`, `injector`; removed `disableClose`, `hasBackdrop`, `backdropClass`, `fullscreenBelow`, `width`/`height`/min/max, `autoFocus`, `restoreFocus`, `animation`, `parent`, `id`, `plugins`
- Focus containment and initial focus are native (`showModal()`, `[autofocus]`); the JS focus trap is gone
- Removed: `DefaultDialogComponent` (use the parts), `dialog.toast()` / `autoClosePlugin` (use `Toaster`), the plugin system and `definePlugin`, standalone actions, `updateConfig` and the public `config` signal
- `dialog.window()` moved to `WindowService` in `@angular-libs/dialog/window`; `WindowRef` has `mode` / `bounds` signals; the drag / dock / snap / persistence plugins are built in and configured by options
- `dialog.popover()` moved to `PopoverService.open(anchor, component, inputs?, options?)` on the Popover API + CSS anchor positioning; placements are `top` / `bottom` (`-start` / `-end`), `left`, `right`; the arrow option is gone
- `provideDialog({ strings, defaults, toaster })`; theme tokens live on `:root`
- Testing: `provideDialogTesting()` + `DialogTestingController.stub(component, outcome)` / `calls`

### Added
- `injectDialog()` — `guard()` (dismissals only), `action()` with `pending` / `error` and a busy dialog, stacked `confirm()`
- `DialogParts` — `<al-dialog-header>` / `<al-dialog-body>` / `<al-dialog-footer>`, `[alDialogTitle]`, `[alDialogDescription]`, `[alDialogClose]`; also on headless `alDialog`
- `confirm({ onConfirm, tone: 'danger', errorText })` — spinner, dismiss blocked, inline error with retry
- `Toaster` — per-corner top-layer regions, queue, actions, `promise()`, pause on hover / focus, Escape, live-region announcements; mounted inside the topmost modal so toasts stay clickable
- CSS enter / exit transitions (`@starting-style`, `allow-discrete`); elements are removed once they finish
- `DialogService.openDialogs` signal

### Fixed
- Repeated Escape could force-close dialogs with `closeOnEscape: false` / guards (Chrome close watcher); Escape is now handled on `document` for the topmost modal
- Scroll lock no longer shifts the page by the scrollbar width
- Title id and `aria-labelledby` could disagree when parts rendered after open
- Opening a window `id` while its previous window was still closing returned the closing one

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
