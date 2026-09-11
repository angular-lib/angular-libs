# Competitive research: `@angular-libs/web`

**Scope:** `projects/angular-libs/web` only. No feature implementation. No other monorepo packages.

**Method:** every claim about *our* surface is traced to source under `projects/angular-libs/web`. Competitor claims are taken from current public docs / published APIs (URLs cited). Marketing copy is not treated as capability.

**Package under review:** `@angular-libs/web@0.0.3` (`projects/angular-libs/web/package.json`)

- Peers: `@angular/core` and `@angular/common` `>=18.0.0`. No CDK, RxJS, or other runtime peers.
- Public API: `projects/angular-libs/web/src/public-api.ts` re-exports all signals, two directives, and `resolveSignalContext`.
- Homepage: https://angular-lib.github.io/angular-libs/web

---

## What we actually ship (source-traced)

README feature list matches the public exports. Implementation details that matter for comparison:

### Directives

| Export | Source | Real behavior |
| --- | --- | --- |
| `AlClickOutsideDirective` | `src/lib/directives/click-outside.directive.ts` | Host `(document:click)` (bubble phase). Emits `alClickOutside` when the click target is outside the host and not in `alClickOutsideIgnore` (HTMLElement, `ElementRef`, or CSS selector via `closest`). No enable flag, delay, capture, pointer/touch events, iframe/blur, or once-mode. |
| `AlFileDropDirective` | `src/lib/directives/file-drop.directive.ts` | `dragover` / `dragleave` / `drop`. Signal `isOver`. Host class `al-file-drop-over`. Filters `accept` (extension / MIME / `type/*`) and `maxFileSize`. Emits `filesDropped` (`File[]`), `fileRejected` (`type` \| `size`), and `fileDrop` (raw `FileList`, only if at least one file was accepted). No click-to-browse, directory entries, `multiple` cap, or `dragenter`. |

### Signals / helpers

| Export | Source | Real behavior |
| --- | --- | --- |
| `geolocationSignal` | `src/lib/signals/geolocation.ts` | `watch` (default) or `once`. `PositionOptions` + **`distanceFilter` meters**. Loading / coords / speed / heading / accuracy / error / timestamp. `clearWatch` on `DestroyRef` in watch mode only. |
| `idleSignal` | `src/lib/signals/idle.ts` | DOM inactivity boolean. Default timeout 300_000 ms. Default events `mousemove`, `mousedown`, `resize`, `keydown`, `touchstart`, `wheel`. 500 ms throttle while active. **Not** the Idle Detection API. No `lastActive`, `reset()`, or visibility listener. |
| `permissionSignal` | `src/lib/signals/permission.ts` | `navigator.permissions.query` + `change`. States: `PermissionState` \| `'unsupported'` \| `'loading'`. Query only; no request helper. |
| `clipboardSignal` | `src/lib/signals/clipboard.ts` | `writeText`, `copied` auto-reset (default 2000 ms), optional `read` on `copy`/`cut`. Text only. No `ClipboardItem`, no `execCommand` fallback. Write failures are swallowed. |
| `networkSignal` | `src/lib/signals/network.ts` | `online`/`offline` + `connection`/`moz`/`webkit` `change`. Fields: `supported`, `online`, `downlink`, `effectiveType`, `rtt`, `saveData`, derived **`isLowBandwidth`**. No `type`, `downlinkMax`, `offlineAt`, `onlineAt`. |
| `screenOrientationSignal` | `src/lib/signals/screen-orientation.ts` | Read-only `type` + `angle` from `screen.orientation`. No `lock` / `unlock`. |
| `keyboardStateSignal` | `src/lib/signals/keyboard-state.ts` | Window `keydown`/`keyup`/`blur`. `keys[]` + `ctrl`/`shift`/`alt`/`meta`. No target element, preventDefault, or shortcut matching. |
| `deviceOrientationSignal` | `src/lib/signals/device-orientation.ts` | `deviceorientation` + iOS `DeviceOrientationEvent.requestPermission`. Object `{ state, requestPermission }`. |
| `batterySignal` | `src/lib/signals/battery.ts` | `navigator.getBattery()` + four change events. Derived **`isLowBattery`** (default threshold 0.15). Chromium-only API. |
| `mediaDevicesSignal` | `src/lib/signals/media-devices.ts` | `enumerateDevices` + `devicechange`. No `getUserMedia` / `getDisplayMedia`. |
| `performanceSignal` | `src/lib/signals/performance.ts` | Navigation timing snapshot, Chrome `performance.memory`, FCP + LCP via `PerformanceObserver`. No CLS / INP / TTFB. Memory is not polled after load. |
| `pictureInPictureSignal` | `src/lib/signals/picture-in-picture.ts` | Video element `requestPictureInPicture` / `exitPictureInPicture`. Not Document Picture-in-Picture. |
| `vibrateSignal` | `src/lib/signals/vibrate.ts` | **Not a signal.** Command object: `vibrate`, `success`/`error`/`warning`/`scan` presets, `cancel`. |
| `bluetoothSignal` | `src/lib/signals/bluetooth.ts` | `bluetooth.requestDevice` + `gattserverdisconnected`. `disconnect()` calls `gatt.disconnect` if already connected. **Does not call `gatt.connect()`.** `connected` is whatever the picker already reported. |
| `nfcSignal` | `src/lib/signals/nfc.ts` | `NDEFReader.scan` / `write`, decode records, `readText` / `readJson`. Abort on destroy. |
| `accelerometerSignal` / `gyroscopeSignal` / `ambientLightSignal` | matching files | Generic Sensor API: `start`/`stop`, frequency + referenceFrame options. |
| `fileSystemSignal` | `src/lib/signals/file-system-access.ts` | `showOpenFilePicker` + `showSaveFilePicker`. Text `open`/`save`/`clear`. AbortError not stored as error. Write failure aborts the writable. **No directory picker, no `saveAs` vs `save`, no ArrayBuffer/Blob data types.** `DestroyRef` is injected and unused. |
| `resizeObserverSignal` | `src/lib/signals/resize.ts` | Target: element, `ElementRef`, CSS selector, getter, or `Signal`. rAF-throttled `{ supported, width, height }` from **`contentRect` only**. `observe(element, {})` — no `box` option, no `borderBoxSize` / `devicePixelContentBoxSize`. |
| `resolveSignalContext` | `src/lib/utils/injection.ts` | Resolves `DOCUMENT` + `DestroyRef`, optional `injector`, dev warning if teardown cannot be registered. **Exported, but no signal calls it.** Every signal duplicates `inject`/`try`/`catch` and most ignore the documented `injector` option. |

