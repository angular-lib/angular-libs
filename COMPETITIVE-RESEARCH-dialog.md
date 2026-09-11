# Competitive research: `@angular-libs/dialog`

**Scope:** this package only. No library source was changed.  
**Package version traced:** `0.1.0` (`projects/angular-libs/dialog/package.json`).  
**Date:** 2026-09-11.  
**Peer contract:** `@angular/common` and `@angular/core` `>=19` only — no CDK, Overlay, or Material peer.

## Method

Claims about **our** capabilities come from source, not the README alone:

| Area | Files |
|------|--------|
| Public API | `projects/angular-libs/dialog/src/public-api.ts` |
| Types / config | `src/lib/dialog.types.ts`, `provide-dialog.ts`, `define-plugin.ts` |
| Runtime | `src/lib/dialog.service.ts`, `dialog-ref.ts`, `behavior-resolver.ts` |
| Chrome | `src/lib/components/default-dialog.component.ts` |
| Plugins | `src/lib/plugins/*.plugin.ts` |
| Window actions | `src/lib/actions/*` |
| Styles | `src/styles/core.css`, `src/styles/window.css` |
| Testing entry | `testing/src/public-api.ts`, `testing/src/lib/dialog-testing.ts` |
| Documented contract | `README.md`, `CHANGELOG.md` |

A feature is listed as a **gap** only when it is absent from those files (or present only as a weaker substitute that does not meet the competitor’s contract). Different-but-equivalent approaches go in **§C Parity**, not **§B Gaps**.

Competitor capabilities come from current public docs and source (URLs in each section).

---

## Our snapshot (what we actually ship)

Intent service on the **native HTML `<dialog>`** element:

| Intent | Method | Modal | Notes from source |
|--------|--------|-------|-------------------|
| Modal | `DialogService.open(Type, DialogOptions)` | `showModal()` unless `modal: false` | Component only. Typed `inputs` via `ComponentInputs<T>` (signal `input()` / `model()`). |
| Floating window | `window(Type, WindowOptions)` | `show()` | Defaults `drag` + `snap` + `dock` from `provideDialog({ window })`. Desktop / pointer oriented. |
| Confirm / alert | `confirm()` / `alert()` → `Promise` | modal | `DefaultDialogComponent` + **plain text** `contentText` (not HTML). |
| Popover | `popover(Type, PopoverDialogOptions)` | modeless | Anchor + 9 placements + arrow. Viewport **clamp**, not flip. |
| Toast | `toast(message, ToastOptions)` | modeless | Corner stack, `role="status"` / `aria-live="polite"`, `autoClosePlugin`. |

**Also present:** plugin lifecycle (`setup` / `onOpen` / `beforeClose` / `onClose` / `onLayoutChange`); `DialogRef.state` signal; `closed` **Promise** `{ result, source }`; `beforeClose` on ref + plugins; parent → child cascade close; `closeOnNavigation` via `Location.onUrlChange`; autofocus (`first-tabbable` \| `dialog` \| `false` \| `HTMLElement` \| CSS selector); restore-focus **boolean**; ARIA label/labelledby/describedby + `aria-modal`; size presets `sm`–`xl`/`full`; CSS token theme + `prefers-color-scheme: dark`; i18n `DialogStrings` as object / `Signal` / factory; window actions (`minimize` / `maximize` / `restore` / `snap` / `moveTo` / `resizeTo` / native Fullscreen API); layout persistence; `@angular-libs/dialog/testing`.

**Explicit non-goals / limits in source:** `open()` / `window()` use `document` and are **not SSR-safe** (`dialog.service.ts`, README). `window()` drag / dock / tile snap are **desktop / pointer** features.

---

## A) Competitor inventory

Eleven libraries / pattern families. “What they can do that matters” is limited to capabilities that affect production Angular apps in 2026 (a11y, DX, types, SSR, mobile, testing) — not every prop.

### 1. `@angular/cdk/dialog`

