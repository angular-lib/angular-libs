# Competitive research: `@angular-libs/store`

Research only. No library source was changed.

| Field | Value |
| --- | --- |
| Package | `@angular-libs/store` `0.3.3` |
| Scope | This package only. Other monorepo packages were skipped. |
| Our source root | `projects/angular-libs/store` |
| Date | 2026-09-11 |
| Method | Trace our public API and plugins in source, then compare to competitor docs and published typings. Marketing copy is not treated as capability. |

**Scoring.** Essentiality and scores are 1–100 judgments for an Angular **client-state** library that already ships plugins. Higher essentiality means “users who pick a store instead of raw signals will notice this gap.” TanStack Query is scored as a **server-state** specialist, not as a failed client store.

**Do not over-claim.** `@angular-libs/store` already ships persist, IndexedDB, history, entity CRUD, Angular `resource` / `rxResource` adapters, BroadcastChannel sync, and a plugin hook contract. Several “gaps” are depth/quality gaps, not missing product areas.

---

## What we actually ship (source map)

Public barrels:

- Core: `projects/angular-libs/store/src/public-api.ts` — `ALStore`, `entityPlugin`, `resourcePlugin`, `historyPlugin`, `persistPlugin`, `indexedDBPlugin`, plus interfaces.
- RxJS entry: `projects/angular-libs/store/rxjs-interop/src/public-api.ts` — `rxResourcePlugin` only.

Peers (`projects/angular-libs/store/package.json`): `@angular/core` and `@angular/common` `>=20.0.0`. `rxjs` `>=7.4.0` is **optional**. That Angular floor matches `resource({ params })` (see also `PRODUCTION-NOTES.md`).

### Core `ALStore`

Class: `projects/angular-libs/store/src/lib/al-store.ts`. Contract: `projects/angular-libs/store/src/lib/interfaces/ial-store.ts`.

| Capability | Shipped? | Evidence |
| --- | --- | --- |
| Per-key `get` / `getSignal` / `set` / `update` | Yes | `IALStore` |
| `patchState(partial \| updater)` | Yes | Sequential per-key `internalSet` / `internalReset` |
| `select(projector)` | Yes | `computed` + proxy; **also reads every known key** before the projector so `in` / `Object.keys` / spread stay reactive |
| `snapshot()` / `reset(key?)` | Yes | Shallow snapshot; `set(key, undefined)` becomes `reset(key)` |
| Cross-tab via `syncChannel` | Yes | `BroadcastChannel`; `SyncMessage` `set` / `reset` / `patchState` |
| Structured-clone guard on broadcast | Yes | `safePostMessage` catches and warns in dev; local write is kept |
| Plugin registry | Yes | `registerPlugin` → `onInit` immediately; `onInit` is **not awaited** |
| Plugin intercept | Yes | `onBeforeUpdate` can replace the committed value; errors isolated |
| Plugin teardown | Yes | `DestroyRef.onDestroy` → `runOnDestroy`; persist/IDB also close via their own `DestroyRef` |
| Immutability enforcement | No | Docs require new references; no freeze / mutation throw |
| Actions / events / effects | No | Imperative methods only |
| DevTools / logger | No | Not in public API |
| SSR TransferState | No | Persist/IDB no-op or fail-soft off-browser |

`select()` implementation note (important for parity): README says “Prefer reading properties you need so signal dependencies stay precise.” Source always touches every known key first (`al-store.ts` `select()`), so a selector on `state.theme` still re-runs when `users` changes.

### Plugins (real APIs)

**`entityPlugin`** — `projects/angular-libs/store/src/lib/plugins/entity.plugin.ts`

- State shape: **plain array** on one store key. Lookups use `findIndex` / `some` (O(n)).
- Reads: `state` / `all` (same signal), `total`.
- Writes: `addOne` / `addMany` (skip existing ids), `setOne` / `setMany` / `setAll`, `updateOne` / `updateMany`, `upsertOne` / `upsertMany`, `removeOne` / `removeMany`, `remove(predicate)`, `removeAll`.
- Options: `idField`, `selectId`, `sortComparer`.
- Missing vs NgRx/Elf: `entityMap`, `ids`, `selectEntity(id)`, `hasEntity`, named collections as a first-class map, `prepend*`, `updateAllEntities`, `updateEntities({ predicate })`.
- Dev warning when resolved id is `null`/`undefined` (once).

**`persistPlugin`** — `projects/angular-libs/store/src/lib/plugins/persist.plugin.ts`

- Keys: explicit list or `'all'` (resolved from `snapshot()` at `onInit`).
- Engine: sync Web `Storage` (`localStorage` default). **JSON.parse / JSON.stringify only.**
- Hydration: sync `getItem` → `store.set`; wrapped in `beginStoreHydration` / `endStoreHydration`.
- Cross-tab: `BroadcastChannel` `al-persist:${prefix}` (default `broadcast: true`), including when the engine is `sessionStorage`.
- No migrations, no custom serialize, no debounce, no `isReady`, no async `StateStorage`.