### Cleanup / SSR (cross-cutting)

- Listeners are typically torn down via `DestroyRef.onDestroy` when injection succeeds.
- Soft fallback if called outside an injection context: listeners may leak (dev warning only exists on `resolveSignalContext`, which is unused).
- No `PLATFORM_ID` / `isPlatformBrowser` guards. Server safety is `typeof window` / missing API checks.
- No `NgZone.runOutsideAngular` for high-frequency observers (resize, sensors, geolocation, keyboard).

### Tests actually present

Specs exist for resize, click-outside, file-drop, bluetooth, NFC, and file-system-access. The remaining signals have no unit tests in this package.

---

## A) Competitor inventory (11 libraries)

Closest Angular Web-API wrappers, official Angular primitives that teams already use instead of this package, plus the VueUse category template this library is modeled after.

| # | Library | Kind | Why it is in scope | Primary URLs |
| --- | --- | --- | --- | --- |
| 1 | **Angular CDK** (`@angular/cdk`) | Official Angular primitives | Production dismiss/focus/layout/observer stack. Overlay outside-click, a11y `FocusMonitor`, `BreakpointObserver`, public `ContentObserver` (MutationObserver). ResizeObserver exists only as **private** `SharedResizeObserver`. | [layout](https://github.com/angular/components/blob/master/src/cdk/layout/layout.md), [observers API](https://next.material.angular.dev/docs-content/api-docs/cdk-observers), [a11y](https://github.com/angular/components/blob/main/src/cdk/a11y/a11y.md), [overlay `outsidePointerEvents`](https://github.com/angular/components/blob/master/src/cdk/overlay/overlay-ref.ts), [private SharedResizeObserver](https://github.com/angular/components/blob/master/src/material/tabs/paginated-tab-header.ts) |
| 2 | **`@ng-web-apis/*` (Taiga family)** | Angular Web API wrappers | The established Angular equivalent of “idiomatic Web API packages”: geolocation, resize/intersection/mutation observers, permissions, screen orientation, storage, speech, MIDI, notification, payment, workers, canvas, audio, view-transition, plus **`@ng-web-apis/universal` SSR mocks**. Observable / directive / DI-token style, not signals. | [repo](https://github.com/taiga-family/ng-web-apis), [geolocation](https://github.com/taiga-family/ng-web-apis/blob/main/libs/geolocation/README.md), [resize-observer](https://github.com/taiga-family/ng-web-apis/blob/main/libs/resize-observer/README.md), [intersection-observer](https://github.com/taiga-family/ng-web-apis/blob/main/libs/intersection-observer/README.md), [permissions](https://github.com/taiga-family/ng-web-apis/blob/main/libs/permissions/README.md), [storage](https://github.com/taiga-family/ng-web-apis/blob/main/libs/storage/README.md), [universal](https://github.com/taiga-family/ng-web-apis/blob/main/libs/universal/README.md) |
| 3 | **ngxtension** | Signal-first Angular utilities | Overlaps click-outside, resize, network, document visibility, intersection, localStorage, text selection. Modern `inject*` + signals; not a hardware-API kit. | [site](https://ngxtension.dev/), [clickOutside](https://ngxtension.dev/utilities/dom-events/click-outside/), [injectNetwork](https://ngxtension.dev/utilities/browser-apis/inject-network/), [injectDocumentVisibility](https://ngxtension.dev/utilities/browser-apis/inject-document-visibility/), [injectIsIntersecting](https://ngxtension.dev/utilities/browser-apis/inject-is-intersecting/), [injectLocalStorage](https://ngxtension.dev/utilities/browser-apis/inject-local-storage/), [injectTextSelection](https://ngxtension.dev/utilities/browser-apis/inject-text-selection/) |
| 4 | **VueUse (`@vueuse/core`)** | Cross-framework category gold standard | The composable catalog this package most resembles (battery, clipboard, idle, geolocation, bluetooth, file system, sensors, observers). Vue-only, but it is the feature bar teams compare against. **No `useNfc`.** | [functions](https://vueuse.org/functions), [useGeolocation](https://vueuse.org/core/useGeolocation/), [useFileSystemAccess](https://vueuse.org/core/useFileSystemAccess/), [useBluetooth](https://vueuse.org/core/useBluetooth/), [onClickOutside](https://vueuse.org/core/onClickOutside/), [useDropZone](https://vueuse.org/core/useDropZone/) |
| 5 | **RxJS `fromEvent` + Angular `toSignal` / `takeUntilDestroyed`** | Official interop pattern | Default “don’t add a library” path for any DOM/Web event. Cold, composable, injection-aware teardown. Zero hardware helpers. | [`fromEvent` (RxJS 7 docs)](https://rxjs.dev/api/index/function/fromEvent), [Learn RxJS `fromEvent`](https://www.learnrxjs.io/learn-rxjs/operators/creation/fromevent), [`toSignal`](https://angular.dev/api/core/rxjs-interop/toSignal), [`takeUntilDestroyed`](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed) |
| 6 | **Raw browser APIs** | Platform | Always available alternative. Full capability (GATT connect, directory picker, Document PiP, Idle Detection, Wake Lock, etc.). Cost is boilerplate, SSR, and leak-prone teardown. | [Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [Permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API), [File System Access](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API), [Web NFC](https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API), [Idle Detection](https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API) |
| 7 | **Angular Aria (`@angular/aria`)** | Official headless a11y (dev preview) | Relevant only for *UI dismiss / keyboard / focus* that click-outside and keyboard-state often fake. Not a Web API wrapper. Combobox/menu/listbox handle expansion, focus, and Escape. | [overview](https://angular.dev/guide/aria/overview), [v21 announcement](https://blog.angular.dev/announcing-angular-v21-57946c34f14b) |
| 8 | **ng-click-outside2** | Focused Angular directive | Dedicated outside-click with enable, event list (`click,touchstart`), delay init, exclude selectors, attach-on-click, window blur/iframe. ~30k weekly downloads. | [npm](https://www.npmjs.com/package/ng-click-outside2), [README](https://github.com/Kr0san89/ng-click-outside/blob/master/README.md) |
| 9 | **ngx-file-drop** | Focused Angular drop zone | File **and folder** drop, browse button via `openFileSelector`, `multiple`, `directory`, `useDragEnter`. Last published v16 (2023) — Angular version lag is a real risk. | [npm](https://www.npmjs.com/package/ngx-file-drop), [repo](https://github.com/georgipeltekov/ngx-file-drop) |
| 10 | **ngx-viewport-signals** | Signal Intersection/Resize | Four primitives: `inViewport`, `viewportRatio`, `elementSize`, `scrollProgress`. SSR via `PLATFORM_ID`. Closest signal-native observer sibling. | [repo](https://github.com/ysndmr/ngx-viewport-signals) |
| 11 | **`@ngneat/hotkeys`** | Keyboard shortcuts | Published `4.1.0` typings: `HotkeysService.addShortcut` / `addSequenceShortcut`, `allowIn` (`INPUT`/`TEXTAREA`/`SELECT`/`CONTENTEDITABLE`), `preventDefault`, `pause`/`resume`, help modal, `isActive` signal. Overlaps `keyboardStateSignal` only as “keys were pressed”; it is a command layer, not a key-state sensor. | [npm](https://www.npmjs.com/package/@ngneat/hotkeys), [service typings](https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/lib/hotkeys.service.d.ts), [directive typings](https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/lib/hotkeys.directive.d.ts) |

### Considered, not inventoried

| Candidate | Why excluded |
| --- | --- |
| `@ngneat/overview` | Dynamic views / `injectViewContext`. Not Web APIs. |
| `@rx-angular/cdk` | Zone/render strategies, not observer/hardware wrappers. Virtual scroll uses ResizeObserver internally. |
| `@angular-libs/shortcut` (this monorepo) | Out of scope per brief; it is the in-house hotkey competitor, not an external lib. |
| PrimeNG / Material file upload | Full UI widgets, not primitives. |

---

## B) Gap table

Missing = not present in our public API, or present only as a stub that cannot do the competitor’s job. Essentiality is “how often an Angular app that already wants `@angular-libs/web` would need this.”

| Missing feature | Who has it | Essentiality (1–100) | Why |
| --- | --- | --- | --- |
| **IntersectionObserver signal / directive** (`isIntersecting`, ratio, `once`, root/threshold) | `@ng-web-apis/intersection-observer`; ngxtension `injectIsIntersecting`; VueUse `useIntersectionObserver` / `useElementVisibility`; `ngx-viewport-signals` `inViewport`/`viewportRatio` | **92** | Lazy-load, infinite scroll, reveal-on-scroll are more common than NFC/Bluetooth. We wrap ResizeObserver but not the sibling Observer API. |
| **`matchMedia` / breakpoints as a signal** | CDK `BreakpointObserver` + `Breakpoints`; VueUse `useMediaQuery` / `useBreakpoints`; raw `window.matchMedia` | **90** | Responsive layout is table-stakes. We expose screen *orientation* but not viewport queries. Teams already take CDK for this. |
| **SSR / `PLATFORM_ID` + injectable window/document** | `@ng-web-apis/universal` `provideUniversal()`; `ngx-viewport-signals` (`PLATFORM_ID`); ngxtension `window`/`document` options; VueUse `useSupported` / configurable window | **88** | Signals touch `window`/`navigator` at construction. Without DI mocks or platform guards, SSR and tests require ad-hoc stubs. `resolveSignalContext` exists but is unused. |
| **Generic `fromEvent` / `eventListener` signal** | RxJS `fromEvent` + `toSignal` + `takeUntilDestroyed`; VueUse `useEventListener` | **86** | Without this, every new API is a one-off file. Competitors compose; we copy-paste `inject`/`addEventListener`/`DestroyRef`. |
| **`document.visibilityState` signal** | ngxtension `injectDocumentVisibility`; VueUse `useDocumentVisibility`; `fromEvent(document, 'visibilitychange')` | **82** | Pause video, polls, geolocation, and wake work when the tab hides. Our `idleSignal` ignores visibility (VueUse listens by default). |
| **`localStorage` / `sessionStorage` signal** (tab sync) | ngxtension `injectLocalStorage`; VueUse `useStorage` / `useLocalStorage`; `@ng-web-apis/storage` | **80** | Highest-traffic Web API we do not wrap. Adjacent to “browser signals” and missing from the kit. |
| **Click-outside: capture + pointer/touch + enable + delay + iframe/blur** | VueUse `onClickOutside` (`capture` default true, `ignore`, `detectIframe`, `controls`); ng-click-outside2 (`clickOutsideEvents`, `clickOutsideEnabled`, `delayClickOutsideInit`, `clickOutsideEmitOnBlur`, exclude); CDK overlay `outsidePointerEvents` / `overlayOutsideClick` | **78** | Our ignore-list is real, but bubble-`click` only is a known mobile/iframe footgun. Dropdowns in this demo already `$event.stopPropagation()` to compensate. |
| **ResizeObserver `box` option + full `ResizeObserverEntry`** | `@ng-web-apis/resize-observer` `waResizeBox`; ngxtension `injectResize` (`box`, debounce, `offsetSize`); VueUse `useResizeObserver` (`ResizeObserverOptions`); CDK private `SharedResizeObserver` | **76** | We emit `{width,height}` from `contentRect` and pass `observe(el, {})`. Border-box / device-pixel box is required for chrome, canvas, and HiDPI. |
| **File-drop: click-to-browse + directories + `multiple`** | ngx-file-drop (`openFileSelector`, `directory`, `multiple`); VueUse `useDropZone` (`multiple`, `dataTypes`, `onEnter`/`onLeave`/`onOver`, `checkValidity`) + `useFileDialog` | **74** | Accessibility and desktop UX expect a browse control. Folder drops are the main reason apps pick ngx-file-drop over a 40-line directive. |
| **`getUserMedia` / `getDisplayMedia` (streams, not just enumerate)** | VueUse `useUserMedia` / `useDisplayMedia` / `useDevicesList`; raw `mediaDevices` | **72** | `mediaDevicesSignal` lists devices but cannot open a camera/mic. Enumeration without labels is incomplete until a stream is requested. |
| **MutationObserver / content observe** | CDK `ContentObserver` + `cdkObserveContent` (debounce, disable); `@ng-web-apis/mutation-observer`; VueUse `useMutationObserver` | **70** | Autosize, live HTML, and custom form controls. CDK already ships this; we do not. |
| **Route `resolveSignalContext` through every factory + honor `injector`** | ngxtension (`injector` on inject* helpers); Angular `toSignal({ injector })`; VueUse configurable window/navigator | **70** | Public helper is dead code. Signals that leak when constructed in `ngOnInit` without injector are a production bug class, not a docs issue. |
| **Focus origin / focus-within** | CDK `FocusMonitor` (`mouse`/`keyboard`/`touch`/`program`); VueUse `useFocus` / `useFocusWithin` / `useActiveElement`; Angular Aria focus modes | **68** | Pair with click-outside for accessible menus. Aria/CDK already own this; we should not reinvent widgets, but a thin focus signal would complement dismiss. |
| **Fullscreen API** | VueUse `useFullscreen`; raw Fullscreen API | **64** | Common media/app-shell control. Same “command + state” shape as our PiP helper. |
| **Clipboard: `execCommand` fallback + `ClipboardItem` (images)** | VueUse `useClipboard` (`legacy`) + `useClipboardItems`; raw Clipboard API | **62** | Our `copy()` no-ops when `navigator.clipboard` is missing (HTTP, older Safari). Write errors are silent. |
| **File System Access: `create` / `saveAs` / binary / directory** | VueUse `useFileSystemAccess` (`dataType` Text\|ArrayBuffer\|Blob, `create`, `save`, `saveAs`, `updateData`); raw `showDirectoryPicker` / `showSaveFilePicker` | **62** | We only persist strings on a single handle. Editors that need “Save As”, images, or folder access still drop to the raw API. |
| **Bluetooth `gatt.connect()` + GATT server** | VueUse `useBluetooth` returns `server` after connect; raw Web Bluetooth | **60** | `requestDevice` without `gatt.connect()` is a picker, not a connection manager. Specs assert `connected` only when the mock already has `gatt.connected = true`. |
| **Screen orientation `lock` / `unlock`** | VueUse `useScreenOrientation` (`lockOrientation`/`unlockOrientation`); raw `screen.orientation.lock` | **55** | Needed for video/games. We are read-only. `@ng-web-apis/screen-orientation` is an Observable of current orientation (lock not documented in its README). |
| **Idle: `lastActive`, `reset()`, visibility** | VueUse `useIdle` (default 1 min, `lastActive`, `reset`, `listenForVisibilityChange: true`) | **55** | Session-timeout UIs need last-active display and a manual reset. Our timeout default is 5 minutes and visibility is ignored. |
| **Geolocation pause / resume** | VueUse `useGeolocation` (`pause`/`resume`, `immediate`); `@ng-web-apis/geolocation` is cold (unsubscribe = stop) | **54** | We start watching immediately and cannot pause without destroying the host. `distanceFilter` is a plus they lack. |
| **Prefers-color-scheme / reduced-motion / contrast** | VueUse `usePreferredDark` / `usePreferredReducedMotion` / `usePreferredContrast`; CDK `HighContrastModeDetector`; `matchMedia` | **52** | A11y theming. Partial overlap with a future media-query signal. |
| **Web Share API** | VueUse `useShare`; raw `navigator.share` | **48** | Small API, high mobile value. Fits the “command + supported” pattern of `vibrateSignal`. |
| **Wake Lock** | VueUse `useWakeLock`; raw Screen Wake Lock API | **48** | Pair with video/PiP/navigation. Visibility-aware in VueUse. |
| **Notifications** | `@ng-web-apis/notification`; VueUse `useWebNotification`; raw Notifications API | **45** | Permission + display. We query `notification` permission but cannot notify. |
| **Text selection** | ngxtension `injectTextSelection`; VueUse `useTextSelection` | **40** | Editor/tooltip feature. Out of hardware-API theme but in “browser signals”. |
| **Document Picture-in-Picture** | Raw Document PiP API | **32** | We wrap video PiP only (`HTMLVideoElement.requestPictureInPicture`). |
| **Idle Detection API (screen lock / user-idle permission)** | Raw [Idle Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API) | **28** | README already disclaims this. Chromium + permission gated. Do not confuse with `idleSignal`. |
| **Speech / MIDI / Payment / Workers / Canvas / Audio / View Transition** | `@ng-web-apis/*` matching packages; VueUse speech + workers | **22–35** | Real APIs, different product. Only chase if this package wants to become “Angular VueUse”, not “hardware + a few UI helpers”. |
| **Gamepad / BroadcastChannel / EyeDropper** | VueUse `useGamepad` / `useBroadcastChannel` / `useEyeDropper` | **20–30** | Long-tail. Not blocking adoption of the current kit. |

Angular Aria is **not** listed as owning a missing Web API. It owns accessible widget behavior. Using Aria for menus is complementary, not a substitute for `alClickOutside` on ad-hoc markup.

---

## C) Parity table

Scores: 100 = complete, production-hardened wrapper of that feature. 0 = absent. “Competitor” is the strongest relevant implementation, not an average.

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
| --- | --- | --- | --- | --- | --- |
| **Click outside** | Directive, bubble `document:click`, ignore HTMLElement / `ElementRef` / selector | VueUse: capture by default, ignore, iframe, stop/cancel/trigger. ng-click-outside2: events, enable, delay, exclude, blur. ngxtension: shared `fromEvent` outside zone, **no ignore**. CDK overlay: `outsidePointerEvents` for overlay panes | **68** | **92** (VueUse / ng-click-outside2) | Ignore-list beats ngxtension. Capture + touch + enable are the real gaps. CDK overlay is better when the UI is an overlay, not a bare `div`. |
| **File drop** | Directive + `isOver` signal + accept/size + typed rejections | VueUse `useDropZone`: types, multiple, enter/leave/over, custom validity. ngx-file-drop: folders + browse | **70** | **88** (ngx-file-drop UX; VueUse API) | Rejection reasons (`type`/`size`) are a real advantage. Missing browse/directories keeps us below dedicated libs. |
| **Geolocation** | Signal state, `watch`/`once`, `distanceFilter`, error object | VueUse: pause/resume, `locatedAt`. `@ng-web-apis/geolocation`: cold Observable, `WA_POSITION_OPTIONS`, support token | **78** | **84** (VueUse control; ng-web-apis DI) | Distance filter is unique and useful. We start eagerly and cannot pause. ng-web-apis is colder and SSR-friendlier. |
| **ResizeObserver** | Signal `{width,height}`, rAF throttle, reactive target (element / ref / selector / signal) | ng-web-apis: directive + `waResizeBox`. ngxtension: box, debounce, offsetSize, zone flag. VueUse: full entry + options. ngx-viewport-signals: `elementSize` + SSR | **72** | **88** (ng-web-apis / ngxtension) | Target flexibility and rAF are good. Empty `observe` options and contentRect-only state lose border-box / DPR cases. |
| **Battery** | Signal + `isLowBattery` threshold | VueUse `useBattery` (isSupported, charging, times, level). No first-class Angular peer | **82** | **80** (VueUse) | We are slightly ahead on derived low-battery UX. Same Chromium-only API. No Angular Observable alternative of note. |
| **Clipboard** | `copy` / `copied` / optional `read` | VueUse: `legacy` execCommand, `source`, `copiedDuring` 1500, `useClipboardItems` | **64** | **90** (VueUse) | Silent catch on write + no fallback = failed copies look successful in UI if callers only check `copied()`. |
| **Network** | One signal object + `isLowBandwidth` | ngxtension / VueUse: split signals, `type`, `downlinkMax`, `offlineAt`/`onlineAt` | **74** | **90** (ngxtension / VueUse) | `isLowBandwidth` is a useful derived flag. Missing `type` and timestamps. |
| **Idle (DOM)** | Boolean + timeout/events/element + 500 ms throttle | VueUse: `lastActive`, `reset`, visibility, stoppable, default 1 min | **60** | **90** (VueUse) | README correctly warns this is not Idle Detection. Control surface is thin. |
| **Permissions** | `permissionSignal(name)` | `@ng-web-apis/permissions` `state()` Observable (cold) + support token; VueUse `usePermission` | **76** | **82** (ng-web-apis) | Same query API. They win on DI/SSR and cold subscriptions. Neither requests permission (that lives on the feature API). |
| **Media device list** | `enumerateDevices` + `devicechange` | VueUse `useDevicesList` + `useUserMedia` / `useDisplayMedia` | **58** | **88** (VueUse) | List-only. Labels stay empty until a stream is opened — we do not open one. |
| **Screen orientation** | Read-only type + angle | VueUse lock/unlock + refs; `@ng-web-apis/screen-orientation` Observable | **62** | **86** (VueUse) | Fine as a sensor. Incomplete as a screen controller. |
| **Keyboard state** | Global pressed keys + modifiers, blur-clears | VueUse `useMagicKeys` / `useKeyModifier`; `@ngneat/hotkeys` for *commands* | **58** | **90** (VueUse keys; ngneat commands) | Good sensor. Not a shortcut system (and should not become one — that is a different package). |
| **Device orientation** | Event + iOS `requestPermission` | VueUse `useDeviceOrientation` / `useDeviceMotion` | **80** | **82** (VueUse) | iOS permission helper is the important bit; we have it. No DeviceMotion / accelerationIncludingGravity. |
| **Generic sensors (accel / gyro / light)** | start/stop + error + frequency | VueUse covers orientation/motion, not these three Generic Sensor constructors as first-class composables | **84** | **40** (VueUse / raw) | **Our lead.** Few Angular libs wrap `Accelerometer` / `Gyroscope` / `AmbientLightSensor`. |
| **Bluetooth** | Picker + disconnect listener + abort | VueUse: `requestDevice` **and GATT `server`**, `isConnected` | **48** | **86** (VueUse) | Naming implies connection management. Source never calls `gatt.connect()`. |
| **NFC** | scan/write + text/JSON helpers | No VueUse `useNfc`. Raw `NDEFReader`. No `@ng-web-apis/nfc` | **80** | **35** (raw only) | **Our lead** in Angular. Specs cover decode, errors, and listener-once. Still Chrome-Android gated. |
| **File System Access** | open/save/clear, text, AbortError hygiene, abort writable on write fail | VueUse: data types, create/save/saveAs, metadata computeds | **66** | **90** (VueUse) | Teardown/abort handling is careful. Feature surface is text-editor-only. |
| **Picture-in-Picture** | request/exit + `active` for a video element | VueUse has no dedicated video-PiP helper (Fullscreen + media controls instead) | **72** | **50** (raw / VueUse media) | Solid video-PiP. No Document PiP, no automatic `enterpictureinpicture` on user-initiated browser chrome. |
| **Vibration** | Command helper + presets | VueUse `useVibrate` | **70** | **75** (VueUse) | Presets are nicer than VueUse’s thin wrapper. Name `*Signal` is misleading (no `Signal`). |
| **Performance / vitals** | Nav timing + memory + FCP/LCP | VueUse `usePerformanceObserver` + `useMemory`; web-vitals | **55** | **80** (VueUse / web-vitals) | Snapshot, not a vitals toolkit. No CLS/INP. |
| **Intersection / viewport** | — | ng-web-apis directives; ngxtension; VueUse; ngx-viewport-signals | **0** | **90** | Absent. Highest-value missing observer. |
| **Media queries / breakpoints** | — | CDK `BreakpointObserver`; VueUse `useMediaQuery` | **0** | **94** (CDK) | Absent. CDK is the Angular default. |
| **Storage** | — | ngxtension signals; VueUse; `@ng-web-apis/storage` | **0** | **90** | Absent. |
| **Document visibility** | — | ngxtension; VueUse | **0** | **88** | Absent. |
| **SSR story** | `typeof window` / missing-API branches | `@ng-web-apis/universal`; ngx-viewport-signals `PLATFORM_ID` | **28** | **90** (ng-web-apis/universal) | We do not crash if `window` is missing, but we have no DI mocks or documented server providers. |
| **Injection / teardown consistency** | Per-file `try inject`; unused `resolveSignalContext` | Angular `toSignal({injector})`; ngxtension injector option; VueUse scope dispose | **40** | **88** | Helper was written for this problem and is not wired up. `fileSystemSignal` injects `DestroyRef` and never uses it. |
| **Hardware API breadth (BLE, NFC, sensors, battery, FS)** | One tree-shakeable Angular package | Split across VueUse + raw; almost empty in Angular CDK / ng-web-apis | **86** | **70** (VueUse, Vue-only) | **Category win in Angular.** This is why the package exists. Depth lags VueUse; breadth beats every Angular peer. |

---

## D) Improvement backlog

Priority is product value for `@angular-libs/web` as a *signal-first Angular Web/hardware kit*, not “clone VueUse.”

| Improvement | Priority (1–100) | Rationale |
| --- | --- | --- |
| **Wire `resolveSignalContext` (or equivalent) into every factory; honor `injector`** | **94** | Dead public API + copy-pasted inject blocks. Fixes leaks outside constructors and makes SSR/tests injectable. Source already exports the helper. |
| **Add `intersectionObserverSignal` (threshold, root, rootMargin, `once`, boolean + ratio)** | **92** | Highest-demand Observer we skipped. ngx-viewport-signals / ngxtension prove the signal shape. Pair with existing resize API. |
| **Add `mediaQuerySignal` / `breakpointsSignal` (or a thin `matchMedia` helper)** | **90** | Stops teams from pulling CDK solely for `BreakpointObserver`. Must document coexistence with CDK, not fight it. |
| **SSR: `PLATFORM_ID` + documented `injector`/`document`/`window` options** | **88** | Construction-time `window` access is the main production risk. ng-web-apis/universal is the bar. |
| **Click-outside: `pointerdown`/`touchstart`, capture option, `enabled`, delay-init** | **86** | Current bubble-`click` + demo `stopPropagation` is fragile. Match ng-click-outside2 events/enable and VueUse capture default without becoming an overlay framework. |
| **Resize: `box` option + expose `contentBoxSize` / `borderBoxSize` (keep rAF)** | **84** | One-line API hole vs ng-web-apis `waResizeBox`. Do not drop rAF throttle. |
| **File-drop: optional hidden `<input type="file">` / `openFilePicker()` + `multiple`** | **80** | Closes the a11y/browse gap vs ngx-file-drop without taking a folder-parser dependency. Directory support is a later increment. |
| **Bluetooth: `connect()` that calls `gatt.connect()`, expose server, keep abort/listener hygiene** | **78** | Current `connected` flag is misleading. VueUse already does this; our disconnect/leak tests are a good base. |
| **Clipboard: surface write errors; optional `legacy` fallback; do not set `copied` on failure** | **76** | Silent `catch` is a functional bug. VueUse `legacy` is the compatibility path. |
| **Idle: `lastActive`, `reset()`, `listenForVisibilityChange` (default on)** | **74** | Cheap, VueUse-proven, and our README already positions this as a session helper. |
| **Geolocation: `pause`/`resume` (and keep `distanceFilter` / `once`)** | **72** | Control without destroying the component. Cold start (`immediate: false`) for permission UX. |
| **`visibilitySignal`** | **72** | Tiny wrapper, unblocks pause patterns for PiP, geolocation, sensors, NFC scan. |
| **File system: `saveAs`, `dataType: 'text' \| 'arrayBuffer' \| 'blob'`, optional directory picker** | **70** | Unlocks non-text editors. Keep AbortError + writable.abort behavior. |
| **`storageSignal` (local/session, `storage` event sync)** | **68** | High usage, well-solved by ngxtension — only add if we want the kit to be one import. Otherwise document “use ngxtension”. |
| **Media: `getUserMedia` helper beside enumerate** | **66** | Makes `mediaDevicesSignal` honest (labels + actual capture). Keep enumerate as the list. |
| **Screen orientation `lock`/`unlock` methods** (same object shape as PiP) | **60** | Completes the API we already started. Feature-detect and error into state. |
| **Generic `fromEventSignal` / `listenSignal`** | **60** | Reduces future one-off files. Must not replace RxJS for complex pipelines — just the 80% “event → signal + DestroyRef” case. |
| **Zone: run observer/sensor callbacks outside Angular, mark/coalesce into signals** | **58** | ngxtension intersection already does this. Matters more as we add IntersectionObserver and 60 Hz sensors. |
| **Rename or dual-export `vibrateSignal` → command type** (docs + type name) | **52** | Avoids API lie. Presets can stay. |
| **Document Picture-in-Picture optional path** | **40** | Only if video-PiP users ask. Keep video API stable. |
| **Do not add Aria widgets, CDK overlay, or hotkey matching** | **— (anti-goal)** | Angular Aria, CDK overlay, and `@ngneat/hotkeys` / `@angular-libs/shortcut` already own those layers. Stay a Web/hardware signal kit. |
| **Do not add speech/MIDI/payment/canvas/audio** unless the package mission expands | **— (anti-goal)** | That is `@ng-web-apis`’s catalog. Breadth without depth would dilute the hardware niche. |
| **Test the untested signals** (geo, idle, permission, clipboard, network, orientation, keyboard, battery, media, performance, PiP, vibrate, sensors) | **85** | Current specs are the three “fixed” areas (bluetooth/NFC/FS) plus two directives + resize. Gaps above will regress without tests. |

---

## Positioning (after the tables)

`@angular-libs/web` is the only **signal-native, tree-shakeable Angular package** that groups hardware APIs (NFC, Bluetooth picker, Generic Sensors, battery, File System Access) with two UI directives. That is the wedge.

It is **not** yet a substitute for:

- **CDK** for breakpoints, overlay dismiss, focus origin, or content observe
- **`@ng-web-apis`** for SSR DI, IntersectionObserver, or Observable/token style
- **ngxtension** for storage, visibility, and inject-style DX
- **VueUse** for depth (GATT, file data types, click-outside capture, idle controls)
- **ng-click-outside2 / ngx-file-drop** for battle-tested UI edge cases

Closing the Observer + media-query + injection/SSR holes would make the hardware breadth usable in production apps that already standardized on signals. Chasing Aria or CDK overlay would be a category error.

---

## Source index (ours)

- `projects/angular-libs/web/package.json` — name, version `0.0.3`, peers `>=18`
- `projects/angular-libs/web/README.md` — advertised surface (matches exports; idle disclaimer is accurate)
- `projects/angular-libs/web/src/public-api.ts` — public barrel
- `projects/angular-libs/web/src/lib/utils/injection.ts` — unused-by-callers helper
- `projects/angular-libs/web/src/lib/directives/*.ts` — click-outside, file-drop
- `projects/angular-libs/web/src/lib/signals/*.ts` — all factories listed above
- Specs: `resize.spec.ts`, `click-outside.directive.spec.ts`, `file-drop.directive.spec.ts`, `bluetooth.spec.ts`, `nfc.spec.ts`, `file-system-access.spec.ts`

## Competitor URLs (canonical)

- Angular CDK layout: https://github.com/angular/components/blob/master/src/cdk/layout/layout.md
- Angular CDK observers: https://next.material.angular.dev/docs-content/api-docs/cdk-observers
- Angular CDK a11y: https://github.com/angular/components/blob/main/src/cdk/a11y/a11y.md
- Angular CDK overlay ref: https://github.com/angular/components/blob/master/src/cdk/overlay/overlay-ref.ts
- Angular Aria: https://angular.dev/guide/aria/overview
- `toSignal`: https://angular.dev/api/core/rxjs-interop/toSignal
- `takeUntilDestroyed`: https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed
- RxJS `fromEvent`: https://rxjs.dev/api/index/function/fromEvent (also https://www.learnrxjs.io/learn-rxjs/operators/creation/fromevent)
- ng-web-apis monorepo: https://github.com/taiga-family/ng-web-apis
- ngxtension: https://ngxtension.dev/
- VueUse functions: https://vueuse.org/functions
- ng-click-outside2: https://github.com/Kr0san89/ng-click-outside
- ngx-file-drop: https://github.com/georgipeltekov/ngx-file-drop
- ngx-viewport-signals: https://github.com/ysndmr/ngx-viewport-signals
- `@ngneat/hotkeys` npm: https://www.npmjs.com/package/@ngneat/hotkeys
- `@ngneat/hotkeys` 4.1.0 service typings: https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/lib/hotkeys.service.d.ts
- `@ngneat/hotkeys` 4.1.0 directive typings: https://cdn.jsdelivr.net/npm/@ngneat/hotkeys@4.1.0/lib/hotkeys.directive.d.ts
  (npm still lists `https://github.com/ngneat/hotkeys`; that URL 404s from this environment, so capabilities were traced from the published package, not the git tree.)
- MDN File System Access: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- MDN Web Bluetooth: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- MDN Idle Detection API: https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API
