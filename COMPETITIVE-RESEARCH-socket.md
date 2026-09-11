# Competitive research: `@angular-libs/socket`

**Date:** 11 September 2026  
**Package version read:** `0.0.2` (`projects/angular-libs/socket/package.json`)  
**Scope:** Competitive research only. No library source was changed. Other monorepo packages were not evaluated.

## Method

This document compares **real APIs**, not marketing copy.

**Our side** was read from:

| Surface | Path |
| --- | --- |
| Public barrel | `projects/angular-libs/socket/src/public-api.ts` |
| Client | `projects/angular-libs/socket/src/lib/socket.ts` (`createWebSocket`, `websocketResource`) |
| Types | `projects/angular-libs/socket/src/lib/socket.types.ts` |
| Outbox | `socket.ts` (`enqueue`, `flushOutbox`, `syncOutboxStorage`, `outboxEpoch`) + `WebSocketOutboxOptions` |
| Multiplex | `projects/angular-libs/socket/src/lib/plugins/multiplex.plugin.ts` |
| Logger / mock | `plugins/logger.plugin.ts`, `plugins/mock-websocket.ts` |
| Peers | `package.json` → `@angular/core` `>=20.0.0` (required because `websocketResource` imports `resource`) |
| Docs | `projects/angular-libs/socket/README.md` |
| Tests (behavior confirmation) | `src/lib/socket.spec.ts` |

**Competitor side** was read from official docs and published source (URLs in each section). Claims that could not be verified in those sources are not listed as capabilities.

**Product positioning used for scores:** `@angular-libs/socket` is a **signal-first raw WebSocket client** for Angular 20+. It is not a Socket.IO, STOMP, or SignalR protocol implementation. Protocol-specific features are listed as gaps only when they represent a *job* a raw-WS client could offer in a protocol-agnostic form (for example request/response), or when they explain why teams pick another stack.

**Score keys**

| Column | Meaning |
| --- | --- |
| Essentiality 1–100 | How much a typical Angular realtime app needs this *from this package*, given the positioning above |
| Our / competitor score 1–100 | Completeness of that feature *as shipped*, not overall product quality |

---

## What we actually ship (source snapshot)

`createWebSocket(url, options)` returns one stable `SocketClient`:

| Capability | Evidence | Limit |
| --- | --- | --- |
| Signal status / last message / last error / buffered count / connected / next reconnect delay | `SocketClient` in `socket.types.ts`; assigned in `socket.ts` | `message()` is **last value only**. README says use `subscribe()` for every frame |
| Typed `send()` result | `SendResult` (`sent` / `queued` / `closed` / `dropped` / `queue-full` / `send-failed` / `serialization-failed`) | `serialization-failed` is declared but **never assigned**. `sendPrepared` maps serializer/`send` throws to `send-failed` |
| Reactive URL via `effect` | `bindUrl` + `effect({ injector })` | `null`/`undefined` URL shuts down and clears `activeUrl` so `online` / `reconnect()` cannot revive it |
| `DestroyRef` teardown | `destroyRef?.onDestroy(() => shutdown())` | Dev warning if no injection context; connect-once fallback if `effect()` throws |
| Reconnect with exponential backoff | `reconnect.maxAttempts` default **5**, `initialDelayMs` 1000, `maxDelayMs` 15000, `backoffFactor` 2 | Delay is **deterministic** (no jitter). Attempts reset on **any** `onopen` (no min-uptime). **Every** unexpected close reconnects (no close-code policy). No connect-attempt timeout |
| Offline outbox | `bufferWhileOffline` (default **off** on `createWebSocket`, **on** on `websocketResource`) + `outbox.maxSize` / `overflow` (`reject-newest` \| `drop-oldest`) | In-memory unless caller passes `outbox.storage` |
| Persistent outbox adapter | `WebSocketOutboxStorage` (`getItem` / `setItem` / optional `clear`), sync or async; `outboxEpoch` drops late hydrations after flush | **No built-in** localStorage / IndexedDB / OPFS adapter. Dedup on hydrate uses `JSON.stringify` keys |
| Application heartbeat | `heartbeat.intervalMs` + `payload` + optional `isHeartbeat` filter. `createWebSocket` default: **off**. `websocketResource` default: **30s** | **Send-only.** Incoming frames can be filtered; there is **no** stale-connection watchdog if the peer goes silent |
| Plugins | `onAttach`, async `onBeforeConnect`, sync `onBeforeSend` (return `null` to drop), `onMessageReceived`, `onStatusChange`, `onError` | `onBeforeSend` cannot be async. No `onAfterSend` / `onClose` |
| Topic multiplex plugin | `createWebSocketMultiplexPlugin`: topic extract, payload wrap, optional subscribe/unsubscribe **wire frames**, resubscribe on `connected`, `topicSignal`, `getActiveTopics` | Application JSON (`msg.topic` / `msg.channel` by default). Not Socket.IO rooms, not STOMP destinations, not RxJS `multiplex` ref-counting of the socket itself |
| Browser `online` / `offline` | `detectNetworkStatus` default **true** | Offline forcibly closes an open/connecting socket and sets `reconnecting`; reconnect waits for `online` |
| Test factory + mock | `webSocketFactory`, `createMockWebSocketFactory` | Mock `close()` does not forward `code` / `reason` |
| SSR | If no `WebSocket` and no factory, stay `disconnected` and reject sends | Correct for SSR; no TransferState / streaming resource hydration |
| JSON codec | Default `JSON.stringify` / `JSON.parse` | Custom `serializer` / `deserializer` allowed. Native socket is `new WebSocket(url)` — **no `protocols` argument, no `binaryType`** |
| `websocketResource` | `resource({ params: url, loader })` returns `ResourceRef<WebSocketClient \| undefined>` | Uses **`loader`**, not Angular’s **`stream`**. Value is the **client object**, not streamed messages. Legacy `send()` returns `boolean`. README already tells new code to use `createWebSocket` |
| Angular peer | `@angular/core` `>=20.0.0` | Forced by `resource({ params })` even if the caller only wants `createWebSocket` |