**`indexedDBPlugin`** — `projects/angular-libs/store/src/lib/plugins/indexeddb.plugin.ts`

- Async open + `get`/`put`/`delete` on one object store. Values are IDB structured clones (Maps/Sets/Dates work; functions do not).
- `isReady` signal. Fail-soft to in-memory if open fails.
- Race guard: keys written before hydration completes are marked dirty and **not** overwritten by stale IDB values.
- Persisted `null` hydrates; missing key (`undefined`) does not.
- Cross-tab: `BroadcastChannel` `al-idb:${dbName}:${storeName}`.
- `version` only creates the object store on upgrade. No document-schema migrations.

**`historyPlugin`** — `projects/angular-libs/store/src/lib/plugins/history.plugin.ts`

- Per **one key**. Default `limit` 50. `undo` / `redo` / `canUndo` / `canRedo` / `clearHistory`.
- Snapshots via `structuredClone`, fallback to same reference + dev warning.
- Equality via `JSON.stringify` (expensive; wrong for `Map`/`Set`/key order).
- Skips persist/IDB hydration (`isStoreHydrating`) and optional `isReady`.
- New user write clears the redo stack. No pause, jump, or custom comparator.

**`resourcePlugin`** — `projects/angular-libs/store/src/lib/plugins/resource.plugin.ts`

- Wraps Angular `resource({ params, loader, injector })`.
- On **success**, `store.set(key, result)`. Errors stay on `ResourceRef`, not on the store key.
- Exposes `resource`, `value` (store signal), `isLoading`, `reload`.
- No `resource.destroy()` on store destroy (`PRODUCTION-NOTES.md`). Fine for `providedIn: 'root'`; leak risk if the store is component-scoped.
- No query key, cache, staleTime, retry, prefetch, optimistic update, or dedupe across stores.

**`rxResourcePlugin`** — `projects/angular-libs/store/rxjs-interop/src/lib/plugins/rx-resource.plugin.ts`

- Same shape, `rxResource` + `tap` to `store.set`. Optional peer keeps core RxJS-free.

**Not shipped.** `OFFLINE_SQLITE_PLAN.md` is explicit: SQLite WASM + socket outbox is deferred. Prefer IDB/persist until a real app needs relational offline sync.

---

## A) Competitor inventory (10 libraries)

