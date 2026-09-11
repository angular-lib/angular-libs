# Competitive Research: `@angular-libs/event-bus`

Research only. No library source was changed.

Package under review: [`projects/angular-libs/event-bus`](projects/angular-libs/event-bus) (`@angular-libs/event-bus` **0.2.8**).  
Method: read our public API, plugins, `ng-add`, peers, and README, then compare those **implemented** capabilities to competitor source and official docs. Marketing copy is not treated as evidence.

## Ground truth — what we actually ship

Traced from source, not from README claims.

| Surface | Evidence |
| --- | --- |
| Public API | [`src/public-api.ts`](projects/angular-libs/event-bus/src/public-api.ts) exports `ALEventBus`, `createEventBusHooks`, four plugin factories, and plugin/model **types**. Test helpers are **not** exported. |
| Core bus | [`src/lib/event-bus.ts`](projects/angular-libs/event-bus/src/lib/event-bus.ts): per-key `WritableSignal`, last-value cache (`latest`, `onToSignal`), callback `on` / `once` (no replay), `onToResource`, `combineLatest` / `combineLatestToSignal`, `unsubscribe` / `unsubscribeAll`, `resetEvent` / `resetAllEvents`, reentrancy queue, auto-`DestroyRef` in injection context, dev leak warning, `unsubscribeOn: DestroyRef \| 'manual' \| event key(s)`. |
| Models | [`src/lib/event-bus.models.ts`](projects/angular-libs/event-bus/src/lib/event-bus.models.ts): typed `TEventMap` + `THeaders`, `BusEvent` (`key`, `payload`, `timestamp`, `headers?`), plugin hooks `onInit` / `onBeforeEmit` (cancel or replace payload) / `onAfterEmit` / `onSubscribe` / `onUnsubscribe` / `onReset` / `onDestroy`. `CombineLatestSource.key` is **`string`**, not `keyof TEventMap`. |
| Hooks | `createEventBusHooks()` returns `onEvent`, `onceEvent`, `emitEvent`, `useEventSignal`, `combineEvents`. It does **not** wrap `onToResource` or `combineLatestToSignal`. |
| Plugins | [`logger.plugin.ts`](projects/angular-libs/event-bus/src/lib/plugins/logger.plugin.ts), [`debounce.plugin.ts`](projects/angular-libs/event-bus/src/lib/plugins/debounce.plugin.ts), [`cross-tab-sync.plugin.ts`](projects/angular-libs/event-bus/src/lib/plugins/cross-tab-sync.plugin.ts) (`BroadcastChannel` only), [`history.plugin.ts`](projects/angular-libs/event-bus/src/lib/plugins/history.plugin.ts) (command log, not a multi-key snapshot). `registerPlugin` is **`protected`**. |
| Peers | [`package.json`](projects/angular-libs/event-bus/package.json): `@angular/core >=20.0.0` only. No RxJS peer. `schematics` collection present; **no** `"ng-add": { "save": ... }` field. |
| `ng-add` | [`schematics/ng-add/index.ts`](projects/angular-libs/event-bus/schematics/ng-add/index.ts) writes `AppEventBus` + a stub `AppEventMap` if missing. Does not generate hooks, plugins, tests, or `app.config` providers. |
| README mismatch | README says cleanup via “custom signals”. `SubscriptionOptions.unsubscribeOn` has **no** `Signal` variant ([`event-bus.models.ts`](projects/angular-libs/event-bus/src/lib/event-bus.models.ts)). |

Confirmed **absent** in our TypeScript (not just undocumented): wildcard / pattern keys, `replayLatest` on `on()`, `until` Signal, `onError` callback, event UUID, first-class `Observable` / `on$`, scoped dispatcher, recipient targeting, message TTL, persist plugin, public test helpers, `waitFor` / Promise API, plugin unregister, listener inspection.

---

## A) Competitor inventory (11)

Closest substitutes first. “ngx-event-bus” on npm is not one package: the maintained RxJS bus is **`ng-event-bus`**; the decorator/native-event library is **`on-ngx-event-bus`**. Both are included.