Generation counters invalidate stale `onopen` / `onmessage` / `onclose` after reconnect. Outbox flush re-queues remaining items if a mid-flush send fails.

---

## A) Competitor inventory (11 libraries)

| # | Library | What it is | Angular fit | Why it is in this set | Official sources |
| --- | --- | --- | --- | --- | --- |
| 1 | **socket.io-client** | Engine.IO + Socket.IO protocol client (events, acks, namespaces, transport upgrade) | Framework-agnostic. Often wrapped in a service | Default Angular chat/realtime choice when the server is Socket.IO | [Client API](https://socket.io/docs/v4/client-api/), [Client options](https://socket.io/docs/v4/client-options/), [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees), [Connection state recovery](https://socket.io/docs/v4/connection-state-recovery) |
| 2 | **ngx-socket-io** | Angular wrapper around `socket.io-client` | `SocketIoModule` / `provideSocketIo()`, `fromEvent()` → `Observable`, `emitWithAck`. v4.9.1+ is zoneless (caller must `ApplicationRef.tick()` / `NgZone.run()`) | The usual Angular packaging of (1) | [rodgc/ngx-socket-io](https://github.com/rodgc/ngx-socket-io), [npm ngx-socket-io](https://www.npmjs.com/package/ngx-socket-io) |
| 3 | **RxJS `webSocket`** | `WebSocketSubject` in `rxjs/webSocket` | Ships with Angular’s RxJS peer. Compose with `retry`, `shareReplay` | Standard Angular-without-extra-deps path; official `multiplex()` | [rxjs.dev WebSocketSubject](https://rxjs.dev/api/webSocket/WebSocketSubject), [webSocket](https://rxjs.dev/api/webSocket/webSocket), [source 7.8.2](https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts) |
| 4 | **@stomp/rx-stomp** | RxJS client for **STOMP** over WebSocket (`@stomp/stompjs`) | Official Angular guide + `RxStompService` factory | Enterprise broker stack (RabbitMQ, ActiveMQ, Spring) | [rx-stomp](https://github.com/stomp-js/rx-stomp/), [Angular guide](https://stomp-js.github.io/guide/rx-stomp/rx-stomp-with-angular.html), [RxStomp API](https://stomp-js.github.io/api-docs/latest/classes/RxStomp.html), [connection status](https://stomp-js.github.io/guide/rx-stomp/connection-status-rx-stomp.html) |
| 5 | **@stomp/ng2-stompjs** | Older Angular wrapper for STOMP | **Deprecated.** Official README: unlikely to work on Angular 10+; migrate to `rx-stomp` | Listed because it still appears in Angular search results | [stomp-js/ng2-stompjs](https://github.com/stomp-js/ng2-stompjs), [migration guide](https://stomp-js.github.io/guide/rx-stomp/ng2-stompjs/ng2-stompjs-to-rx-stomp.html) |
| 6 | **reconnecting-websocket** (pladaria) | Drop-in `WebSocket` that reconnects | None (use from a service / `webSocketFactory`) | The reconnect + buffer primitive many apps copy | [README](https://github.com/pladaria/reconnecting-websocket/blob/master/README.md), [npm](https://www.npmjs.com/package/reconnecting-websocket) |
| 7 | **Angular `resource({ stream })` + native `WebSocket`** | Official Angular 20+ pattern for multi-value async sources | First-party. Docs name WebSockets as a `stream` use case | The platform pattern our `websocketResource` does **not** follow | [angular.dev resource](https://angular.dev/guide/signals/resource), [Angular v20 announcement](https://blog.angular.dev/announcing-angular-v20-b5c9c06cf301), [`rxResource`](https://angular.dev/api/core/rxjs-interop/rxResource) |
| 8 | **@microsoft/signalr** | ASP.NET Core SignalR hub client (RPC, streaming, fallbacks) | Common in Angular + .NET shops | Named methods, `invoke` Promise RPC, automatic reconnect policy | [JS client](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0), [HubConnection](https://learn.microsoft.com/en-us/javascript/api/@microsoft/signalr/hubconnection?view=signalr-js-latest), [HubConnectionBuilder](https://learn.microsoft.com/en-us/javascript/api/@microsoft/signalr/hubconnectionbuilder?view=signalr-js-latest) |
| 9 | **partysocket** | WebSocket-compatible reconnecting client (PartyKit lineage; fork of the reconnecting-websocket model) | React `useSocket`; no Angular package | Modern reconnecting-WS with `connectionTimeout`, `minUptime`, room URL helpers | [npm partysocket](https://www.npmjs.com/package/partysocket), [PartySocket API](https://docs.partykit.io/reference/partysocket-api/), [README](https://github.com/cloudflare/partykit/blob/main/packages/partysocket/README.md) |
| 10 | **sockette** | 367-byte reconnecting wrapper | None | Close-code-aware reconnect; instance reuse | [lukeed/sockette](https://github.com/lukeed/sockette/), [types](https://cdn.jsdelivr.net/npm/sockette@2.0.6/sockette.d.ts) |
| 11 | **Native `WebSocket`** | Browser / WHATWG API | None | Baseline: subprotocols, `binaryType`, `bufferedAmount`, close codes | [MDN WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) |

**Considered, not inventoried as peers**

| Library | Why skipped |
| --- | --- |
| `graphql-ws` | GraphQL subscription protocol, not a general socket client |
| `ngx-mqtt` / MQTT.js | Different protocol; same “broker client” job as STOMP |
| `ws` (Node) | Server / Node client, not a browser Angular API |
| `isomorphic-ws` | Constructor shim only |
| joewalnes `reconnecting-websocket` | Superseded in npm usage by pladaria’s TypeScript rewrite |

---

## B) Gap table

Missing = not present in our source as a first-class API. “Who has it” is the strongest verified owner, not an exclusive list.

| Missing feature | Who has it | Essentiality | Why |
| --- | --- | --- | --- |
| **Connect-attempt timeout** (abort hung `CONNECTING`) | reconnecting-websocket (`connectionTimeout` default 4000 ms); PartySocket (same option); Socket.IO Manager `timeout` default 20000 ms | **92** | We wait forever for `onopen`. A black-holed handshake never increments reconnect attempts until `onclose`. Production mobile networks stall here. |
| **Stale-connection watchdog** (incoming heartbeat / ping timeout) | Socket.IO `ping timeout` disconnect reason; STOMP `heartbeatIncoming`; our heartbeat is outbound-only | **90** | `startHeartbeat` only `socket.send`s. `isHeartbeat` **drops** pongs from `message()`. Half-open TCP (Wi‑Fi → LTE, laptop sleep) stays `connected` until the browser eventually fires `onclose`. |
| **Backoff jitter** | Socket.IO `randomizationFactor` default `0.5`; reconnecting-websocket default `minReconnectionDelay: 1000 + Math.random() * 4000` | **86** | Our delay is `initialDelayMs * backoffFactor ** attempts`, capped. After a server restart every tab reconnects on the same tick. |
| **Min-uptime before treating a session as stable** | reconnecting-websocket / PartySocket `minUptime` default 5000 ms | **84** | We set `reconnectAttempts = 0` on every `onopen`. A flapping endpoint resets the budget forever and never hits `maxAttempts`. |
| **Close-code reconnect policy** | sockette: auto-reconnect unless code is `1000` / `1001` / `1005`; Socket.IO table of disconnect reasons (`io server disconnect` does **not** reconnect) | **82** | Our `onclose` reconnects on any non-intentional close, including a clean server `1000`. Apps cannot say “do not retry auth failures”. |
| **WebSocket subprotocols** | Native `new WebSocket(url, protocols)`; RxJS `protocol`; sockette `options.protocols`; Socket.IO `protocols`; reconnecting-websocket constructor arg | **80** | Factory path is `new WebSocket(connectionUrl)` only. GraphQL-WS, STOMP-ish, and many custom servers **require** `Sec-WebSocket-Protocol`. |
| **`binaryType` + first-class binary** | RxJS `binaryType: 'blob' \| 'arraybuffer'`; native / reconnecting-websocket expose `binaryType`; Socket.IO emits `Buffer` | **78** | `WebSocketSendData` exists and a custom serializer *can* return binary, but `WebSocketLike` has no `binaryType`, default decode is `JSON.parse(event.data)`, and there is no ArrayBuffer path in the README. |
| **Angular `resource({ stream })` for messages** | Official Angular resource guide (WebSocket / SSE / Firestore named as `stream` sources); `rxResource({ stream })` | **77** | `websocketResource` uses `loader` and exposes `ResourceRef<Client>`. That is a second state machine around a client that already has signals. Platform docs say use `stream` for multi-value sources. README already prefers `createWebSocket`. |
| **Request / response with timeout** (correlation, not a new protocol) | Socket.IO `emit` ack + `emitWithAck` + `socket.timeout`; SignalR `invoke`; STOMP `receipt` + `asyncReceipt` | **76** | `send()` is fire-and-forget. Chat commands, work-order updates, and “did the server apply this?” need a Promise. Teams currently reinvent IDs on top of `subscribe()`. |
| **Reconnect budget that can be infinite / policy function** | Socket.IO `reconnectionAttempts: Infinity`; reconnecting-websocket `maxRetries: Infinity`; SignalR `IRetryPolicy.nextRetryDelayInMilliseconds` | **74** | Default **5** then permanent `disconnected` + `reconnect` error. Long-lived dashboards expect “retry until `close()`”. No hook to delay based on elapsed time or last error. |
| **Observable / `fromEvent` interop** | ngx-socket-io `fromEvent` / `fromOneTimeEvent`; RxJS `webSocket` *is* a Subject; rx-stomp `watch()` / `connectionState$` | **70** | We have signals + a callback `subscribe()`. Angular still has large RxJS codebases; `toObservable(socket.message)` only sees the last value, not the full stream. |
| **Named events / typed event map** | Socket.IO `on`/`emit` per event; SignalR `on`/`invoke`; ngx-socket-io same | **68** | One deserialized stream + optional topic plugin. Workable, but every app invents `{ type }` discriminants. Not the same as Engine.IO packets. |
| **Transport fallback** (HTTP long-polling / SSE / WebTransport) | Socket.IO default `transports: ["polling", "websocket", "webtransport"]`; SignalR WebSockets / SSE / Long Polling | **55** | Corporate proxies still block WS. A raw-WS library cannot add polling without a matching server protocol. Essentiality is for *the job*, not for implementing Engine.IO. |
| **Session / missed-event recovery** | Socket.IO `connectionStateRecovery` + `socket.recovered`; SignalR reconnection does not replay hub messages by itself | **54** | We flush an **outbound** outbox. Inbound gaps after reconnect are the caller’s problem. Recovery is mostly a **server** feature. |
| **At-least-once send retries with ack timeout** | Socket.IO `retries` + `ackTimeout` | **52** | Outbox retries *connection* loss, not “sent but unacked”. Different guarantee. |
| **Built-in durable outbox backends** | Nobody in this set ships IndexedDB/localStorage outbox as a first-class adapter (we only ship the **interface**; demo rolls its own localStorage) | **51** | The storage hook is a real differentiator, but every app copies 15 lines. Competitors mostly queue **in memory** (RxJS `ReplaySubject` destination; rx-stomp `_queuedMessages`; reconnecting-websocket `_messageQueue`). |
| **DI singleton / `provideSocket()`** | ngx-socket-io `provideSocketIo`; rx-stomp `RxStompService` factory | **50** | `createWebSocket` in a root service works. There is no official provider, multi-namespace manager, or “share one Manager across sockets” story. |
| **Inbound message ring / history** | Angular `stream` examples accumulate arrays; Socket.IO recovery replays server buffer | **48** | `message()` and `topicSignal()` keep one value. Fine for “current status”; bad for feeds. Callers can append in `subscribe()`. |
| **Auth as a handshake object** (not URL query) | Socket.IO `auth` object or callback (survives WS-only; query is visible); SignalR `accessTokenFactory`; STOMP `connectHeaders` | **47** | `onBeforeConnect` can rewrite the URL (token query). Browsers cannot set WS headers. Query tokens leak via logs and `Referer`. |
| **Manager-level namespace multiplex** (one transport, many logical sockets) | Socket.IO Manager + `io("/admin")`; RxJS `multiplex()` shares one Subject | **45** | Our plugin filters JSON topics on **one** client. Creating two `createWebSocket` calls opens two TCP sockets. |
| **STOMP destinations, receipts, ACK/NACK, transactions** | `@stomp/rx-stomp` / `@stomp/stompjs` | **22** | Different protocol. Do not implement STOMP inside this package. |
| **SignalR hub RPC + server streams** | `@microsoft/signalr` `invoke` / `send` / `stream` | **20** | Different protocol. Do not implement the hub protocol here. |
| **Socket.IO rooms as a client API** | Rooms are **server-side** (`socket.join`). Client emits events. ngx-socket-io does not add `join()` | **15** | Frequently confused with our topic plugin. Not a client-library feature. |

---

## C) Parity table

| Feature | Our approach | Competitor approach | Our score | Competitor score | Notes |
| --- | --- | --- | --- | --- | --- |
| **Signal-first client object** | Stable `SocketClient` with `status`, `message`, `error`, `isConnected`, `bufferedCount`, `nextReconnectDelay` | Angular `resource` exposes `value`/`status`/`error` but not a socket client. Others are Observables, EventEmitters, or the native WS object | **94** | Angular stream **40**; ngx-socket-io **25**; RxJS **20** | This is the product. Competitors need `toSignal` / `BehaviorSubject` glue. ngx-socket-io zoneless builds need manual CD. |
| **Reactive URL** | `url()` in an `effect`; `null` disconnects and blocks revive | reconnecting-websocket / PartySocket `UrlProvider` (`string \| () => string \| () => Promise<string>`). RxJS `url` is a **static** string. Socket.IO URL is fixed at `io()` | **90** | reconnecting-websocket **88**; PartySocket **85**; RxJS **30** | They resolve URL per connect (good for tokens). We also tear down when the signal goes null. |
| **Lifecycle / teardown** | `DestroyRef.onDestroy` → `shutdown()`; `websocketResource` destroys a child injector on abort | Angular `stream` + `abortSignal`. RxJS unsubscribes and closes when the last subscriber leaves. Socket.IO lives until `disconnect()` | **88** | Angular stream **86**; RxJS **80**; Socket.IO **45** | Strong Angular alignment. Weak if constructed outside DI without `injector`. |
| **Reconnect** | Exponential backoff, max 5, manual `reconnect()`, generation guard | Socket.IO infinite + jitter + connect timeout + reason matrix. reconnecting-websocket: timeout, minUptime, jittered min delay, infinite retries. SignalR: delay list / `IRetryPolicy` (default 4 tries). RxJS: **none** (compose `retry()`). sockette: fixed delay, close-code filter | **62** | Socket.IO **93**; reconnecting-websocket **91**; SignalR **78**; RxJS **35**; sockette **58** | Generation invalidation is better than most wrappers. Timeout / jitter / minUptime / close-code are missing. |
| **Outbound buffer while down** | Optional outbox, overflow policy, `SendResult`, flush on open, re-queue remainder on send failure | reconnecting-websocket / PartySocket in-memory queue (`maxEnqueuedMessages`). RxJS queues via `ReplaySubject` destination until `onopen`. rx-stomp `publish` queues unless `retryIfDisconnected: false`. Socket.IO buffers emits in-memory; **at-most-once** unless `retries` | **86** | reconnecting-websocket **72**; rx-stomp **70**; Socket.IO **68**; RxJS **65** | We are ahead on typed accept/reject and overflow. Behind on ack-based retries. |
| **Durable outbox** | Caller-supplied `storage` + epoch + async hydrate merge | No inventoried competitor persists the outbound queue across reloads | **80** | All listed **5** | Unique. Hydrate dedup is `JSON.stringify` (unstable for key order). No packaged adapters. |
| **Heartbeat** | Configurable outbound payload + optional receive filter | STOMP negotiated incoming **and** outgoing. Socket.IO Engine.IO ping/pong with `ping timeout`. SignalR keep-alive. RxJS / reconnecting-websocket / sockette: none | **48** | STOMP **90**; Socket.IO **88**; SignalR **80**; RxJS **10** | Filtering pongs without a watchdog can **hide** liveness traffic and still miss death. |
| **Network online/offline** | Default `window` listeners; offline → close + `reconnecting`; online → reset attempts and `connect` | Socket.IO treats `transport close` as reconnectable. Others do not special-case `navigator.onLine` in the sources cited | **85** | Socket.IO **70**; others **20** | Real differentiator on laptops. Offline handler does not schedule a timer; it waits for `online`. |
| **Plugins / interceptors** | Five hooks + logger plugin | Socket.IO client `auth` callback; STOMP `beforeConnect`; SignalR `accessTokenFactory`. No general before-send / before-message pipeline | **82** | STOMP **55**; Socket.IO **50**; SignalR **45** | `onBeforeConnect` can be async (token refresh). `onBeforeSend` is sync-only. |
| **Topic / channel multiplex** | Plugin: extract topic, wrap send, optional subscribe frames, resubscribe on `connected`, per-topic signal | RxJS `multiplex(subMsg, unsubMsg, filter)` returns an **Observable** (not a Subject). Socket.IO namespaces share a Manager. STOMP `watch(destination)` resubscribes automatically | **70** | RxJS **84**; STOMP **92**; Socket.IO namespaces **88** | We have signals + wire hooks. RxJS multiplex is the cleaner stream API. STOMP destinations are broker-native. We do not share one TCP socket across two `createWebSocket` instances. |
| **Last-value vs every message** | `message()` / `topicSignal()` = last; `subscribe(cb)` = every | RxJS / ngx-socket-io / rx-stomp emit every frame. Angular `stream` examples **accumulate** | **75** | RxJS **90**; Angular stream **70** | Documented correctly. Easy to misuse `message()` in templates as a log. |
| **Request/response** | None | Socket.IO ack / `emitWithAck`; SignalR `invoke`; STOMP receipts | **8** | Socket.IO **94**; SignalR **92**; STOMP **80** | Largest functional hole versus “realtime SDK” competitors. |
| **Error model** | `WebSocketError` with `kind` + `cause` + `at` | Socket.IO `connect_error` + disconnect reason strings. RxJS errors the Subject (often a `CloseEvent`). SignalR callbacks get `Error` | **78** | Socket.IO **80**; SignalR **72**; RxJS **40** | Kinds are useful. Close code/reason are not surfaced on the signal. `error` status is only set when **construction** throws, not on transport `onerror`. |
| **SSR** | No global `WebSocket` → stay disconnected, do not grow an undeliverable outbox | RxJS **throws** if no `WebSocketCtor`. Socket.IO / SignalR assume a browser or Node runtime | **88** | RxJS **20**; Socket.IO **35** | Correct. `websocketResource` still runs `resource` on the server (loader resolves a dead client). |
| **Testing** | `webSocketFactory` + `createMockWebSocketFactory` (`openAll` / `receiveAll` / `sent`) | RxJS `WebSocketCtor`. reconnecting-websocket `WebSocket` option. Others: mock globals | **86** | RxJS **70**; reconnecting-websocket **68** | Mock `close()` ignores code/reason; `fail()` does not close. |
| **`websocketResource` vs platform `resource`** | `loader` → client; defaults heartbeat 30s + buffer on; legacy boolean `send` | Platform: `stream` updates `value()` over time; `abortSignal` cancels; `rxResource` wraps Observables | **35** | Angular stream **90** | README is right: new code should not use this. Dual state (`resource.status` vs `client.status`) is confusing. |
| **Subprotocol / binary socket options** | Not on `WebSocketLike`; native constructor gets URL only | Native + RxJS + sockette + Socket.IO `protocols`; RxJS `binaryType` | **18** | Native **95**; RxJS **90**; sockette **80** | Custom `webSocketFactory` is the only escape hatch. |
| **Fallback transports** | WebSocket only | Socket.IO polling → WS → WebTransport; SignalR WS / SSE / Long Polling | **15** | Socket.IO **95**; SignalR **90** | Out of scope unless we invent a protocol. Document “use Socket.IO when WS is blocked”. |
| **Bundle / deps** | `@angular/core` + `tslib` | Socket.IO + parser; ngx-socket-io + client; rx-stomp + stompjs + rxjs; SignalR standalone; reconnecting-websocket / sockette / PartySocket tiny | **90** | sockette **96**; reconnecting-websocket **94**; Socket.IO **40** | Light, but peer **≥20** is heavier than `createWebSocket` needs. |
| **Docs / maturity** | README covers the real API; package is `0.0.2` | Multi-year docs, issues, and production share | **45** | Socket.IO **95**; STOMP **88**; SignalR **90**; RxJS **92** | Honesty: we are early. Competitive features must not be oversold. |

---

## D) Improvement backlog

Improvements are for **this** package (raw WS + Angular). Implementing Socket.IO / STOMP / SignalR is explicitly out of scope.

| Improvement | Priority | Rationale |
| --- | --- | --- |
| **Connect timeout** (`reconnect.connectionTimeoutMs`, default ~4–8s) that closes a hung `CONNECTING` socket and consumes a retry | **94** | Highest-impact reliability gap versus reconnecting-websocket / Socket.IO. Small API. Tests already use a factory. |
| **Incoming liveness watchdog** (require a matching frame or any message within `heartbeat.timeoutMs`; otherwise close and reconnect) | **93** | Outbound ping without inbound timeout is cargo-cult. STOMP and Engine.IO both treat silence as death. |
| **Jitter on backoff** (`reconnect.jitter` 0–1, default ~0.5, Socket.IO formula) | **88** | Prevents reconnect storms. One multiplier in the existing delay math. |
| **`minUptimeMs` before resetting `reconnectAttempts`** | **87** | Stops infinite flap from looking like success. Proven default (5s) in reconnecting-websocket. |
| **Close-code / reason policy** (`shouldReconnect?: (CloseEvent) => boolean`, plus defaults: skip `1000`/`1008`/`4001`–auth, always retry `1006`) | **86** | sockette and Socket.IO already teach this. Surface `code`/`reason` on `WebSocketError`. |
| **Pass `protocols` through to `new WebSocket(url, protocols)` and add `binaryType` on `WebSocketLike`** | **85** | Baseline WHATWG / RxJS parity. Unblocks GraphQL-WS and binary frames without a custom factory. |
| **Reconnect policy function + `maxAttempts: Infinity`** | **80** | Dashboards should not die after 5 drops. SignalR’s `IRetryPolicy` is the right shape (`attempt`, `elapsed`, `error` → delay or `null`). |
| **Deprecate or reimplement `websocketResource` as `resource({ stream })` that streams messages (or the client via `createWebSocket` only)** | **78** | Align with [angular.dev resource streaming](https://angular.dev/guide/signals/resource). Removes the dual state machine. Lets core peer drop to 18/19 if `resource` is split to a secondary entrypoint (already suggested in repo `PRODUCTION-IMPROVEMENTS.md`). |
| **`request(payload, { match, timeoutMs })` → `Promise`** using `subscribe()` + correlation | **76** | Gives Socket.IO-ack / SignalR-invoke *jobs* without those protocols. Keep it opt-in and codec-agnostic. |
| **`toObservable()` / `messages$` that emit every frame** (and per-topic Observables on the multiplex plugin) | **72** | RxJS interop without replacing signals. `toObservable(message)` is the wrong default. |
| **Assign `serialization-failed` when `serializer` throws; keep `send-failed` for `socket.send`** | **70** | Type already promises it. Tests should lock the split. |
| **Packaged outbox adapters** (`createLocalStorageOutbox`, `createIndexedDbOutbox`) with schema version | **64** | Makes the unique durable-outbox story copy-paste-free. Keep the interface public. |
| **`provideSocket(() => url, options)` + optional multi-client token** | **58** | Matches ngx-socket-io / rx-stomp DX. Implementation is a factory around `createWebSocket`. |
| **Async `onBeforeSend` / `onBeforeClose` plugin hooks** | **55** | Signing and audit plugins need I/O. Today they must precompute. |
| **Multiplex ref-count + predicate filter** (RxJS `messageFilter` equivalent) and do not delete `topicSignal` until last subscriber if callers still read it | **54** | Current last-unsub deletes the signal. RxJS multiplex is the better subscribe/unsubscribe contract. |
| **Ring buffer option** (`historySize`) backing `messages()` signal | **48** | Optional; easy to do in userland via `subscribe`. |
| **Document “when not to use this”** (Socket.IO server, STOMP broker, SignalR hub, WS-blocked networks) | **47** | Prevents false competitive claims and support load. |
| **Do not implement Engine.IO, STOMP, or SignalR inside `@angular-libs/socket`** | **5** (anti-item) | Those are products 1, 4, and 8. Interop adapters (factory that sits *on* our client) can live later; the protocol engines should not. |

---

## Source index

### `@angular-libs/socket` (this repo)

- `projects/angular-libs/socket/src/lib/socket.ts` — `createWebSocket`, reconnect, outbox, heartbeat, network events, `websocketResource`
- `projects/angular-libs/socket/src/lib/socket.types.ts` — public types, including unused `serialization-failed`
- `projects/angular-libs/socket/src/lib/plugins/multiplex.plugin.ts` — topic routing and wire frames
- `projects/angular-libs/socket/src/lib/plugins/logger.plugin.ts`
- `projects/angular-libs/socket/src/lib/plugins/mock-websocket.ts`
- `projects/angular-libs/socket/src/lib/socket.spec.ts` — reconnect backoff, outbox persist/clear, multiplex resubscribe, online/offline, SSR dummy
- `projects/angular-libs/socket/package.json` — name, version `0.0.2`, peer `@angular/core` `>=20.0.0`
- `projects/angular-libs/socket/README.md`

### Competitors

- Socket.IO client API: https://socket.io/docs/v4/client-api/
- Socket.IO client options: https://socket.io/docs/v4/client-options/
- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees
- Socket.IO connection state recovery: https://socket.io/docs/v4/connection-state-recovery
- ngx-socket-io: https://github.com/rodgc/ngx-socket-io and https://www.npmjs.com/package/ngx-socket-io
- RxJS `WebSocketSubject`: https://rxjs.dev/api/webSocket/WebSocketSubject
- RxJS `webSocket`: https://rxjs.dev/api/webSocket/webSocket
- RxJS 7.8.2 source: https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/observable/dom/WebSocketSubject.ts
- rx-stomp: https://github.com/stomp-js/rx-stomp/
- rx-stomp Angular: https://stomp-js.github.io/guide/rx-stomp/rx-stomp-with-angular.html
- RxStomp API: https://stomp-js.github.io/api-docs/latest/classes/RxStomp.html
- ng2-stompjs deprecation: https://github.com/stomp-js/ng2-stompjs
- ng2-stompjs → rx-stomp: https://stomp-js.github.io/guide/rx-stomp/ng2-stompjs/ng2-stompjs-to-rx-stomp.html
- reconnecting-websocket README: https://github.com/pladaria/reconnecting-websocket/blob/master/README.md
- Angular resource: https://angular.dev/guide/signals/resource
- Angular v20 streaming resource example: https://blog.angular.dev/announcing-angular-v20-b5c9c06cf301
- `rxResource`: https://angular.dev/api/core/rxjs-interop/rxResource
- SignalR JS client: https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client?view=aspnetcore-10.0
- SignalR `HubConnection`: https://learn.microsoft.com/en-us/javascript/api/@microsoft/signalr/hubconnection?view=signalr-js-latest
- SignalR `HubConnectionBuilder`: https://learn.microsoft.com/en-us/javascript/api/@microsoft/signalr/hubconnectionbuilder?view=signalr-js-latest
- PartySocket: https://www.npmjs.com/package/partysocket and https://docs.partykit.io/reference/partysocket-api/
- sockette: https://github.com/lukeed/sockette/
- MDN WebSocket: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