| # | Library | Role vs us | Why it is in this set | Status / peers | Official entry |
| --- | --- | --- | --- | --- | --- |
| 1 | `@ngrx/signals` SignalStore | Primary client-store peer. Same “signal store” category our README names. | Functional `signalStore` + `withState` / `withComputed` / `withMethods` / `withHooks` / `withProps` / `withLinkedState`. Nested state signals. Official `withEntities` (`entityMap` + `ids` + `entities`). `rxMethod`, events plugin, `watchState` / `getState`. **No first-party persist, undo, IndexedDB, or DevTools.** | Active. Latest `22.0.1` (npm 2026-09-10). Peer `@angular/core` `^22.0.0` on that latest line; older majors exist. ~264k weekly downloads. | [SignalStore](https://ngrx.io/guide/signals/signal-store), [entities](https://ngrx.io/guide/signals/signal-store/entity-management), [rxjs-integration](https://ngrx.io/guide/signals/rxjs-integration), [linked state](https://ngrx.io/guide/signals/signal-store/linked-state), [state tracking](https://ngrx.io/guide/signals/signal-store/state-tracking), [source](https://github.com/ngrx/platform/blob/main/modules/signals/src/signal-store.ts), [entities typings](https://www.npmjs.com/package/@ngrx/signals) |
| 2 | NgRx Toolkit (`@angular-architects/ngrx-toolkit` / `@ngrx-toolkit/core`) | Companion that fills SignalStore holes we already cover in-core. | `withStorageSync` (local/session + `withIndexedDB`), `withUndoRedo`, `withDevtools`, `withCallState`, `withDataService`, `withResource` / `withEntityResources`. Treat as the real persist/undo/devtools competitor for SignalStore users. | Active. Docs at ngrx-toolkit.angulararchitects.io. v22 publishes as `@ngrx-toolkit/core`. | [Toolkit home](https://ngrx-toolkit.angulararchitects.io/), [withStorageSync](https://ngrx-toolkit.angulararchitects.io/docs/with-storage-sync), [withUndoRedo](https://ngrx-toolkit.angulararchitects.io/docs/with-undo-redo), [GitHub](https://github.com/angular-architects/ngrx-toolkit) |
| 3 | Elf (`@ngneat/elf` + feature packages) | Modular RxJS store; Akita’s successor. | `withEntities` + `selectEntity` / `hasEntity` / UI entities / active. `persistState` with **async** `StateStorage`. `stateHistory` (undo/redo/**jump**/**pause**). Pagination, request status/cache, DevTools, CLI. Framework-agnostic. | Last core publish 2024-08-06 (`2.5.1`). Still widely used (~46k weekly on `@ngneat/elf`). RxJS required. | [npm / docs pointer](https://www.npmjs.com/package/@ngneat/elf), [persist typings](https://www.npmjs.com/package/@ngneat/elf-persist-state) (`StateStorage` async), [entities typings](https://www.npmjs.com/package/@ngneat/elf-entities), [history typings](https://www.npmjs.com/package/@ngneat/elf-state-history), [docs site](https://ngneat.github.io/elf/) |
| 4 | Akita (`@datorama/akita`) | Historical OOP entity-store ancestor of our class style. | `EntityStore` + `QueryEntity` (normalized `entities`/`ids`, active, loading/error). `persistState` with custom serialize, include/select, **async storage (localForage/IDB)**, debounce via `preStorageUpdateOperator`, `selectPersistStateInit`. DevTools, pagination, dirty-check, `NgEntityService`. | **Archived. README: do not use; migrate to Elf.** | [GitHub](https://github.com/salesforce/akita), [EntityStore](https://opensource.salesforce.com/akita/docs/entities/entity-store/), [persistState](https://opensource.salesforce.com/akita/docs/enhancers/persist-state/) |
| 5 | NGXS (`@ngxs/store`) | CQRS/Redux-style Angular store with a plugin ecosystem. | `@State` + `@Action`. `select` / `selectSignal` / `selectSnapshot`. `@ngxs/storage-plugin` (migrations, serialize hooks, per-key engines, feature `withStorageFeature`). Logger, Redux DevTools, WebSocket-as-actions, forms plugin. Entity is **labs**, not core (`@ngxs-labs/entity-state`). | Active. Latest line `22.0.0` (2026). Angular-first. | [NGXS](https://www.ngxs.io/), [select / selectSignal](https://www.ngxs.io/concepts/select), [storage](https://www.ngxs.io/plugins/storage), [devtools](https://www.ngxs.io/plugins/devtools), [logger](https://www.ngxs.io/plugins/logger), [websocket](https://www.ngxs.io/plugins/websocket), [forms](https://www.ngxs.io/plugins/form), [entity-state labs](https://github.com/ngxs-labs/entity-state) |
| 6 | NgRx ComponentStore (`@ngrx/component-store`) | Local/component store; our OOP closest NgRx relative. | `setState` / `patchState` / `updater` / `select` / `selectSignal` / `effect`. Lifecycle `OnStoreInit` / `OnStateInit`. `destroy$`. **No persist, entity, history, or cross-tab.** | Active, maintenance-mode relative to SignalStore (NgRx now recommends SignalStore for new apps). RxJS required. | [Guide](https://ngrx.io/guide/component-store), [source](https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts) |
| 7 | TanStack Query Angular (`@tanstack/angular-query-experimental`) | Server-state cache, not a general client store. | `injectQuery` / `injectMutation` / `injectInfiniteQuery`. staleTime, gcTime, retry, structural sharing, refetch on focus/reconnect, optimistic mutations, dehydrate/hydrate, persist + `resumePausedMutations`, DevTools. Angular `>=16`. **Experimental: breaking changes in minor/patch.** | Active. `5.102.8`. Complementary, not a drop-in store. | [Overview](https://tanstack.com/query/latest/docs/framework/angular/overview), [defaults](https://tanstack.com/query/latest/docs/framework/angular/guides/important-defaults), [mutations](https://tanstack.com/query/latest/docs/framework/angular/guides/mutations) |
| 8 | MiniRx Signal Store (`@mini-rx/signal-store`) | Redux + FeatureStore + ComponentStore on Signals. | Global reducers, `FeatureStore` / component store, `rxEffect`, `connect`, Redux DevTools, `UndoExtension` (undo **a named action**, not a stack UI), `ImmutableStateExtension`. **No first-party entity adapter or persist plugin** in the Signal Store README. | Active niche. Angular-only Signal port of MiniRx. | [README](https://github.com/spierala/mini-rx-store/blob/master/libs/signal-store/README.md), [RFC](https://github.com/mini-rx/mini-rx/discussions/188) |
| 9 | `@rx-angular/state` | Component-local reactive state. | `rxState` / `RxState`: `set`, `connect` (Observable or Signal), `select`, `signal(key)`, `computed`. Auto unsubscribe. **No persist, entity, history, DevTools, or cross-tab.** | Active. Pairs with `@rx-angular/template`. | [README](https://github.com/rx-angular/rx-angular/blob/main/libs/state/README.md), [docs](https://rx-angular.io/docs/state/setup), [API](https://rx-angular.io/docs/state/api) |
| 10 | `@ngrx/store` + `@ngrx/entity` + `@ngrx/effects` + `@ngrx/store-devtools` | Full Redux stack. Included because teams still compare “NgRx” as one product. | Actions, reducers, effects, router-store, entity adapter (normalized), runtime checks, DevTools time-travel. Heavy vs `ALStore`. | Active. Same org as SignalStore; SignalStore is the recommended *local* store. | [NgRx store](https://ngrx.io/guide/store), [entity](https://ngrx.io/guide/entity), [effects](https://ngrx.io/guide/effects), [devtools](https://ngrx.io/guide/store-devtools) |

**Considered and not listed as a 11th row:** raw Angular `resource` / `linkedSignal` (primitives we wrap, not a store); `ngx-signal-state` (smaller overlap than SignalStore + RxAngular).

### Positioning snapshot

| Library | Client state | Server/async cache | Persist | History | Entities | Cross-tab | DevTools |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **@angular-libs/store** | Yes (OOP signals) | Thin `resource` adapter | Yes (JSON Storage + IDB) | Yes (per key) | Yes (array) | Yes (BroadcastChannel) | No |
| SignalStore | Yes (functional) | `rxMethod` / toolkit `withResource` | Toolkit only | Toolkit only | Yes (normalized) | No first-party | Toolkit only |
| Elf | Yes (RxJS) | Requests package | Yes (async storage) | Yes (jump/pause) | Yes (normalized + queries) | Storage-dependent | Yes |
| Akita | Yes (archived) | NgEntityService | Yes (async + debounce) | Plugin | Yes (normalized) | Storage-dependent | Yes |
| NGXS | Yes (CQRS) | App-authored actions | Yes (migrations) | Via DevTools | Labs package | Storage-dependent | Yes |
| ComponentStore | Local only | `effect` | No | No | No | No | No |
| TanStack Query | No (cache only) | **Best in set** | Query/mutation persist | No | No | Cache persist | Yes |
| MiniRx Signal | Yes (Redux/FS) | `rxEffect` | No first-party | Undo-last-action | No first-party | No | Yes |
| RxAngular State | Local only | `connect` streams | No | No | No | No | No |
| NgRx Store | Global Redux | Effects | Community | DevTools | `@ngrx/entity` | Community | Yes |

Our npm footprint is tiny (~29 weekly downloads on 2026-07-27 publish) versus SignalStore/NGXS/Elf. That is adoption, not API quality.

---

## B) Gap table

Missing = not in our public API / shipped plugins after reading source. “Who has it” lists **verified** owners.

| Missing feature | Who has it | Essentiality (1–100) | Why |
| --- | --- | --- | --- |
| Normalized `entityMap` + `ids` and O(1) `getEntity` / `hasEntity` | SignalStore `withEntities` ([typings](https://cdn.jsdelivr.net/npm/@ngrx/signals@22.0.1/types/ngrx-signals-entities.d.ts)); Elf `withEntities` + `getEntity` / `hasEntity` ([typings](https://cdn.jsdelivr.net/npm/@ngneat/elf-entities@5.0.2/src/index.d.ts)); Akita `EntityState`; `@ngrx/entity`; NGXS labs `EntityStateModel` | **86** | Our adapter stores an array and scans with `findIndex` on every write (`entity.plugin.ts`). Fine for tens of rows; painful for catalogs, grids, and `track` by id. This is the largest *structural* gap versus the libraries we claim to replace. |
| `selectEntity(id)` / `selectMany` / predicate queries as signals | Elf `selectEntity`, `selectEntityByPredicate`, `selectMany`, `selectEntitiesCountByPredicate`; Akita `QueryEntity`; SignalStore users derive from `entityMap()[id]` | **80** | We expose only `all()` and `total()`. Apps rebuild `find` in every `select()`. |
| `updateAllEntities` / `updateEntities({ predicate })` / `prependEntity` | SignalStore updaters in the same typings file; Elf `updateAllEntities`, `updateEntitiesByPredicate`, `addEntitiesFifo` | **48** | We have `remove(predicate)` but updates are id-list only. Prepend is a small API hole. |
| Active entity + entity pagination | Elf `withUIEntities` / active + `@ngneat/elf-pagination`; Akita active + pagination; NGXS labs `SetActive` / page actions | **44** | Common in admin UIs. Doable with extra store keys; not a plugin. |
| Redux (or equivalent) DevTools | NgRx Toolkit `withDevtools`; NGXS `@ngxs/devtools-plugin`; Elf `@ngneat/elf-devtools`; MiniRx `ReduxDevtoolsExtension`; `@ngrx/store-devtools`; TanStack Query DevTools | **74** | Time-travel debug is table stakes for store adoption in mid-size apps. We have no inspector, action log, or export. |
| Persist schema migrations | NGXS `withNgxsStoragePlugin({ migrations })` ([docs](https://www.ngxs.io/plugins/storage)) | **71** | Shipping `persistPlugin` without a version/migrate path guarantees production breakage on shape changes. IDB `version` only creates the object store. |
| Custom persist `serialize` / `deserialize` / `beforeSerialize` | NGXS storage plugin; Akita `serialize` / `deserialize`; Toolkit `parse` / `stringify` (storage-sync PR/docs); Elf `preStorageUpdate` / `preStoreInit` | **68** | Our persist is hardcoded `JSON.stringify`. Dates become strings; `Map`/`Set` die. Users who need that today must switch to `indexedDBPlugin` or fork. |
| Async `StateStorage` on the *same* persist API | Elf `StateStorage.getItem` returns `Promise \| Observable` ([d.ts](https://cdn.jsdelivr.net/npm/@ngneat/elf-persist-state@1.2.1/src/lib/storage.d.ts)); Akita `persistState({ storage: localForage })` | **66** | We split sync JSON (`persistPlugin`) vs IDB (`indexedDBPlugin`). Capacitor / Ionic / custom async engines cannot plug into persist without a new interface. |
| Persist write debounce / batching | Akita `preStorageUpdateOperator: () => debounceTime(2000)` ([docs](https://opensource.salesforce.com/akita/docs/enhancers/persist-state/)) | **58** | Every `set` writes storage immediately. Rapid typing + persist on a large array will jank. |
| Query cache: `queryKey`, `staleTime`, `gcTime`, dedupe, retry, refetchOnFocus / reconnect, structural sharing | TanStack Query Angular ([defaults](https://tanstack.com/query/latest/docs/framework/angular/guides/important-defaults)) | **62** | Essential if we market `resourcePlugin` as “HTTP state.” Not essential if we stay a client store and tell users to compose TanStack. Our wrapper is a success-sync, not a cache. |
| Optimistic mutation + rollback + `invalidate` | TanStack `injectMutation` `onMutate` / `onError` / `setQueryData` ([mutations](https://tanstack.com/query/latest/docs/framework/angular/guides/mutations)); MiniRx undo-last-action for optimistic UI | **60** | `resourcePlugin` only writes on success. Failed or in-flight edits have no official pattern. |
| Infinite / paginated server queries | TanStack `injectInfiniteQuery`; Elf pagination package | **40** | Server-list problem. Out of scope unless we chase TanStack. |
| Side-effect primitive (`rxMethod` / `effect`) | SignalStore `rxMethod` ([source](https://github.com/ngrx/platform/blob/main/modules/signals/rxjs-interop/src/rx-method.ts)); ComponentStore `effect`; MiniRx `rxEffect`; RxAngular `connect` | **64** | We have no first-class way to bind a signal/observable to a write with cancellation besides `resourcePlugin`. Apps reinvent `effect()` in constructors. |
| Actions / events / CQRS | NGXS `@Action`; `@ngrx/store`; SignalStore events plugin; NGXS websocket maps server messages to actions | **36** | Our product bet is OOP methods. Adding a full dispatcher would clone NGXS. Low essentiality *for this library*. |
| History jump / pause / custom comparator / whole-store history | Elf `StateHistory.jumpToPast` / `jump` / `pause` / `resume` / `comparatorFn` ([d.ts](https://cdn.jsdelivr.net/npm/@ngneat/elf-state-history@1.4.0/src/lib/state-history.d.ts)); Toolkit `withUndoRedo` can track several keys/collections | **52** | We cover the 80% undo/redo case. Editors need pause (IME, drag) and jump. `JSON.stringify` equality is a correctness bug for non-JSON values. |
| Fine-grained selector subscriptions | SignalStore nested signals; RxAngular `computed` proxy reads only accessed keys ([source](https://github.com/rx-angular/rx-angular/blob/main/libs/state/src/lib/rx-state.service.ts)); our README *claims* this but source does not | **61** | Extra recomputation on large stores. Also a docs honesty issue. |
| `resource.destroy()` / scoped-store teardown | Angular `ResourceRef.destroy`; ComponentStore tears down `effect` via `destroy$` | **57** | Confirmed missing in our plugin + called out in `PRODUCTION-NOTES.md`. Root stores hide it. |
| Request status + request cache as store features | Elf `@ngneat/elf-requests` (`withRequestsStatus`, `withRequestsCache`); Toolkit `withCallState` | **50** | We leak Angular `resource.status` / `error` only via `.resource`. No cache TTL keyed by params. |
| Persist/IDB Dev-visible hydration signal on persist | Our IDB has `isReady`; persist is sync so it does not need one. Elf `initialized$`; Akita `selectPersistStateInit` | **34** | Only matters if persist becomes async. |
| Logger plugin | NGXS `@ngxs/logger-plugin` | **28** | Easy user plugin via `onAfterUpdate`. Not a differentiator. |
| Form ↔ store sync | NGXS `@ngxs/form-plugin` | **22** | Different product. Do not build unless forms are a goal. |
| Immutability runtime guard | MiniRx `ImmutableStateExtension` | **38** | We document the rule; silent no-op updates are a support cost. |
| Private / protected store members | SignalStore `_` prefix + `protectedState` (v18+) | **42** | `get` / `getSignal` expose every key. Encapsulation is a SignalStore DX win. |
| `withLinkedState` / writable derived state | SignalStore [linked state](https://ngrx.io/guide/signals/signal-store/linked-state) | **40** | Users can `select` + write two keys. Linked writable state is nicer for “selectedId must stay in list.” |
| Testing helpers | `@ngrx/signals/testing`; NGXS internals/testing | **40** | We have good unit tests, no public harness. |
| SSR TransferState / dehydrate | TanStack dehydrate/hydrate; NGXS custom storage engine for SSR | **46** | Persist/IDB skip server. Universal apps need a documented TransferState path. |
| Offline-first SQLite + outbox | Planned only (`OFFLINE_SQLITE_PLAN.md`). TanStack persist + `resumePausedMutations` covers *server* offline, not relational local. | **24** | Correctly deferred. Do not score this as a near-term gap. |
| CLI / schematics | Elf CLI; NgRx / NGXS schematics | **18** | Nice for ecosystem, not capability. |
| WebSocket → store actions | NGXS websocket plugin; this monorepo’s `@angular-libs/socket` (out of scope) | **20** | Compose socket + store in the app. |

---

## C) Parity table

Competitor column uses the **strongest relevant** implementation. Notes mention the rest.

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
| --- | --- | --- | --- | --- | --- |
| Core read/write API | `get` / `getSignal` / `set` / `update` / `patchState` / `reset` / `snapshot` on an OOP class | SignalStore: nested signals + `patchState` + `withMethods`; ComponentStore: `setState` / `patchState` / `updater` | **86** | **90** (SignalStore) | We are complete and typed. SignalStore wins on nested-signal granularity and feature composition. We win on “one class, one mental model.” |
| Derived state | `select(projector)` with proxy; **eager all-key subscribe** | SignalStore `withComputed` / `computed` on slice signals; RxAngular `computed((s) => …)` tracks accessed keys; NGXS memoized `@Selector` + `selectSignal` | **70** | **88** (SignalStore) | README oversells precision. Functionality works (`al-store.spec.ts` covers `Object.keys` / `in`). |
| Entity CRUD completeness | Full add/set/update/upsert/remove including `remove(predicate)` | SignalStore + Elf have the same CRUD **plus** map/ids, prepend, update-all, predicate updates | **78** | **92** (SignalStore/Elf) | API surface is not the gap; **representation** is. |
| Entity performance / lookup | Array + linear scan | Normalized map. SignalStore `entityMap`; Elf `getEntity` | **48** | **93** | Honest score. `sortComparer` copies and sorts the whole array on many writes. |
| Web Storage persist | `persistPlugin(keys \| 'all')`, prefix, custom `Storage`, BroadcastChannel | NGXS: migrations, serialize hooks, per-key engines, feature-level persist; Elf: async storage + `initialized$`; Toolkit `withStorageSync` | **72** | **90** (NGXS) | We are strong on **selective keys + live tab sync**. We are weak on evolve-over-time (migrations) and non-JSON values. |
| IndexedDB persist | First-party `indexedDBPlugin` with `isReady`, dirty-key race, fail-soft, structured clone, BroadcastChannel | Toolkit `withStorageSync(..., withIndexedDB())` + `whenSynced` / `readFromStorage`; Akita/Elf via async engine + localForage | **84** | **80** (Toolkit) | This is a **lead**. Race guard + `null` vs missing-key + Map broadcast are tested (`al-store.spec.ts`). Toolkit is more generic but less opinionated about hydration races. |
| Cross-tab sync | Core `syncChannel` **and** persist/IDB channels | Most persist plugins rely on `storage` events (localStorage only) or nothing. Our persist BC works for sessionStorage too. | **90** | **55** (typical persist) | Clear differentiator. Risk: enabling `syncChannel` **plus** persist `broadcast` can double-apply. |
| Undo / redo | Per-key stacks, limit, hydration skip, `isReady`, `clearHistory` | Elf: jump/pause/comparator/whole store; Toolkit: multi-key / collections; MiniRx: undo last action | **76** | **88** (Elf) | We beat SignalStore **core** (score would be ~15 without Toolkit). Hydration skip is better than naive Toolkit `effect` stacks. |
| Async load into store | `resourcePlugin` / `rxResourcePlugin` write success into a key; expose `isLoading` + `ResourceRef` | TanStack: full cache; SignalStore `rxMethod`; Toolkit `withResource`; Angular `resource` alone | **68** | **94** (TanStack) / **75** (rxMethod) | Correct Angular-20 adapter. Not a query library. Do not pretend otherwise. |
| Server-state cache | None beyond one `resource` per key | TanStack Query | **22** | **96** | Complementary. Recommend composition, not a clone. |
| Extensibility | `ALStorePlugin` hooks (`onInit`, `onBeforeUpdate`, `onAfterUpdate`, `onDestroy`); error isolation | SignalStore `signalStoreFeature`; NGXS plugins; Elf `with*` factories | **80** | **90** (SignalStore) | Intercept-before-write is something SignalStore features do not do as cleanly. Their composition/types are stronger. |
| Side effects | User `effect` / resource loaders | `rxMethod`, ComponentStore `effect`, MiniRx `rxEffect` | **40** | **88** (rxMethod) | Largest *workflow* gap for “load when X changes” besides resource `params`. |
| DevTools | None | Toolkit / NGXS / Elf / MiniRx / NgRx Store | **10** | **90** | Adoption blocker more than a runtime one. |
| RxJS story | Optional secondary entry | SignalStore optional `rxjs-interop`; ComponentStore/Elf/NGXS require RxJS | **85** | **80** | Honest optional peer + `rxResourcePlugin`. Keyword `rxjs-free` is still fair for core. |
| OOP class stores | `extends ALStore` + field-registered plugins | Akita / ComponentStore / MiniRx FeatureStore / NGXS `@State` classes | **88** | **86** (ComponentStore) | This is the product. SignalStore is functional-first; we should not abandon class style. |
| Encapsulation | All keys public via `get`/`set` | SignalStore private members | **55** | **84** | |
| Immutability | Convention + signal equality | MiniRx throws; NgRx runtime checks (global store) | **50** | **78** (MiniRx) | |
| SSR | Browser guards; no TransferState | TanStack hydration; NGXS custom engine | **45** | **75** (TanStack) | |
| Ecosystem / docs / downloads | README + AI rules + StackBlitz; ~29 w/w | SignalStore/NGXS/TanStack: books, schematics, Slack | **35** | **95** | Not an API gap; it is why “parity” still loses deals. |
| Angular floor | `>=20` because `resource({ params })` | TanStack `>=16`; SignalStore follows current Angular major | **60** | **80** | Correct for our resource plugin; blocks Angular 18/19 apps. |

---

## D) Improvement backlog

Priority is “value for this library’s positioning” (OOP signal store + plugins), not “become NGXS.”

| Improvement | Priority (1–100) | Rationale |
| --- | --- | --- |
| Add `entityMap` + `ids` (or an opt-in normalized mode) and `selectOne(id)` / `has(id)` signals | **90** | Closes the largest capability gap versus SignalStore/Elf without changing the class/plugin story. Keep array `all()` as a computed view. |
| Replace linear `findIndex` in `entityPlugin` writes with a Map index even if the stored state stays an array | **84** | Smaller API change than full normalization; fixes the O(n) write path that source actually has. |
| Persist: `serialize` / `deserialize` + `version` / `migrate` | **83** | NGXS already lost users on this class of bug. We ship persist in 0.3.x; migrations are overdue before wider adoption. |
| Persist: async `StateStorage` (`getItem`/`setItem` → `Promise`) and optional debounce | **76** | Unifies Capacitor / localForage / a thin IDB strategy with the persist API Elf/Akita already have. Debounce stops storage thrash. |
| Tree-shakeable DevTools plugin (action name + snapshot, Redux DevTools hook) | **75** | Teams evaluating vs SignalStore+Toolkit or NGXS will open DevTools on day one. |
| Make `select()` depend only on accessed keys; keep an opt-in `selectWide` for `in` / `Object.keys` / spread | **73** | Matches README, RxAngular, and SignalStore. Current eager loop is a silent perf tax. |
| `resourcePlugin`: `onDestroy` → `resource.destroy()`; hoist `error` / `status`; document component-scoped stores | **72** | Real leak (`PRODUCTION-NOTES.md`). Small, safe, overdue. |
| History: `pause`/`resume`, custom `equals`, stop using `JSON.stringify` for dirty checks; optional multi-key | **70** | Elf already shipped jump/pause. Our IDB-friendly `structuredClone` path is good; equality is not. |
| Document (and optionally guard) dual broadcast: `syncChannel` + persist/IDB `broadcast` | **63** | Capability we uniquely have can corrupt if composed naively. |
| `patchState` batching: one plugin “transaction” / one persist write / one history entry | **62** | Today each key runs `onAfterUpdate` separately (`internalPatchState`). Undo and storage see N events for one user action. |
| Lightweight `effectPlugin` or documented `rxMethod`-shaped helper in `rxjs-interop` | **58** | Covers “when signal X changes, run Y” without becoming Effects. Keep it optional. |
| TransferState / SSR recipe or `storage` factory that is a no-op on server | **50** | NGXS already warns `localStorage` tokens explode under SSR. We fail-soft; we do not teach hydration. |
| Public testing helpers (`createStore` without TestBed, mock `Storage`, fake IDB) | **48** | Lowers adoption friction. Not a feature gap for end users. |
| Runtime immutability warning in dev (`Object.is` after updater, or freeze snapshots) | **45** | Support cost. MiniRx proves the value. |
| `updateMany` by predicate / `updateAll` / `prependOne` on entities | **44** | Completeness vs SignalStore updaters. Do after normalization. |
| Optional `loggerPlugin` | **30** | One-pager example in README may be enough. |
| Entity pagination / active-id plugin | **28** | App-level keys unless many users ask. |
| SQLite + socket outbox (`OFFLINE_SQLITE_PLAN.md`) | **22** | Keep deferred. IndexedDB covers the persist story we can stand behind. |
| Clone TanStack (staleTime, infinite query, mutation defaults) | **12** | Wrong product. Compose `@tanstack/angular-query-experimental` and write results into `ALStore` if both client and server state are needed. |
| Form plugin / WebSocket-as-actions / CLI | **10** | NGXS-shaped ecosystem work. Out of scope for a 0.3 signal store. |

### Suggested sequence (still research, not a commitment)

1. Entity lookup + index (API users feel immediately).
2. Persist evolve-over-time (serialize + migrate + debounce/async).
3. `select()` precision + resource destroy + history equality.
4. DevTools plugin.
5. Everything else.

---

## Honest strengths (do not “gap” these away)

These are real, source-backed advantages. Competitors often need a second package or custom code.

1. **One dependency** for persist + IDB + history + entity + resource + cross-tab. SignalStore needs Toolkit (and still has no core BroadcastChannel).
2. **IndexedDB hydration races** (`dirtyKeysDuringHydration`, `isWritingHydrationValue`, `isReady`) are implemented and tested. Toolkit documents `await readFromStorage()` instead.
3. **History ignores persist/IDB hydration** (`isStoreHydrating` + `isReady`). Easy to get wrong; we did not.
4. **`onBeforeUpdate` intercept** can rewrite values (reset vs set, future validation). SignalStore features mostly patch after the fact.
5. **Plugin error isolation** (`al-store.ts` `runOnBeforeUpdate` / `runOnAfterUpdate` / `runOnDestroy`).
6. **Optional RxJS** with a real secondary entry, not a fake “signals-only” package that still imports `Observable` in core.
7. **OOP + AI rules** in the README are a deliberate DX bet versus `signalStore(withX, withY, …)`.
8. **BroadcastChannel for sessionStorage persist** — `storage` events do not fire for `sessionStorage` across tabs; our persist plugin does not rely on them.

---

## Sources

### Ours

- `projects/angular-libs/store/package.json`
- `projects/angular-libs/store/README.md`
- `projects/angular-libs/store/src/public-api.ts`
- `projects/angular-libs/store/src/lib/al-store.ts`
- `projects/angular-libs/store/src/lib/interfaces/*`
- `projects/angular-libs/store/src/lib/plugins/{entity,persist,history,indexeddb,resource}.plugin.ts`
- `projects/angular-libs/store/src/lib/store-hydration.ts`
- `projects/angular-libs/store/src/lib/sync-message.ts`
- `projects/angular-libs/store/rxjs-interop/src/lib/plugins/rx-resource.plugin.ts`
- `projects/angular-libs/store/OFFLINE_SQLITE_PLAN.md`
- `projects/angular-libs/store/src/lib/al-store.spec.ts`
- `PRODUCTION-NOTES.md` (resource.destroy, Angular 20 `params`)
- npm: https://www.npmjs.com/package/@angular-libs/store
- Homepage: https://angular-lib.github.io/angular-libs/store
- Demo: https://stackblitz.com/edit/angular-libs-store

### Competitors

- https://ngrx.io/guide/signals/signal-store
- https://ngrx.io/guide/signals/signal-store/entity-management
- https://ngrx.io/guide/signals/rxjs-integration
- https://ngrx.io/guide/signals/signal-store/linked-state
- https://ngrx.io/guide/signals/signal-store/state-tracking
- https://github.com/ngrx/platform/blob/main/modules/signals/src/signal-store.ts
- https://github.com/ngrx/platform/blob/main/modules/signals/rxjs-interop/src/rx-method.ts
- https://cdn.jsdelivr.net/npm/@ngrx/signals@22.0.1/types/ngrx-signals-entities.d.ts
- https://www.npmjs.com/package/@ngrx/signals
- https://ngrx.io/guide/component-store
- https://github.com/ngrx/platform/blob/main/modules/component-store/src/component-store.ts
- https://ngrx.io/guide/store
- https://ngrx-toolkit.angulararchitects.io/
- https://ngrx-toolkit.angulararchitects.io/docs/with-storage-sync
- https://ngrx-toolkit.angulararchitects.io/docs/with-undo-redo
- https://github.com/angular-architects/ngrx-toolkit
- https://www.npmjs.com/package/@ngneat/elf
- https://ngneat.github.io/elf/
- https://cdn.jsdelivr.net/npm/@ngneat/elf-persist-state@1.2.1/src/lib/storage.d.ts
- https://cdn.jsdelivr.net/npm/@ngneat/elf-persist-state@1.2.1/src/lib/persist-state.d.ts
- https://cdn.jsdelivr.net/npm/@ngneat/elf-entities@5.0.2/src/index.d.ts
- https://cdn.jsdelivr.net/npm/@ngneat/elf-state-history@1.4.0/src/lib/state-history.d.ts
- https://github.com/salesforce/akita
- https://opensource.salesforce.com/akita/docs/entities/entity-store/
- https://opensource.salesforce.com/akita/docs/enhancers/persist-state/
- https://www.ngxs.io/
- https://www.ngxs.io/concepts/select
- https://www.ngxs.io/plugins/storage
- https://www.ngxs.io/plugins/devtools
- https://www.ngxs.io/plugins/logger
- https://www.ngxs.io/plugins/websocket
- https://www.ngxs.io/plugins/form
- https://github.com/ngxs-labs/entity-state
- https://tanstack.com/query/latest/docs/framework/angular/overview
- https://tanstack.com/query/latest/docs/framework/angular/guides/important-defaults
- https://tanstack.com/query/latest/docs/framework/angular/guides/mutations
- https://github.com/spierala/mini-rx-store/blob/master/libs/signal-store/README.md
- https://github.com/rx-angular/rx-angular/blob/main/libs/state/README.md
- https://rx-angular.io/docs/state/setup
