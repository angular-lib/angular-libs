# Event Bus

A typed, signal-based event bus service for Angular. No RxJS.

[StackBlitz playground](https://stackblitz.com/edit/angular-libs-event-bus?file=src%2Fmain.ts)

- ✅ **Strongly typed**: payloads, keys, tuples, middleware options and projections are all checked against your event map.
- 🚀 **Signal-based**: `onToSignal`, `combineLatestToSignal` and projections return signals. Angular 20+.
- 🌀 **Async resources**: `onToResource()` maps events to Angular's Resource API, with loading/error state and abort.
- 🧩 **Middleware**: logger, debounce and cross-tab sync built in, or write your own.
- ↩️ **Projections with undo**: derive state from events, with snapshot undo/redo.
- 🧹 **Automatic cleanup**: `on()` stops with the component or service that called it.

## Installation

```bash
ng add @angular-libs/event-bus
```

## Getting started

_(`ng add` generates this for you.)_

```ts
// 1. Define your events
export interface AppEventMap {
  'user:login': { userId: string; name: string };
  'user:logout': void;
  'theme:changed': 'light' | 'dark';
}

// 2. Create the service
@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap> {}
```

```ts
// 3. Use it
@Component({ template: `Hello {{ user()?.name ?? 'guest' }}` })
export class HeaderComponent {
  private bus = inject(AppEventBus);

  user = this.bus.onToSignal('user:login');

  constructor() {
    // Stops automatically when the component is destroyed.
    this.bus.on('user:logout', () => this.router.navigate(['/']));
  }

  login() {
    this.bus.emit('user:login', { userId: '42', name: 'Ada' });
  }
}
```

## API

### Emitting

```ts
bus.emit('user:login', { userId: '42', name: 'Ada' });
bus.emit('user:logout');                                    // void events need no payload
bus.emit('user:logout', undefined, { headers: { reason: 'timeout' } });
```

Arguments are always `(key, payload, options?)`. Emits are synchronous; an emit from inside a handler is delivered after the current event, in order. Emitting inside `effect()`/`computed()` never makes them depend on signals read by handlers.

### Listening

```ts
bus.on('user:login', (user, event) => console.log(user.name, event.timestamp));
bus.on(['cart:add', 'cart:clear'], (_, event) => track(event.key)); // several keys
bus.once('app:ready', () => init());

// Stop early:
const stop = bus.on('theme:changed', apply, { unsubscribeOn: 'manual' });
stop();
```

The handler gets the payload and the full event (`{ key, payload, headers, origin, timestamp }`). Errors thrown by a handler, or promises it rejects, are logged and never affect other handlers.

**Cleanup.** Called in an injection context (constructor, field initializer), `on()` stops when that component/directive/service is destroyed. `unsubscribeOn` adds another way to stop:

| `unsubscribeOn` | Stops when |
|:--|:--|
| _(omitted)_ | the surrounding injection context is destroyed |
| `'user:logout'` or `['a', 'b']` | one of these events is emitted (or the context is destroyed) |
| an `AbortSignal` | it aborts (or the context is destroyed) |
| a `DestroyRef` | it is destroyed (or the context is destroyed) |
| `'manual'` | only when you call the returned function |

Outside an injection context without `unsubscribeOn`, a dev-mode warning reminds you to stop the subscription.

### Signals

```ts
user = bus.onToSignal('user:login');                                    // Signal<User | undefined>
name = bus.onToSignal('user:login', { transform: (u) => u.name, defaultValue: 'guest' }); // Signal<string>
session = bus.combineLatestToSignal(['user:login', 'theme:changed']);   // Signal<[User, Theme] | undefined>
```

`onToSignal` starts with the latest payload already emitted and follows new ones. Like any signal it compares by value, so the same payload twice does not notify twice — use `on()` or a projection when every occurrence matters.

`combineLatest(keys, handler)` is the callback version: it runs whenever one of the keys is emitted, once all have been emitted at least once.

### Async resources

```ts
profile = bus.onToResource('user:login', {
  transform: (user) => user.userId,           // optional; the loader's params
  loader: ({ params: userId, abortSignal, event }) =>
    fetch(`/api/users/${userId}`, { signal: abortSignal }).then((r) => r.json() as Promise<Profile>),
  defaultValue: guestProfile,                 // optional
});

// profile.value(), profile.status(), profile.isLoading(), profile.error(), profile.reload()
```

Loads every time the event is emitted — even with an identical payload — and aborts the previous load. Idle until the first event, and again after `resetEvent('user:login')`. Needs an injection context, or pass `injector`.

### Reading and resetting

- `latest(key)`: the latest event (`{ key, payload, headers, origin, timestamp }`) or `undefined`.
- `resetEvent(key)` / `resetAllEvents()`: forget the latest payload, so signals return to their default and resources to idle. Handlers and projections keep running.
- `unsubscribe(key)` / `unsubscribeAll()`: stop every handler of a key / of the bus. Mostly for tests.

## Projections (state + undo)

A projection folds events into state. Declare it as a field of your bus; every emitted event runs its reducer (identical payloads count too).

```ts
@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap> {
  cart = this.projection({ items: [] as Item[] }, {
    'cart:add': (s, item) => ({ items: [...s.items, item] }),
    'cart:remove': (s, { sku }) => ({ items: s.items.filter((i) => i.sku !== sku) }),
    'cart:clear': () => ({ items: [] }),
  }, { undo: true });                       // or { undo: { limit: 100 } }
}

// anywhere
bus.cart.state();                           // Signal<{ items: Item[] }>
bus.cart.undo();  bus.cart.redo();
bus.cart.canUndo(); bus.cart.canRedo();     // signals — safe in OnPush/zoneless templates
bus.cart.clearHistory(); bus.cart.reset();
```

Undo restores the whole previous state, whichever event produced it. Return the same state object from a reducer to mean "no change" (no history entry).

## Middleware

Add middleware in your bus constructor with `use()`. It runs in order, before handlers.

```ts
@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap> {
  constructor() {
    super();
    this.use(
      withLogger(),                                            // dev only by default
      withDebounce(['search:typed', 'window:resized'], 300),
      withCrossTabSync({ channel: 'my-app', keys: ['user:logout', 'cart:add'] }),
    );
  }
}
```

| Middleware | Description |
|:--|:--|
| `withLogger({ enabled?, filter? })` | Logs each event as a collapsed console group. `enabled` defaults to `isDevMode()`. |
| `withDebounce(keys, ms)` | Delivers only the latest of each key after `ms` of quiet. |
| `withCrossTabSync({ channel, keys? })` | Mirrors events and resets to other tabs via `BroadcastChannel`. Received events have `origin: 'remote'` and are never sent back — even combined with debounce. Payloads must be structured-cloneable. No-op during SSR. |
| `withBubbling()` | For a bus provided in a component: also delivers its events to the parent (e.g. root) instance. |
| `withMiddleware(factory)` | Your own middleware. |

Keys in middleware options are checked against your event map.

### Custom middleware

A middleware passes an event on (`next(event)`), changes it (`next({ ...event, payload })`), drops it (doesn't call `next`), or defers it (calls `next` later — it continues from the same point, so later middleware sees it once). The factory runs in the bus's injection context, so it can `inject()`. `event.key` narrows `event.payload`.

```ts
this.use(
  withMiddleware(() => {
    const analytics = inject(Analytics);
    return {
      handle(event, next) {
        next(event);
        if (event.key === 'user:login') analytics.identify(event.payload.userId);
      },
    };
  }),
);
```

Optional hooks: `onReset(key, origin)` and `destroy()`. A middleware that throws is logged and the event continues unchanged.

## Scoped buses

Provide the bus in a component to give that subtree its own instance, destroyed with it:

```ts
@Component({ providers: [WizardEventBus] })
export class WizardComponent {}
```

Its constructor (and `use(...)`) runs for that instance too. Add `withBubbling()` if the root instance should also see the subtree's events.

## Typed headers

```ts
interface AppHeaders {
  traceId?: string;
}

@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap, AppHeaders> {}

bus.emit('theme:changed', 'dark', { headers: { traceId: 'tx_1' } });
bus.on('theme:changed', (_, e) => console.log(e.headers?.traceId));
```

## Testing

Each `TestBed` gets fresh root services, so bus state does not leak between tests.

```ts
const bus = TestBed.inject(AppEventBus);
const theme = bus.onToSignal('theme:changed');
bus.emit('theme:changed', 'dark');
expect(theme()).toBe('dark');
```

## RxJS interop

```ts
on$<K extends EventKey<AppEventMap>>(key: K): Observable<AppEventMap[K]> {
  return new Observable((subscriber) => this.on(key, (payload) => subscriber.next(payload), { unsubscribeOn: 'manual' }));
}
```

## Migrating from 0.2

| 0.2 | 0.3 |
|:--|:--|
| `bus.on(key, { callback: (e) => …e.payload, transform, unsubscribeOn })` | `bus.on(key, (payload, e) => …, { unsubscribeOn })` |
| `bus.once(key, { callback })` | `bus.once(key, handler)` |
| `combineLatestToSignal([{ key: 'a', transform }, { key: 'b' }])` | `combineLatestToSignal(['a', 'b'])` + `computed()` |
| `combineLatest({ sources, callback })` | `combineLatest(['a', 'b'], ([a, b]) => …)` |
| `this.registerPlugin(loggerPlugin())` | `this.use(withLogger())` |
| `debouncePlugin([{ key, delay }])` | `withDebounce(key, delay)` |
| `crossTabSyncPlugin({ keys, channelName })` | `withCrossTabSync({ keys, channel })` (channel is required) |
| `history = this.registerPlugin(historyPlugin({ keys }))` | `history = this.projection(initial, reducers, { undo: true })` |
| `createEventBusHooks(AppEventBus)` | removed |
| `ALEventBusPlugin` hooks | `Middleware` (`handle`, `onReset`, `destroy`) |

`emit`, `onToSignal`, `onToResource`, `latest`, `resetEvent`, `resetAllEvents`, `unsubscribe` and `unsubscribeAll` keep their signatures.

<details>
<summary>🤖 <b>AI & Copilot Instructions</b></summary>
<br>

When generating code that uses `@angular-libs/event-bus`:

1. Define events in one `AppEventMap` interface and extend `ALEventBus<AppEventMap>` in an `@Injectable({ providedIn: 'root' })` service. Inject it with `inject(AppEventBus)`.
2. Emit with `bus.emit(key, payload)`; omit the payload for `void` events.
3. React with `bus.on(key, (payload, event) => …)` in a constructor or field initializer — it cleans up automatically. Outside an injection context pass `{ unsubscribeOn }`.
4. Bind state with `bus.onToSignal(key, { transform, defaultValue })` and `bus.combineLatestToSignal([...keys])`; derive with `computed()`. Do not use RxJS subjects.
5. Load data on events with `bus.onToResource(key, { transform, loader })`.
6. Use `this.projection(initial, reducers, { undo })` inside the bus class for state built from several events, counters or undo/redo.
7. Add middleware in the bus constructor: `this.use(withLogger(), withDebounce(...), withCrossTabSync(...))`.

</details>