| # | Library | Kind | Why it is in scope | Version / peers (traced) | Weekly npm (approx.) | Sources |
| ---: | --- | --- | --- | --- | ---: | --- |
| 1 | **NgRx Store actions + `@ngrx/effects`** | Flux action bus + RxJS effects | Named competitor. Global `Actions` stream, `createAction` / `createActionGroup`, `ofType`, `createEffect`. Not a last-value-per-key bus. | Current NgRx majors track Angular; RxJS required | Very high (ecosystem) | [Actions](https://ngrx.io/guide/store/actions), [Effects](https://ngrx.io/guide/effects), [createEffect source](https://github.com/ngrx/platform/blob/main/modules/effects/src/effect_creator.ts) |
| 2 | **NgRx SignalStore Events** (`@ngrx/signals/events`) | Signal store + event plugin | Clearly relevant modern NgRx event layer: `event` / `eventGroup`, `withReducer`, `withEventHandlers`, `Dispatcher`, **scoped** `provideDispatcher()`. | NgRx 21+ renamed `withEffects` → `withEventHandlers` | High (with `@ngrx/signals`) | [Official Events guide](https://ngrx.io/guide/signals/signal-store/events), [events.md source](https://github.com/ngrx/platform/blob/main/projects/www/src/app/pages/guide/signals/signal-store/events.md) |
| 3 | **mitt** | Tiny typed emitter | Named competitor. Event-map generics, `on` / `off` / `emit`, `"*"` wildcard. No Angular, no last value. | 3.0.x, zero runtime deps | ~26M | [README](https://github.com/developit/mitt), [types](https://unpkg.com/mitt@3.0.1/index.d.ts) |
| 4 | **`ng-event-bus`** | RxJS Angular message bus | De-facto “ngx-event-bus” on npm. `cast` / `on(pattern)` with `*` and `**` segment wildcards, `MetaData` (`id`, `key`, `data`, `timestamp`). `Subject` → **no replay**. | 11.x for Angular 22; peers aligned per major | ~3k–7k | [npm](https://www.npmjs.com/package/ng-event-bus), [README](https://github.com/cristiammercado/ng-event-bus), [source](https://github.com/cristiammercado/ng-event-bus/blob/master/projects/ng-event-bus/src/lib/ng-event-bus.ts) |
| 5 | **`ngx-signal-hub`** | Signal hub (closest peer) | Same job: signal last-value + callbacks. Adds wildcards, `replayLatest`, `until` (key **or** `Signal`), `onError`, `toSignalMultiple`. No event map, no plugins. | 1.1.1, `@angular/core >17` | ~25 | [npm](https://www.npmjs.com/package/ngx-signal-hub), [published `.mjs`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/fesm2022/ngx-signal-hub.mjs), [`.d.ts`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/lib/signal-hub.service.d.ts) |
| 6 | **`ng-signal-bus`** | Minimal signal bus | Early Signals bus with `*` / `ns:*` matching. Single shared signal (last emit wins globally). `subscribe` creates an `effect` and **returns nothing**. | 0.2.2, Angular ^18 | ~5 | [npm](https://www.npmjs.com/package/ng-signal-bus), [service source](https://github.com/ferdiesletering/ng-signal-bus/blob/main/projects/ng-signal-bus/src/lib/ng-signal-bus.service.ts) |
| 7 | **`on-ngx-event-bus`** (repo `ngx-event-bus-lib`) | Decorator + native events | npm “ngx-event-bus” name collision. `broadcast(new GEvent(...))`, `@Interceptor` + `intercept(this)`, optional **target key**. No DI service, no Signals/RxJS. Claims SSR. | Angular 9+ (badge 21+), npm `on-ngx-event-bus` | Low | [README](https://github.com/orelnatan/ngx-event-bus-lib/blob/master/README.md) |
| 8 | **Angular `output()` + `input()` / `model()` / signals** | Framework parent↔child events | Named competitor. Official replacement for `@Output`/`EventEmitter`. **Not** a global bus. Auto-cleanup. `output()` is **not** a Signal. | Built-in `@angular/core` | N/A | [Outputs guide](https://angular.dev/guide/components/outputs), [`output` API](https://angular.dev/api/core/output), [resource](https://angular.dev/guide/signals/resource) |
| 9 | **Custom RxJS `Subject` / `BehaviorSubject` / `ReplaySubject` bus** | In-house pattern | Named competitor. Full operator graph + `takeUntilDestroyed` + `toSignal`. Types and cleanup are DIY. | App-owned; RxJS ~7.8 in this repo | N/A | [Subject](https://rxjs.dev/guide/subject), [BehaviorSubject](https://rxjs.dev/api/index/class/BehaviorSubject), [ReplaySubject](https://rxjs.dev/api/index/class/ReplaySubject), [`takeUntilDestroyed`](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed) |
| 10 | **`ngx-message-bus`** | Hub / directed messaging | Angular event bus with **virtual hubs**, `recipientIds`, groups, broadcast, configurable callback error policy. Manual `connect` / `disconnect`. | Angular 11+ (legacy majors exist) | Low / stale | [README](https://github.com/7h4r05/ngx-message-bus) |
| 11 | **`ngrx-message-bus`** | Channel + event RxJS bus | Extra Angular bus: typed `TypedChannelEvent`, **ReplaySubject** replay, optional `lifeTimeInSeconds`, module vs **component-scoped** instance. Last publish **4.0.0 (2021)**, peers Angular 11 / RxJS 6. | 4.0.0 | Low / unmaintained | [npm](https://www.npmjs.com/package/ngrx-message-bus), [README](https://github.com/redplane/rx-message-bus) |

**Looked at and not inventoried as primary peers:** `eventemitter3` / `nanoevents` (same class as mitt, less typed DX); legacy `ngx-eventbus` (Angular 7-era). NgRx Store DevTools is cited as a **capability** of #1, not a separate bus.

---

## B) Gap table

“Missing” means **not implemented in our source**. Essentiality is “how much this gap costs `@angular-libs/event-bus` in its own niche” (typed Angular 20+ signal bus), not “how important the feature is to NgRx as a product”.

| Missing feature | Who has it | Essentiality (1–100) | Why |
| --- | ---: | ---: | --- |
| **Wildcard / pattern subscribe** (`*`, `user:*`, `a:**`) | `ng-event-bus` (`*` one segment, `**` rest) ([source](https://github.com/cristiammercado/ng-event-bus/blob/master/projects/ng-event-bus/src/lib/ng-event-bus.ts)); `ngx-signal-hub` (`*` → `[^:]+`) ([`.mjs`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/fesm2022/ngx-signal-hub.mjs)); mitt `"*"` ([README](https://github.com/developit/mitt)); `ng-signal-bus` `*` / `ns:*` ([source](https://github.com/ferdiesletering/ng-signal-bus/blob/main/projects/ng-signal-bus/src/lib/ng-signal-bus.service.ts)) | **86** | Namespaced keys (`user:login`, `error:http`) are our own README style, but `on('user:login')` is exact-key only. Cross-cutting loggers, error sinks, and analytics cannot subscribe once. Closest signal peer already ships this. |
| **Replay last value on callback `on()`** | `ngx-signal-hub` `replayLatest` ([`.d.ts`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/lib/signal-hub.service.d.ts)); RxJS `BehaviorSubject` / `ReplaySubject`; `ngrx-message-bus` switched to `ReplaySubject` ([changelog](https://github.com/redplane/rx-message-bus)); we already cache for `latest` / `onToSignal` | **78** | Late-mounted widgets miss auth/theme/config that already fired. Callers must remember `latest()` + `on()`. `on()` is fire-future-only by construction ([`event-bus.ts` `on()`](projects/angular-libs/event-bus/src/lib/event-bus.ts)). |
| **`combineLatest` keys typed as `keyof TEventMap`** | NgRx `event()` / `ofType(creator)` carry payload types; mitt keys are `keyof Events`. We lose the map at combine time (`CombineLatestSource.key: string`) | **82** | The library’s main pitch is a typed event map. `combineLatestToSignal([{ key: 'typo' }])` compiles. This is a hole in **our** type story, not a missing gimmick. |
| **Reactive `until` / unsubscribe-on-Signal** | `ngx-signal-hub` `until?: string \| Signal \| array` ([`.d.ts`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/lib/signal-hub.service.d.ts)). Our README claims “custom signals”; models do not. | **64** | We already have `unsubscribeOn` event keys and `DestroyRef`. Signal-until is the missing third form and a docs bug. |
| **Per-subscription `onError`** | `ngx-signal-hub` `onError`; `ngx-message-bus` `ErrorHandlingEnum` (None / Throw / Log) ([README](https://github.com/7h4r05/ngx-message-bus)). We `console.error` and swallow. | **61** | Isolated errors are good; apps cannot route failures to telemetry or fail tests without patching `console`. |
| **First-class RxJS `Observable` (`on$`)** | `ng-event-bus.on()` returns `Observable<MetaData<T>>`; NgRx `Actions` / `Events.on()`; custom Subject buses; our README shows an **app-level** `on$` snippet only | **68** | Many Angular codebases still compose `switchMap` / `exhaustMap` / router events. Without a published interop helper, teams stay on `ng-event-bus` or a Subject. Keeping the **core** RxJS-free is still a valid differentiator. |
| **Hierarchical / scoped dispatcher** | NgRx Events `provideDispatcher()` + `self` / `parent` / `global` ([events.md](https://github.com/ngrx/platform/blob/main/projects/www/src/app/pages/guide/signals/signal-store/events.md)); `ngrx-message-bus` component-scoped provider; `ngx-message-bus` hubs | **57** | Root-only `providedIn: 'root'` subclasses can fake isolation, but events still do not nest. Microfrontends and feature-local buses need this. |
| **Wildcard / multi-key signal view** | `ngx-signal-hub.toSignalMultiple(keys, { sortBy })` ([`.d.ts`](https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/lib/signal-hub.service.d.ts)) | **63** | `combineLatestToSignal` requires a closed list and waits for **all** keys. A “latest matching `user:*`” signal is a different, useful query. |
| **Unique event id on the envelope** | `ng-event-bus` `MetaData.id` UUID ([meta-data.ts](https://github.com/cristiammercado/ng-event-bus/blob/master/projects/ng-event-bus/src/lib/meta-data.ts)). We have `timestamp` only. | **44** | Deduping cross-tab echoes, tracing, and “did I already handle this emit?” need an id. Headers can DIY this today. |
| **Action / event creator functions** | NgRx `createAction` / `event` / `eventGroup` ([Actions](https://ngrx.io/guide/store/actions), [Events](https://ngrx.io/guide/signals/signal-store/events)); `on-ngx-event-bus` subclassed `GEvent` | **48** | String keys typo-check only if you stay inside `TEventMap`. Creators give rename-safe refs and `[Source] name` grouping. Lower priority because the map already covers the common case. |
| **DevTools / inspectable timeline** | `@ngrx/store-devtools` ([guide](https://ngrx.io/guide/store-devtools)). Our `historyPlugin` is undo/redo re-emit, not an inspector; `loggerPlugin` is `console.groupCollapsed`. | **52** | Teams compare buses to NgRx on “can I see what fired?” Console groups do not replace a time-travel UI. |
| **Targeted recipients / directed send** | `ngx-message-bus` `recipientIds` + `groupId` ([README](https://github.com/7h4r05/ngx-message-bus)); `on-ngx-event-bus` broadcast `key` filter ([README](https://github.com/orelnatan/ngx-event-bus-lib/blob/master/README.md)) | **36** | Useful for multi-instance widgets. Most ALEventBus apps want broadcast-by-type, which we have. |
| **Message TTL** | `ngrx-message-bus` `lifeTimeInSeconds` ([README](https://github.com/redplane/rx-message-bus)) | **28** | Last-value cache can go stale (logout, session). We have `resetEvent`; TTL is a convenience, not a category-definer. |
| **Public test helpers / testing API** | NgRx has `provideMockStore` / `provideMockActions`. Our helpers are `@internal` and omitted from `public-api.ts`. | **58** | Root services retain last payloads across tests; README already tells users to `resetAllEvents()`. A public harness would reduce foot-guns. |
| **`waitFor` / Promise of next event** | RxJS `firstValueFrom(bus.on$(key).pipe(take(1)))`; NgRx effects. We have `once()` callbacks only. | **41** | Nice for tests and one-shot init. `once` + wrapping Promise is a few lines. |
| **Persist / storage plugin** | Not standard on small buses; NgRx has meta-reducers / runtime checks. We have no `localStorage` plugin. | **33** | Events are often ephemeral. Persist belongs in `@angular-libs/store`, not every bus. |
| **Cross-tab fallback when `BroadcastChannel` is missing** | Our plugin no-ops without `window.BroadcastChannel` ([cross-tab-sync.plugin.ts](projects/angular-libs/event-bus/src/lib/plugins/cross-tab-sync.plugin.ts)). Common pattern elsewhere: `storage` events. | **39** | Safari / older WebViews / some iframes. Real but narrow. |
| **Runtime plugin register / unregister** | `registerPlugin` is `protected` ([event-bus.ts](projects/angular-libs/event-bus/src/lib/event-bus.ts)). No unregister. | **46** | Forces a subclass constructor. Tests and lazy features cannot attach a logger without extending the class. |
| **`createEventBusHooks` coverage** | Hooks omit `onToResource` and `combineLatestToSignal` ([event-bus.ts](projects/angular-libs/event-bus/src/lib/event-bus.ts) `createEventBusHooks`) | **50** | The hook layer is the advertised low-boilerplate path; async Resource is a headline feature but is class-API-only. |
| **`ng-add` completeness** | Schematic only scaffolds two files ([ng-add/index.ts](projects/angular-libs/event-bus/schematics/ng-add/index.ts)). No hooks file, no plugin wiring, no `"ng-add": { "save" }` in package.json. `ng-event-bus` documents `providers: [NgEventBus]` instead. | **40** | `ng add` is a differentiator we already have; the generated stub does not show plugins or hooks. |
| **All-actions stream / `ofType` many** | NgRx `Actions` + `ofType(a, b, c)` ([effects](https://ngrx.io/guide/effects)) | **47** | Wildcard subscribe is the bus-shaped version of this. A typed `onMany(['a','b'])` would close part of the gap without RxJS. |
| **Same-payload signal notifications** | `ngx-signal-hub.toSignal` returns the **envelope** (`key`, `data`, `timestamp`), so a new timestamp always changes the computed. Our `onToSignal` returns the **payload**; Angular `Object.is` can skip `'dark'` → `'dark'`. Callbacks still fire. | **55** | Retriggering a resource or template on a repeated primitive is a real Signals foot-gun. Document or offer `{ emitDuplicates: true }` / envelope signal. |
| **Angular major compatibility matrix** | `ng-event-bus` publishes a major-per-Angular table through v22 ([README](https://github.com/cristiammercado/ng-event-bus)). We peer `@angular/core >=20` only. | **34** | Correct for a Signals/Resource library. Hurts only teams stuck on 17–19 (they already have `ngx-signal-hub`). |
| **Handler-ref `off(type, handler)` + inspectable map** | mitt `off` / `all` ([README](https://github.com/developit/mitt)) | **30** | We return an unsubscribe closure and can `unsubscribe(key)` all listeners. Handler identity is rarely needed in Angular DI code. |

---

## C) Parity table

Scores: **100** = complete, idiomatic, hard to misuse in this domain. **0** = absent. Competitor score is the **best** implementation among the libraries that actually play in that row (named in Notes).

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
| --- | --- | --- | ---: | ---: | --- |
| Typed event catalog | `class AppBus extends ALEventBus<AppEventMap, Headers>` — emit/on/latest constrained by the map | mitt `mitt<Events>()`; NgRx `createAction`/`event()`; `ng-event-bus` **per-call** generic `on<T>(key)` (community article exists to wrap it); `ngx-signal-hub` per-call `on<T>()` | **92** | **88** (mitt / NgRx creators) | We win on “one map on the injectable”. We lose on combine-latest key typing (see gaps). |
| Last-value / replay for state | Per-key signal; `latest`; `onToSignal({ defaultValue, transform })` | `BehaviorSubject`; `ngx-signal-hub` registry + `toSignal` / `replayLatest`; `ng-event-bus` **explicitly no replay** ([README](https://github.com/cristiammercado/ng-event-bus)); mitt none | **90** | **86** (`ngx-signal-hub` / BehaviorSubject) | We are strong here. Callback path does not replay. |
| Callback subscribe + cleanup | Auto-`inject(DestroyRef)`, leak warning, `unsubscribeOn` keys / `'manual'`, returned unsub | `ngx-signal-hub` requires passing `destroyRef`; `ng-event-bus` + `takeUntilDestroyed`; mitt no lifecycle; `ng-signal-bus` **leaks effects** | **93** | **80** (`takeUntilDestroyed` / hub `destroyRef`) | Auto-context cleanup is a real DX win. |
| One-shot listener | `once()` | `ngx-signal-hub.once`; RxJS `take(1)`; mitt DIY | **88** | **85** | Comparable. Hub can also `replayLatest` on once. |
| Combine latest | `combineLatest` + `combineLatestToSignal` (wait until **all** have emitted) | RxJS `combineLatest`; hub `onCombineLatest` + `sortBy`; NgRx `concatLatestFrom` | **84** | **90** (RxJS) | We match the operator semantics. Untyped keys and no sort/wildcard keep us behind RxJS/hub. |
| Async follow-up (HTTP) | `onToResource` → Angular `resource()` (`value`, `isLoading`, `error`, `AbortSignal`) | NgRx `createEffect` / `withEventHandlers` + `switchMap`; RxJS `switchMap`; Angular `resource` used **beside** a bus | **91** | **94** (NgRx effects) | Unique among small buses. NgRx still wins on cancellation strategies (`exhaustMap`, retries, `mapResponse`). |
| Plugin / middleware | `ALEventBusPlugin` with cancel/replace, isolated try/catch, `onReset` | NgRx meta-reducers / effect isolation; others: none | **90** | **70** (NgRx, different shape) | Built-in logger, debounce, cross-tab, history are unmatched in this peer set. |
| Cross-tab sync | `crossTabSyncPlugin` via `BroadcastChannel`, ping-pong guards, reset sync | Usually DIY; not in mitt / ng-event-bus / hub | **86** | **20** | Clear win. No `storage` fallback. |
| Debounce at the bus | `debouncePlugin` cancels emit, re-emits later | RxJS `debounceTime`; NgRx effects | **80** | **92** (RxJS) | Emit-side debounce is convenient. Operators are more composable (leading/trailing, throttle, audit). |
| Undo / history | `historyPlugin` command stack; undo needs **>1** entry ([spec](projects/angular-libs/event-bus/src/lib/plugins/history.plugin.spec.ts)) | NgRx DevTools time travel (state); nothing else in the bus set | **72** | **95** (Store DevTools, for **state**) | Honest: we re-emit a prior command, we do not snapshot the whole map. Docs already say this. |
| Headers / tracing metadata | Second generic `THeaders` + `emit(key, payload, { headers })` with **fixed arity** | NgRx action props; `ng-event-bus` no headers; hub no headers | **90** | **75** (NgRx props) | Fixed argument positions avoid `{ headers }` payload bugs ([spec](projects/angular-libs/event-bus/src/lib/event-bus.spec.ts)). |
| Wildcard subscribe | None | See gap table | **5** | **92** (`ng-event-bus` `*`/`**`) | Largest functional miss vs the popular Angular bus. |
| Pattern-aware signals | None | `toSignalMultiple` | **10** | **80** | — |
| Global vs directed messaging | Broadcast by key only | Hubs / recipient ids / interceptor keys | **70** | **88** (`ngx-message-bus`) | Broadcast is the right default; directed send is a specialty. |
| Parent–child UI events | Out of scope (use `output()`) | `output()` / `@Output` | **15** | **98** (Angular) | Do not compete here. README should say so. |
| Operator ecosystem | Documented DIY `on$` | Native Observables | **35** | **96** (RxJS / NgRx) | Intentional tradeoff. Score reflects **interop**, not core quality. |
| Bundle / deps | `tslib` + `@angular/core` only | mitt ~200b; hub same peer style; NgRx + RxJS heavy; `ng-event-bus` RxJS | **94** | **98** (mitt) | We are correctly “Angular-native, RxJS-free”. |
| Install / scaffold | `ng add` stub service + map | Most: `npm i` + provide; NgRx schematics are richer | **62** | **75** (NgRx schematics) | We have the hook; content is thin. |
| Docs vs source honesty | Strong API comments; README overclaims signal-`unsubscribeOn` | `ng-event-bus` README matches `Subject` no-replay | **74** | **90** (`ng-event-bus`) | Fix README regardless of features. |
| Maintenance / adoption | 0.2.8, ~50 weekly, Angular 20+ | `ng-event-bus` multi-year + version matrix; mitt ubiquitous; hub/signal-bus tiny | **48** | **93** (`ng-event-bus` / mitt) | Adoption is the market gap, not an API gap. |
| Reentrancy / nested emit | Queue while `isEmitting` | mitt/hub recurse; NgRx store is synchronous reduce | **88** | **55** | Quiet reliability win. Cite in docs. |
| Leak detection | Dev-mode warning if no `DestroyRef` and no strategy | Others silent | **90** | **40** | Keep this. |

---

## D) Improvement backlog

Priority is “do this next for this package”, not calendar effort. No implementation in this PR.

| Improvement | Priority (1–100) | Rationale |
| --- | ---: | --- |
| **Wildcard / prefix subscribe** (`*`, `user:*`, optional `**`) on `on`, `once`, and a `toSignalMany` / `onToSignal` variant, typed as a union of matching map keys where possible | **90** | Closes the #1 reason teams pick `ng-event-bus` or `ngx-signal-hub` over us. Fits our existing `user:login` key style. Must not break exact-key typing. |
| **Type `CombineLatestSource.key` as `keyof TEventMap`** (and infer payload from the map) | **88** | Pure correctness of the product promise. No new runtime. Highest ROI type fix. |
| **`replayLatest?: boolean` on `on` / `once` / hooks** | **84** | Cache already exists. Late subscribers are the classic bus foot-gun. Default `false` preserves current semantics. |
| **Fix README**: remove “custom signals” cleanup claim; document `on()` no-replay; document history = command log; align npm “Angular 18+” vs peer `>=20` | **83** | Trust. Costs nothing in runtime. Current copy is false vs [`SubscriptionOptions`](projects/angular-libs/event-bus/src/lib/event-bus.models.ts). |
| **Optional first-class `on$()` in the package** (subpath or `rxjs-interop` entry) so core stays RxJS-free | **76** | README already tells users to copy 15 lines. Shipping it removes the last excuse to stay on `ng-event-bus` for operator pipelines. |
| **`unsubscribeOn` accept `Signal<boolean>`** (match hub `until`, make README true) | **72** | Completes the cleanup story next to DestroyRef and terminator events. |
| **Envelope signal / `emitDuplicates` for `onToSignal`** so repeated primitives still notify | **70** | Signals `Object.is` + payload-only computed is a silent bug for “refresh” events. Hub avoids it by exposing `{ timestamp }`. |
| **`onError` on subscriptions** (and keep default `console.error`) | **66** | Parity with hub + testability. Plugin isolation already proves the pattern. |
| **`onMany` / typed multi-key `on`** as a stepping stone if full wildcards slip | **65** | Covers analytics “listen to these five keys” without regex. |
| **Public testing utilities** (`reset` recipe, fake clock, plugin spies) exported from `@angular-libs/event-bus/testing` | **63** | Helpers already exist and are marked not-public. Root singleton + last-value **will** leak across specs. |
| **`createEventBusHooks`: add `useEventResource` + `useCombineLatestSignal`** | **60** | Headline APIs should appear on the hook object we tell AI agents to use. |
| **`registerPlugin` public (or `provideEventBus({ plugins })`) + `unregisterPlugin`** | **58** | Enables lazy logger/devtools and tests without a subclass. Keep subclass pattern as the documented default. |
| **Richer `ng-add`**: generate hooks file, optional plugin stubs, `ng-add.save` metadata | **54** | We already own `ng add`. The stub should look like the README “getting started”, not a login-only map. |
| **Event id on `BusEvent`** (`crypto.randomUUID` with fallback) | **50** | Helps cross-tab dedupe and tracing without forcing headers. |
| **Document (not build) when *not* to use the bus**: use `output()` for parent→child; use NgRx/store for domain state | **49** | Stops losing bake-offs for the wrong job. Angular outputs are not a missing feature. |
| **DevTools-lite plugin** (in-memory ring buffer + optional `window` hook) | **47** | Cheaper than Redux DevTools; addresses “what fired?” vs `loggerPlugin` only. |
| **`waitFor(key, { timeout, predicate }) => Promise<BusEvent>`** | **43** | Tests and bootstrap. Thin wrapper over `once`. |
| **`localStorage` fallback for `crossTabSyncPlugin`** | **38** | Only if BroadcastChannel support tickets appear. |
| **Throttle / leading-edge debounce options** | **36** | RxJS already covers this via documented `on$`. Plugin creep is optional. |
| **Recipient / instance targeting** | **22** | `ngx-message-bus` specialty. Out of niche unless we see demand. |
| **Message TTL** | **18** | Prefer explicit `resetEvent` on logout. |
| **Lower peer to Angular 17/18** | **15** | Conflicts with `resource()` / current peer. Do not chase `ng-event-bus`’s old majors. |
| **mitt-style `off(handler)` / expose subscriber `Map`** | **12** | Unsubscribe closures are enough. |

---

## Positioning (for backlog, not a feature list)

`@angular-libs/event-bus` is already ahead of other **Angular signal buses** on: event-map typing, headers, Resource mapping, plugin lifecycle (including cancel/replace and error isolation), reentrancy, auto-DestroyRef, leak warnings, `ng-add`, and the four shipped plugins.

It is behind **`ng-event-bus`** on wildcards, unique ids, Observable interop, and adoption.  
It is behind **`ngx-signal-hub`** on wildcards, `replayLatest`, Signal-`until`, `onError`, and multi-key signals.  
It is not a substitute for **NgRx** (state + DevTools + effect operators + scoped Flux) or for **`output()`** (parent–child).

Highest-leverage work is **pattern matching + replay-on-subscribe + combineLatest key typing + honest docs**, not more plugins.

---

## Source index

### Ours (this repo)

- [`projects/angular-libs/event-bus/src/public-api.ts`](projects/angular-libs/event-bus/src/public-api.ts)
- [`projects/angular-libs/event-bus/src/lib/event-bus.ts`](projects/angular-libs/event-bus/src/lib/event-bus.ts)
- [`projects/angular-libs/event-bus/src/lib/event-bus.models.ts`](projects/angular-libs/event-bus/src/lib/event-bus.models.ts)
- [`projects/angular-libs/event-bus/src/lib/event-bus.spec.ts`](projects/angular-libs/event-bus/src/lib/event-bus.spec.ts)
- [`projects/angular-libs/event-bus/src/lib/plugins/*`](projects/angular-libs/event-bus/src/lib/plugins)
- [`projects/angular-libs/event-bus/package.json`](projects/angular-libs/event-bus/package.json)
- [`projects/angular-libs/event-bus/README.md`](projects/angular-libs/event-bus/README.md)
- [`projects/angular-libs/event-bus/schematics/ng-add/index.ts`](projects/angular-libs/event-bus/schematics/ng-add/index.ts)
- npm: https://www.npmjs.com/package/@angular-libs/event-bus

### Competitors

- NgRx Actions: https://ngrx.io/guide/store/actions  
- NgRx Effects: https://ngrx.io/guide/effects  
- NgRx Store DevTools: https://ngrx.io/guide/store-devtools  
- NgRx SignalStore Events: https://ngrx.io/guide/signals/signal-store/events  
- NgRx Events markdown: https://github.com/ngrx/platform/blob/main/projects/www/src/app/pages/guide/signals/signal-store/events.md  
- mitt: https://github.com/developit/mitt  
- ng-event-bus: https://github.com/cristiammercado/ng-event-bus · https://www.npmjs.com/package/ng-event-bus  
- ngx-signal-hub: https://www.npmjs.com/package/ngx-signal-hub · https://cdn.jsdelivr.net/npm/ngx-signal-hub@1.1.1/fesm2022/ngx-signal-hub.mjs  
- ng-signal-bus: https://github.com/ferdiesletering/ng-signal-bus  
- on-ngx-event-bus: https://github.com/orelnatan/ngx-event-bus-lib  
- Angular outputs: https://angular.dev/guide/components/outputs  
- Angular `resource`: https://angular.dev/guide/signals/resource  
- `takeUntilDestroyed`: https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed  
- RxJS Subject family: https://rxjs.dev/guide/subject  
- ngx-message-bus: https://github.com/7h4r05/ngx-message-bus  
- ngrx-message-bus: https://github.com/redplane/rx-message-bus · https://www.npmjs.com/package/ngrx-message-bus  