- **URLs:** [Dialog service source](https://github.com/angular/components/blob/main/src/cdk/dialog/dialog.ts), [DialogConfig](https://github.com/angular/components/blob/main/src/cdk/dialog/dialog-config.ts), [DialogRef](https://github.com/angular/components/blob/main/src/cdk/dialog/dialog-ref.ts)
- **What it is:** Official headless overlay dialog. Powers Material. CDK Overlay + Portal + FocusTrap + scroll/position strategies.
- **What matters:**
  - `open(ComponentType | TemplateRef, DialogConfig)`
  - `DIALOG_DATA`, `viewContainerRef`, `injector`, `providers`, Angular `bindings`
  - `hasBackdrop` / `backdropClass`, `role: 'dialog' | 'alertdialog'`, `direction`, `scrollStrategy`, `positionStrategy`
  - Autofocus includes `first-heading`; `restoreFocus` is `boolean | string | HTMLElement`
  - `closePredicate(result, config, componentInstance)`
  - Unique generated `id`; **throws** on duplicate; `getDialogById`, `closeAll`, `afterOpened`, `afterAllClosed`
  - `DialogRef.closed` Observable; `backdropClick` / `keydownEvents` / `outsidePointerEvents`
  - `updatePosition()` / `updateSize()` / `addPanelClass()` / `removePanelClass()`
  - Hides non-overlay siblings with `aria-hidden` (overlay model, not top-layer `<dialog>`)
  - SSR-capable (no `document.createElement('dialog')` in the service itself)
- **Not:** confirm/toast/popover intents, OS-style windows, plugin bus, native `<dialog>`.

### 2. Angular Material `MatDialog`

- **URLs:** [Overview](https://material.angular.dev/components/dialog/overview), [MatDialogConfig](https://github.com/angular/components/blob/main/src/material/dialog/dialog-config.ts), [MatDialogHarness](https://next.material.angular.dev/docs-content/api-docs/material-dialog-testing)
- **What it is:** Material Design chrome on CDK Dialog.
- **What matters (beyond CDK):**
  - `mat-dialog-title` / `mat-dialog-content` / `mat-dialog-actions` structural directives
  - `position: { top, bottom, left, right }`, enter/exit animation **durations**
  - `MAT_DIALOG_DEFAULT_OPTIONS`, `MAT_DIALOG_DATA`, `MatDialogRef.afterClosed()` / `afterOpened()` / `backdropClick()`
  - Focus trap with `delayFocusTrap`; documented `role="alertdialog"`
  - **`MatDialogHarness`** via `@angular/material/dialog/testing` + `TestbedHarnessEnvironment.documentRootLoader`
- **Not:** floating windows, dock/tile, toast/popover intents, zero-dependency packaging.

### 3. PrimeNG Dialog family (`p-dialog`, DynamicDialog, ConfirmDialog)

- **URLs:** [Dialog](https://primeng.org/dialog), [DynamicDialog](https://primeng.org/dynamicdialog), [ConfirmDialog](https://primeng.org/confirmdialog), [Dialog source](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/dialog/dialog.ts), [DynamicDialogConfig](https://github.com/primefaces/primeng/blob/master/packages/primeng/src/dynamicdialog/dynamicdialog-config.ts)
- **What it is:** Full UI kit. Template-driven `p-dialog` **and** service-driven `DialogService.open()`.
- **What matters:**
  - Declarative `[(visible)]` dialogs in templates (not only service-open)
  - Independent `modal`, `dismissableMask`, `closeOnEscape`, `blockScroll`, `focusTrap`
  - `position` (center + edges + corners), `breakpoints` (width per viewport), `appendTo`
  - `draggable` (header), `resizable`, `keepInViewport` (default **true**), `maximizable`
  - `rtl`, header/footer/close **templates**, PassThrough (`pt`), Motion options
  - DynamicDialog: `data` **and** typed `inputValues`, header/footer/icon **component** templates
  - ConfirmDialog: `ConfirmationService.confirm({ message, header, icon, accept, reject, position })`, `alertdialog` role, trigger `aria-expanded` / `aria-controls`
  - Built-in locale API for close / maximize labels
- **Cost:** PrimeNG + theme + OverlayService. Not a 2-peer dialog atom.

### 4. ngx-bootstrap Modal

- **URLs:** [Docs](https://valor-software.com/ngx-bootstrap/components/modals?tab=overview), [ModalOptions](https://github.com/valor-software/ngx-bootstrap/blob/development/src/modal/modal-options.class.ts)
- **What it is:** Bootstrap 5 modal via `BsModalService.show(TemplateRef | Component, ModalOptions)`.
- **What matters:**
  - Template **or** component; `initialState` mapped onto the instance
  - `backdrop: boolean | 'static'` (static = visible mask, click does not close)
  - Independent `keyboard`, `ignoreBackdropClick`, `animated`, `class`, `providers`
  - `closeInterceptor`; dismiss reasons (`backdrop-click`, `esc`, browser back)
  - `ariaLabelledBy` / `ariaDescribedby`
- **Not:** windows, popover collision, typed signal inputs, native `<dialog>`.

### 5. ng-bootstrap Modal (`NgbModal`)

- **URLs:** [API](https://ng-bootstrap.github.io/#/components/modal/api), [NgbModalOptions](https://github.com/ng-bootstrap/ng-bootstrap/blob/master/src/modal/modal-config.ts), [NgbModal](https://github.com/ng-bootstrap/ng-bootstrap/blob/master/src/modal/modal.ts)
- **What it is:** Bootstrap 5 modals without jQuery. `NgbModal.open(TemplateRef | Component, NgbModalOptions)`.
- **What matters:**
  - `backdrop: true | false | 'static'`; independent `keyboard`
  - `beforeDismiss(): boolean | Promise`
  - `centered`, **`scrollable`**, `container` (selector or `HTMLElement`)
  - **`fullscreen: boolean | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'`** (fullscreen below a breakpoint)
  - `role: 'dialog' | 'alertdialog'`
  - `NgbActiveModal` + `NgbModalRef.result` Promise; `closed` / `dismissed` / `shown` / `hidden`
  - `update()` on an **already open** modal (`size`, `centered`, `fullscreen`, classes, ARIA)
  - `dismissAll`, `hasOpenModals()`, `activeInstances`
  - `NgbModalConfig` global defaults
- **Not:** modeless windows, plugins, toast/popover.

### 6. `@ngneat/dialog` *(added — closest independent Angular peer)*

- **URLs:** [npm / README](https://www.npmjs.com/package/@ngneat/dialog), [GitHub](https://github.com/ngneat/dialog)
- **What it is:** CDK-free modal (`@angular/core >=17`). Component **or** `TemplateRef`.
- **What matters:**
  - Typed `DialogRef<Data, Result>` inferred from a public `ref` field (same idea as our `InferDialogResult`)
  - `afterClosed$`, `backdropClick$`, `beforeClose` (boolean **| Observable | Promise**)
  - `enableClose` split (`escape` / `backdrop`) including `'onlyLastStrategy'` for stacks
  - `draggable` + `draggableConstraint: none | bounce | constrain`; `resizable`; custom `sizes`
  - `dialogClose` directive; `updateConfig` on the ref (constructor-time)
  - `container` append target; `vcr`; `data` bag
  - `provideDialogConfig` global defaults
- **Not:** native `<dialog>`, confirm/toast/popover intents, dock/tile/persist, plugin lifecycle.

### 7. NG-ZORRO `NzModalService` *(added — enterprise confirm/status family)*

- **URLs:** [Modal docs](https://ng.ant.design/components/modal/en), [ModalOptions](https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/components/modal/modal-types.ts)
- **What it is:** Ant Design modals on CDK Overlay.
- **What matters:**
  - `create` / `confirm` / `info` / `success` / `error` / `warning`
  - Content as **string | TemplateRef | Component**; `nzData` + `NZ_MODAL_DATA`
  - `nzOnOk` / `nzOnCancel` returning `false` or a Promise (async OK + loading)
  - Configurable footer as `ModalButtonOptions[]` (label, loading, danger, `onClick(instance)`)
  - `nzMask` / `nzMaskClosable` / `nzKeyboard` / `nzCentered` / `nzDraggable` / `nzDirection`
  - `afterOpen` / `afterClose` Observables; `updateConfig`; `closeAll`
- **Not:** native dialog, window tiling, toast-as-dialog.

### 8. ng-primitives Dialog *(added — Angular Headless UI / Radix-style)*

- **URLs:** [Docs](https://angularprimitives.com/primitives/dialog), [Repo](https://github.com/ng-primitives/ng-primitives)
- **What it is:** Headless, composable directives (`NgpDialog`, `NgpDialogTrigger`, `NgpDialogOverlay`, title/description). Peers: Angular 21/22 **and** `@angular/cdk` + `@floating-ui/dom`.
- **What matters:**
  - Template-first composition (Headless UI / Ark / Radix pattern)
  - `NgpDialogManager.open(component | template)` for programmatic open
  - Dismiss guards on Escape **and** outside click (boolean or `Promise`)
  - `closed` vs `afterClosed` (before / after exit animation)
  - Drawer documented as a styled dialog (slide-in), not a separate primitive
  - Schematic: `ng g ng-primitives:primitive dialog`
- **Not:** window manager, confirm/toast helpers, zero-CDK packaging.

### 9. Headless UI Dialog *(pattern — no official Angular package)*

- **URL:** [Headless UI React Dialog](https://headlessui.com/react/dialog)
- **What matters as a pattern:**
  - Compound parts: `Dialog`, `Dialog.Panel`, `Dialog.Title`, `Dialog.Description`, `Dialog.Backdrop`
  - Controlled `open` / `onClose`; focus return; scroll lock; `role="dialog" | "alertdialog"`
  - Unstyled; accessibility is the product
- **Angular reality:** no first-party package. Closest ports: ng-primitives, CDK Dialog, our service (behavior) + `DefaultDialogComponent` (chrome).

### 10. Ark UI Dialog *(pattern — Angular support not GA)*

- **URLs:** [Ark Dialog](https://ark-ui.com/docs/components/dialog), [Angular support PR](https://github.com/chakra-ui/ark/pull/3888)
- **What matters as a pattern:**
  - State-machine dialog: `open` / `onOpenChange`, `closeOnEscape`, `closeOnInteractOutside`, `modal`, `role`, `lazyMount`, `unmountOnExit`
  - Parts: Trigger, Backdrop, Positioner, Content, Title, Description, CloseTrigger
- **Angular reality:** public site still lists React / Solid / Vue / Svelte. An Angular package exists as a PR, not a production default.

### 11. Floating UI *(positioning standard used by Angular popovers)*

- **URLs:** [Dialog recipe](https://floating-ui.com/docs/dialog), [Middleware](https://floating-ui.com/docs/middleware)
- **What matters:**
  - `flip`, `shift`, `offset`, `arrow`, `size`, `hide`, `autoUpdate` (scroll/resize/layout)
  - Virtual elements as anchors; `FloatingFocusManager`; `FloatingOverlay` + `lockScroll`
  - `useDismiss` (Esc + outside press, including `outsidePressEvent: 'mousedown'`)
  - `useRole` for `dialog` / `alertdialog`
- **Angular reality:** consumed by ng-primitives (`@floating-ui/dom`). CDK Overlay `ConnectedPositionStrategy` is the official analogue. **Our `popoverPlugin` does not use Floating UI.**

---

## B) Gap table

Features competitors have that **we lack**, after tracing our source.  
**Essentiality 100** = must-have for most production Angular apps in 2026.

| Missing feature | Who has it | Essentiality 1–100 | Why |
|-----------------|------------|-------------------:|-----|
| `TemplateRef` (and string HTML) as `open()` content | CDK, MatDialog, ng-bootstrap, ngx-bootstrap, @ngneat/dialog, NG-ZORRO, ng-primitives | **92** | Most apps open a one-off template without a dedicated component. Our `open()` / `window()` / `popover()` accept only `Type<T>` (`dialog.service.ts`). Confirm/alert body is `{{ contentText }}` — not HTML (`default-dialog.component.ts`). |
| Independent Escape vs backdrop dismiss, including **static backdrop** | ng-bootstrap (`backdrop: 'static'` + `keyboard`), ngx-bootstrap (same), PrimeNG (`closeOnEscape` ≠ `dismissableMask`), @ngneat (`enableClose.escape` / `.backdrop`), NG-ZORRO (`nzKeyboard` / `nzMaskClosable`) | **90** | Wizards and dirty forms need “mask visible, click does nothing, Esc optional”. Our `disableClose` gates **both** backdrop click and `cancel`/`escape` (`dialog.service.ts`). No `hasBackdrop` / `backdropClass` option — only token `--al-dialog-backdrop` on `::backdrop`. |
| Configurable `role="dialog" \| "alertdialog"` | CDK, MatDialog, ng-bootstrap, PrimeNG ConfirmDialog (`alertdialog`), Headless UI, Ark | **88** | WAI-ARIA APG: confirms/alerts that interrupt should be `alertdialog`. We set `aria-modal` and toast `role="status"`; we never set `role` on modal/confirm (`applyAria` in `dialog.service.ts`). Native `<dialog>` is implicitly `dialog`, which is wrong for `confirm()` / `alert()`. |
| Collision-aware anchored positioning (flip / shift / autoUpdate / virtual element) | Floating UI, ng-primitives (`@floating-ui/dom`), CDK Overlay connected strategy | **86** | Production popovers must flip when the trigger is near the viewport edge. `popover.plugin.ts` picks one placement, then **clamps** `left`/`top` to 4px insets. No flip, no `shift` along the axis, no virtual `getBoundingClientRect` anchor, no `autoUpdate` beyond window `resize` + capture `scroll`. |
| Responsive / mobile presentation (breakpoint widths, fullscreen-below-`md`) | PrimeNG `breakpoints`, ng-bootstrap `fullscreen: 'sm'\|'md'\|…`, Bootstrap modal CSS | **86** | 2026 Angular apps are mobile-first. We have size presets and `maximize()` / Fullscreen API, but no “this modal is fullscreen under 768px”. README tells people **not** to use `window()` on small viewports — and offers no mobile substitute beyond `open()`. |
| SSR / hydration-safe open | CDK Overlay, MatDialog, ng-bootstrap, NG-ZORRO, ng-primitives (CDK) | **82** | Angular 19–22 SSR + incremental hydration is mainstream. `openInternal` always `document.createElement('dialog')` and appends to `body`. README and JSDoc already say browser-only. Without a platform guard or deferred client open, SSR apps cannot use the service in constructors / route resolvers. |
| Focus-trap + restore-focus richness (and heading autofocus) | CDK/Material (`first-heading`, `restoreFocus: boolean\|selector\|HTMLElement`, recapture on blocked backdrop), PrimeNG `focusTrap`, Floating UI `FloatingFocusManager` | **80** | `showModal()` traps focus for **modals** (browser). Modeless `window()` / `popover()` / `toast()` call `show()` — **no trap**. `restoreFocus` is boolean only (`dialog-ref.ts` `_restoreFocus`). Autofocus has no `first-heading` (CDK name). Selector/HTMLElement autofocus exists; restore-to-selector does not. |
| Scrollable body + viewport-centered / corner **modal** positions | ng-bootstrap `scrollable` + `centered`; PrimeNG `position` + long-content scroll; Material `position` | **78** | Long forms must scroll **inside** the panel while header/footer stay put. `DefaultDialog` content can overflow via CSS, but there is no `scrollable` contract. Modal placement is CSS `inset:0; margin:auto` only — no top-sheet / bottom-sheet / corner modal. |
| Confirm / status family with rich content and async OK | NG-ZORRO `confirm/info/success/error/warning` + `nzOnOk` Promise; PrimeNG ConfirmDialog (icon, accept/reject, templates, position); Material apps via custom components | **78** | Production deletes need icons, HTML/component bodies, and “OK stays loading until the HTTP call finishes”. `confirm()` is title + plain `message` + two buttons. No `onConfirm` Promise hook, no variants, no icon slot. `contentComponent` exists on `DefaultDialogComponent` but `confirm()` never sets it. |
| Unique `id` + `getDialogById` + open-dialog streams | CDK (`getDialogById`, throws on duplicate, `afterOpened`, `afterAllClosed`), MatDialog, ng-bootstrap (`activeInstances`, `hasOpenModals`) | **74** | Duplicate `id` silently shares persist keys (`layout-persistence.plugin.ts`). `openDialogs` is a **mutable public array**, not a signal / readonly view. No `getById`, no `afterOpened`, no `afterAllClosed`. |
| Append target / logical tree (`container`, `viewContainerRef`, `providers`, `bindings`) | CDK, MatDialog, ng-bootstrap `container`, @ngneat `container`+`vcr`, ngx-bootstrap `providers`, PrimeNG `appendTo` | **72** | Dialogs must inherit the opener’s injector (feature stores, `inputBinding`) and sometimes mount into a local overlay host (shadow DOM, microfrontends). We only provide `DialogRef` on a child injector (`dialog.service.ts`). Optional `options.injector` exists; no `ViewContainerRef`, no `providers[]`, no Angular `Binding[]`. Mount is `document.body` or the current fullscreen element. |
| `dir` / RTL | PrimeNG `rtl`, CDK/Material `direction`, NG-ZORRO `nzDirection` | **70** | Bidirectional apps are common. No `direction` on `DialogOptions`. Theme tokens do not flip chrome. |
| Component test harness (query title/content, close via Esc) | `MatDialogHarness` + CDK `TestbedHarnessEnvironment.documentRootLoader` | **68** | `@angular-libs/dialog/testing` patches `HTMLDialogElement` and optionally wraps `open`/`window`/`popover`/`toast`. There is no harness, no `documentRootLoader` story, and wrap is a **second manual call** (`wrapDialogServiceForTesting`) that is easy to forget. `confirm()` is tracked only if wrap replaced `open` first. |
| Headless compound directives (Trigger / Overlay / Title / Description) | Headless UI, Ark, ng-primitives | **64** | Design-system teams want markup they own. We are service-first; `DefaultDialogComponent` is optional chrome, not composable parts. |
| Drawer / side sheet | ng-primitives (drawer example), PrimeNG Sidebar/Drawer (kit), Ark `drawer` | **62** | Mobile filter/settings UIs. Not in this package (and out of scope to fake with `window()`). |
| Toast as a real notification API (severity, actions, progress, 6+ positions) | PrimeNG Toast, dedicated toast libs; our toast is DefaultDialog + timer | **58** | We cover the “saved” happy path (4 corners, stack, live region). No `success/warn/error`, no action button, no progress, no center/top-center. Acceptable if toast stays a convenience; not if we market it as a notification system. |
| `update()` on an already-open overlay (size, classes, ARIA) | ng-bootstrap `NgbModalRef.update`, CDK `updateSize`/`addPanelClass`, @ngneat `ref.updateConfig`, NG-ZORRO `updateConfig` | **56** | We have `resizeTo` / `moveTo` for windows. No `addPanelClass`, no live ARIA update, no `DialogRef.updateConfig`. |
| `beforeClose` as Observable (RxJS guard) | @ngneat `beforeClose` Observable; CDK `closePredicate` (sync); ngx-bootstrap `closeInterceptor` | **52** | We already accept `boolean \| Promise` on `DialogRef.beforeClose` and plugin `beforeClose` (`dialog-ref.ts`). Observable is ecosystem convenience, not a new capability. |
| `prompt()` (collect a string) | Often app-built; some kits ship it | **40** | Nice helper. Not required when `open()` + a small component exists. |
| Drag-to-edge snap while dragging (Aero / Win+arrow during pointer move) | OS window managers; PrimeNG keeps-in-viewport while drag | **38** | We snap via **Alt+Arrow** and **Alt+S** tile overlay — not by dragging into a hot edge. Power-user desktop feature, not a 2026 web default. |

**Not listed as gaps (we have an equivalent — see §C):** typed component inputs vs `DIALOG_DATA`; Promise `closed` vs `afterClosed` Observable; native top-layer modal vs Overlay + `aria-hidden`; CSS `resize` vs JS resize handles; plugin `definePlugin` vs kit-specific hooks; signal `DialogStrings` vs PrimeNG locale (different scope).

---

## C) Parity table

Solution quality (DX, types, signal-fit, correctness, packaging) — **not** popularity.  
100 = best-in-class for an Angular 19–22 app.

| Feature | Our approach (file/API) | Competitor approach | Our score 1–100 | Competitor score 1–100 | Notes |
|---------|-------------------------|---------------------|----------------:|-----------------------:|-------|
| Open a component dialog | `DialogService.open(Type, { inputs })` — `createComponent` + `setInput` (`dialog.service.ts`) | CDK/Material `open(Type, { data, bindings })`; PrimeNG DynamicDialog `inputValues` + `data`; @ngneat `data` + inferred `DialogRef` | **88** | CDK **86** / PrimeNG **84** / ngneat **85** | Our `ComponentInputs<T>` is the most signal-native (only `input()`/`model()` keys). We lack `TemplateRef` and `Binding[]`. |
| Result typing | `InferDialogResult` from public `dialogRef: DialogRef<R>` or `DialogResultBrand` (`dialog.types.ts`) | @ngneat public `DialogRef<In, Out>`; CDK/Material generic `open<T, R>`; ng-bootstrap untyped `result` Promise | **90** | ngneat **90** / CDK **80** | Brand field avoids forcing a public `dialogRef`. Strong, documented. |
| Close notification | `ref.closed` Promise of `{ result, source }` (`CloseSource` union + custom strings) (`dialog-ref.ts`) | CDK `closed` Observable of result only; Material `afterClosed()`; ng-bootstrap `result` + dismiss reason; @ngneat `afterClosed$` | **84** | Material **86** / ng-bootstrap **88** | **Source** (`backdrop`/`escape`/`navigation`/`primary`/…) is better than result-only. Promise is signal-friendly; RxJS interop is a one-liner (`from(ref.closed)`). Missing `afterOpened`. |
| Close guards | `ref.beforeClose` + plugin `beforeClose` → `boolean \| Promise` (`dialog-ref.ts`) | CDK `closePredicate`; ng-bootstrap `beforeDismiss`; @ngneat Observable guard; ngx-bootstrap `closeInterceptor`; ng-primitives per-trigger guards | **80** | ngneat **86** / ng-bootstrap **84** / CDK **82** | Correct and tested (`dialog-ref.spec.ts`). No Observable; no `(result, config, instance)` signature. |
| Dismiss controls | Single `disableClose` for Esc **and** backdrop (`dialog.service.ts`) | Split keyboard / mask / static backdrop (ng-bootstrap, ngx-bootstrap, PrimeNG, ngneat) | **55** | ng-bootstrap **92** / PrimeNG **90** | Biggest modal-DX miss. See gap table. |
| Backdrop | Native `::backdrop` + `--al-dialog-backdrop` (`core.css`). Always on for `showModal()`. | CDK `hasBackdrop` + `backdropClass`; Bootstrap `backdropClass`; PrimeNG `maskStyleClass` | **70** | CDK **88** | Native backdrop is correct and cheap. Cannot disable, restyle per-open (except token/panel), or use static. |
| Focus | `applyAutoFocus` + opener capture + `restoreFocus` boolean; modal trap via `showModal()` (`dialog.service.ts`) | CDK FocusTrap + `first-heading` + rich restore; PrimeNG `focusTrap` | **72** | CDK **92** | Excellent for modal. Weak for modeless. Native top layer beats Overlay `aria-hidden` on supporting browsers. |
| ARIA labelling | `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`; auto `labelledby` from `.al-dialog-title` (`ensureTitleId`) | Same trio + explicit `role`; PrimeNG ConfirmDialog trigger relationship | **76** | CDK/Material **90** / PrimeNG confirm **88** | Auto title wiring is good. Missing `role` and trigger `aria-expanded`. |
| Navigation dismiss | `closeOnNavigation` default-on for modals via `Location.onUrlChange` (`dialog.service.ts`) | CDK/Material `closeOnNavigation` (history); ngx-bootstrap browser-back reason | **80** | CDK **82** | `Location` is the right Angular primitive; works without a Router peer. |
| Global defaults | `provideDialog(config)` + `DIALOG_CONFIG` + `service.config` **WritableSignal** + `updateConfig` merge (`provide-dialog.ts`, `dialog.service.ts`) | `MAT_DIALOG_DEFAULT_OPTIONS`, `NgbModalConfig`, `provideDialogConfig` (@ngneat), `DEFAULT_DIALOG_CONFIG` (CDK) | **90** | ngneat **84** / Material **86** | Signal + factory/Signal `strings` is the best 2026 fit. Merge rules for strings are tested (`dialog-dx.spec.ts`). |
| Size presets | `sm` 320 / `md` 480 / `lg` 640 / `xl` 800 / `full` 90vw (`DIALOG_SIZE_PRESETS`) | @ngneat customizable `sizes`; ng-bootstrap `sm\|lg\|xl`; Material free CSS | **78** | ngneat **88** | Ours are fixed pixels. No user `sizes` map; `full` is 90vw not 100%. |
| Theming | Public CSS tokens on `dialog.al-dialog`; dock tokens on `:root`; dark via `prefers-color-scheme` (`core.css`, `window.css`) | Material M3 tokens; PrimeNG styled/unstyled + `pt`; Bootstrap variables | **82** | Material **88** / PrimeNG **86** | Zero JS theme runtime. No class-based dark (only OS preference). Documented token table in README. |
| i18n chrome strings | `DialogStringsSource` = object \| Signal \| factory; per-call `confirm({ strings })` (`dialog.types.ts`, `confirm`) | PrimeNG locale API; Material i18n via app; Zorro `nzOkText` | **86** | PrimeNG **88** | Reactive strings without a translate peer. Resolved at **open**, not live-bound after open (except next dialog). |
| Animation | `animation: false \| 'fade' \| { enter, leave }` + `prefers-reduced-motion` (`dialog-ref.ts` `runLeaveAnimation`, `core.css`) | Material duration ms; PrimeNG Motion; ng-bootstrap `animation` boolean | **74** | Material **84** / PrimeNG **80** | Class-based is tree-shakeable and CSS-first. No duration API; 200ms JS fallback if no transition. |
| Drag | `draggablePlugin` — pointer events, handle selector, skip interactive + resize edge, optional `containInViewport` (default **false**) | PrimeNG header drag + `keepInViewport` default true; @ngneat constrain/bounce; Zorro `nzDraggable` | **80** | PrimeNG **86** / ngneat **84** | Solid pointer implementation. Default unconstrained; no bounce; no drag-to-snap. |
| Resize | CSS `resize: both` + `ResizeObserver` sync into layout state (`dialog.service.ts`, `dialog-ref.ts`) | PrimeNG JS handles; @ngneat resizable | **76** | PrimeNG **84** | Native handle is simple and accessible. Limited look/feel; edge reservation in drag plugin is thoughtful (`RESIZE_EDGE_PX`). |
| Maximize / minimize / fullscreen | `actions/maximize.ts`, `minimize.ts`, `fullscreen.ts`; `DialogRef` methods + `state` signal; dock taskbar plugin | PrimeNG `maximizable` (viewport maximize, not Fullscreen API); ng-bootstrap `fullscreen` breakpoint | **91** | PrimeNG **70** / ng-bootstrap **72** | **We lead.** Native Fullscreen API + Safari `<dialog>` workaround (fullscreen the first child). Minimize is modeless-only (correct). |
| Tile / edge snap / dock / persist | `tileSnappingPlugin` (Alt+S grid), `snapToEdgePlugin` (Alt+Arrows), `dockPlugin`, `layoutPersistencePlugin`; declarative `drag/snap/dock/persist` (`behavior-resolver.ts`) | No serious equivalent in CDK/Material/Bootstrap. PrimeNG has drag+max only. | **93** | others **20–40** | Unique product surface. Correctly documented as desktop-oriented. Persistence supports `localStorage` or custom async save/restore. |
| Plugin system | `definePlugin` + merge (global → behavior → per-open, last id wins, `false` disables) (`define-plugin.ts`, `behavior-resolver.ts`) | CDK is not plugin-based; PrimeNG PassThrough; ng-primitives composition | **90** | CDK **40** (extensible via container type) / PrimeNG `pt` **78** | Best escape hatch in this comparison. Lifecycle is complete (`setup` teardown, `beforeClose`, `onLayoutChange`). |
| Nested dialogs | `options.parent` + `children[]`; close cascades `parent-closed` (`dialog-ref.ts`, spec) | Overlay stacks (CDK/Bootstrap) without explicit parent tree | **84** | CDK **70** | Explicit tree is clearer for window UIs. |
| Confirm / alert | `await dialog.confirm()` / `alert()` → boolean / void (`dialog.service.ts`) | Zorro methods; PrimeNG ConfirmationService; app-built Material | **74** | Zorro **90** / PrimeNG **88** | Best DX for the simple case (Promise boolean). Loses on content richness and `alertdialog`. |
| Popover | `dialog.popover` + `popoverPlugin` (9 placements, offset, arrow, scroll/resize listeners) | Floating UI / CDK connected overlay / PrimeNG Popover | **58** | Floating UI **92** / CDK overlay **86** | Intent API is nicer than assembling Overlay. Geometry is not production-grade (no flip). |
| Toast | `dialog.toast` + stack CSS vars + ResizeObserver (`dialog.service.ts`, `core.css`) | PrimeNG Toast; ngx-toastr (outside this set) | **70** | PrimeNG **86** | Correct live-region and stack math (double rAF). Narrow feature set. |
| Default chrome | `DefaultDialogComponent` — title/subtitle, window icons, primary/secondary/close **close with results**, nested `contentComponent` | Material directives; PrimeNG header/footer templates; Zorro footer buttons | **80** | Material **88** / Zorro **86** | Results-on-click is the right default (README). Header omitted when empty. No structural directives for custom components. |
| Testing | `provideDialogTesting`, `patchDialogElement`, `DialogTestingController`, `wrapDialogServiceForTesting` (`testing/`) | `MatDialogHarness`; CDK overlay harnesses | **62** | Material **90** | Honest jsdom polyfill. Two-step wrap is a footgun. No harness. Confirm works **if** `open` was wrapped. |
| Packaging | 2 Angular peers; CSS via `exports` (`./styles.css`, `core`, `window`); `sideEffects` includes CSS; secondary `testing` entry | CDK/Material/Zorro/ng-primitives pull Overlay; Bootstrap kits pull CSS framework | **94** | @ngneat **92** / CDK **70** (peer weight) | Lightest serious dialog. Native `<dialog>` is the packaging strategy. |
| SSR | Documented unsafe; uses `document` immediately | Overlay-based kits work with platform checks | **25** | CDK **88** | Known, documented. Blocks many 2026 apps until fixed. |
| Intent API surface | `open` / `window` / `confirm` / `alert` / `popover` / `toast` | Competitors split across Dialog + Confirm + Toast + Overlay | **92** | PrimeNG kit **80** (complete but fragmented) | One service, one mental model. The winning DX story — if gaps in §B close. |

---

## D) Improvement backlog

**100** = do before the next publish of `0.1.x` / `0.2.0`.

| Improvement | Priority 1–100 | Rationale |
|-------------|----------------:|-----------|
| Split dismiss: `closeOnEscape`, `closeOnBackdrop`, `hasBackdrop`, `backdropClass` (keep `disableClose` as both-off shorthand) | **96** | Highest-traffic production need. Static backdrop is table stakes vs Bootstrap/PrimeNG/ngneat. Small API; we already have the click + `cancel` listeners. |
| Set `role="alertdialog"` on `confirm()` / `alert()`; add `role?: 'dialog' \| 'alertdialog'` on `DialogOptions` | **94** | Accessibility bug on our flagship helpers. Native implicit `dialog` is not enough. One attribute in `applyAria`. |
| `open(TemplateRef \| Type)` with template context `{ $implicit: data, dialogRef }` | **93** | Unblocks the majority of CDK/Material/ng-bootstrap migrations. Does not require CDK if we instantiate the embedded view on the dialog element. |
| Platform-safe `open`: no-op / throw / queue until `isPlatformBrowser`; document hydration recipe | **92** | README already admits the hole. Publishing `0.1.0` as “Angular 19+” without an SSR path will bounce every Universal app. |
| Popover: flip + shift (either `@floating-ui/dom` **optional** peer or a 50-line flip). Keep clamp as fallback. | **90** | Current popover mis-places near edges. Optional peer preserves the 2-peer story for users who only `open()`. |
| Mobile policy: `fullscreenBelow?: 'sm'\|'md'\|…` on `open()`, and/or auto-`open` instead of `window` under a breakpoint | **88** | We currently tell mobile users “don’t use our window features” without a first-class alternative. |
| Confirm richness: `content: string \| TemplateRef \| Type`, `icon`, `onConfirm?: () => boolean \| Promise<boolean>`, optional `variant` | **86** | Keeps the `await confirm()` DX while matching Zorro/PrimeNG for delete flows. Reuse `DefaultDialogComponent.contentComponent`. |
| Testing: auto-wrap inside `provideDialogTesting()`; track `confirm`/`alert`; add a small `DialogHarness` (title text, click primary, Esc) | **85** | Today’s two-step wrap will be copy-pasted wrong. Harness is how Material teams test. Do this before we claim a testing story in the README. |
| `getDialogById`, reject or warn on duplicate `id`, expose `openDialogs` as `readonly` signal | **80** | Persistence already keys on `id`. Duplicates are a silent layout bug. Signal-fit for the rest of the library. |
| `restoreFocus: boolean \| string \| HTMLElement`; autofocus `'first-heading'` alias | **76** | Cheap CDK parity. Helps routed apps whose opener unmounts. |
| `scrollable?: boolean` + optional modal `position: 'center' \| 'top' \| 'bottom'` (sheet-lite) | **74** | Covers long forms and mobile top/bottom sheets without a new package. |
| `ViewContainerRef` / `providers` / `bindings` on `DialogOptions` | **72** | Needed for feature-store injectors and Angular `inputBinding()`. `options.injector` is a partial answer. |
| `direction?: 'ltr' \| 'rtl'` on the `<dialog>` and DefaultDialog chrome | **68** | Token + `dir` attribute. Required for any RTL locale we already support via `strings`. |
| Optional `@floating-ui/dom` (or document “bring your own middleware” plugin) for popover | **66** | If flip lands in-house, this is follow-up. Don’t add a hard peer. |
| `DialogRef.addPanelClass` / `updateAria` / live `updateConfig` | **60** | ng-bootstrap/CDK parity for long-lived windows. |
| Toast: `severity`, optional action, `top-center` / `bottom-center` | **55** | Only if we keep marketing toast. Otherwise point to a toast library and keep this helper minimal. |
| `dialogClose` directive + headless `alDialogTitle` / `alDialogContent` / `alDialogActions` attributes | **52** | Helps custom chrome without forcing `DefaultDialogComponent`. |
| Observable `beforeClose` / `closed$` aliases | **48** | Thin RxJS wrappers. Do not replace the Promise. |
| `prompt()` helper | **35** | Build after TemplateRef + confirm richness. |
| Drag-to-edge snap during pointer move | **28** | Desktop delight; not a publish blocker. |

### Suggested publish bar

Before the next npm publish, the items at **≥ 85** should land or be explicitly deferred in the README with a “not in 0.1” list: **dismiss split, alertdialog role, TemplateRef, SSR guard, popover flip, mobile fullscreen, confirm richness, testing auto-wrap**.

Window/dock/tile work is already ahead of the field — do not block 0.2 on more window chrome.

---

## Source index (ours)

- Public API: `projects/angular-libs/dialog/src/public-api.ts`
- Service: `projects/angular-libs/dialog/src/lib/dialog.service.ts`
- Ref: `projects/angular-libs/dialog/src/lib/dialog-ref.ts`
- Types: `projects/angular-libs/dialog/src/lib/dialog.types.ts`
- Plugins + resolver: `projects/angular-libs/dialog/src/lib/plugins/*`, `behavior-resolver.ts`
- Testing: `projects/angular-libs/dialog/testing/src/lib/dialog-testing.ts`
- Peers / exports: `projects/angular-libs/dialog/package.json`

## Competitor URLs (canonical)

- https://github.com/angular/components/blob/main/src/cdk/dialog/dialog.ts
- https://github.com/angular/components/blob/main/src/cdk/dialog/dialog-config.ts
- https://github.com/angular/components/blob/main/src/cdk/dialog/dialog-ref.ts
- https://material.angular.dev/components/dialog/overview
- https://github.com/angular/components/blob/main/src/material/dialog/dialog-config.ts
- https://next.material.angular.dev/docs-content/api-docs/material-dialog-testing
- https://primeng.org/dialog
- https://primeng.org/dynamicdialog
- https://primeng.org/confirmdialog
- https://github.com/primefaces/primeng/blob/master/packages/primeng/src/dialog/dialog.ts
- https://github.com/primefaces/primeng/blob/master/packages/primeng/src/dynamicdialog/dynamicdialog-config.ts
- https://valor-software.com/ngx-bootstrap/components/modals?tab=overview
- https://github.com/valor-software/ngx-bootstrap/blob/development/src/modal/modal-options.class.ts
- https://ng-bootstrap.github.io/#/components/modal/api
- https://github.com/ng-bootstrap/ng-bootstrap/blob/master/src/modal/modal-config.ts
- https://www.npmjs.com/package/@ngneat/dialog
- https://github.com/ngneat/dialog
- https://ng.ant.design/components/modal/en
- https://github.com/NG-ZORRO/ng-zorro-antd/blob/master/components/modal/modal-types.ts
- https://angularprimitives.com/primitives/dialog
- https://github.com/ng-primitives/ng-primitives
- https://headlessui.com/react/dialog
- https://ark-ui.com/docs/components/dialog
- https://github.com/chakra-ui/ark/pull/3888
- https://floating-ui.com/docs/dialog
- https://floating-ui.com/docs/middleware
