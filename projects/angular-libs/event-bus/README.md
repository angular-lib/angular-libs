# Event Bus

A type-safe, RxJS-free event bus powered entirely by Angular Signals

[StackBlitz playground](https://stackblitz.com/edit/angular-libs-event-bus?file=src%2Fmain.ts)

## Features

- ✅ **Strongly Typed**: Full type-safety for event payloads out of the box.
- 🚀 **Signal-Based**: Built on Angular Signals for a modern, reactive architecture. Angular 18+
- 📡 **Flexible Subscriptions**: Listen via callbacks (`on`) or reactive signals (`onToSignal`).
- 🌀 **Async Resource Mapping**: Reactively map events to async operations with `onToResource()`. Integrates directly with Angular's modern Resource API, providing native loading status, error signals, and auto-abort cancellation.
- 🔄 **Event Transformation**: Map payloads directly within subscription options.
- 🧹 **Smart Cleanup**: Automatic memory management via `DestroyRef`, custom signals, or termination events.

## Installation

```bash
ng add @angular-libs/event-bus
```

## Getting Started

_(Note: `ng add` generates this setup for you automatically!)_

```typescript
// 1. Define your events
export interface AppEventMap {
  "user:login": { userId: string; username: string };
  "theme:changed": "light" | "dark";
}

// 2. Create the service
@Injectable({ providedIn: "root" })
export class AppEventBus extends ALEventBus<AppEventMap> {}
```

```typescript
// 3. Usage inside a component
@Component({ ... })
export class ExampleComponent {
  private eventBus = inject(AppEventBus);
  private destroyRef = inject(DestroyRef); // for auto-cleanup

  // Listen as a Signal
  loginState = this.eventBus.onToSignal('user:login');

  constructor() {
    // Listen with a callback
    this.eventBus.on('user:login', {
      callback: (event) => console.log('Logged in:', event.payload.username),
      unsubscribeOn: this.destroyRef
    });
  }

  // Emit
  login() {
    this.eventBus.emit('user:login', { userId: '123', username: 'john_doe' });
  }
}
```

## API

- `emit(key, payload)`: Emits an event with a given key and payload.
- `on(key, options)`: Subscribes to an event with a callback. The callback receives a BusEvent object ({ key, payload, timestamp }). Returns an unsubscribe function.
- `onUntilDestroy(key, options)`: Subscribes to an event and automatically/contextually cleans up the subscription when the surrounding component or service injection context is destroyed (no manual `DestroyRef` parsing required).
- `once(key, options)`: Subscribes for a single emission; the subscription is removed after the first call.
- `onToSignal(key, options?)`: Returns a Signal that emits the event payload (or the transformed payload). If the event has never emitted, it returns `options.defaultValue` (or `undefined` if not specified).
- `onToResource(key, options)`: Returns an Angular `ResourceRef` that triggers an asynchronous loader whenever the event is emitted. Under the hood, it hooks into Angular's modern Resource API, providing native `.value()`, `.loading()`, `.error()`, and automatic `options.defaultValue` support.
- `latest(key)`: Returns the latest BusEvent for a given key (includes payload and timestamp) or `undefined`.
- `combineLatestToSignal(sources)`: Returns a Signal of the latest transformed payloads for the provided sources.
- `combineLatest({ sources, callback })`: Subscribes to combined latest values and calls the callback with an array of BusEvent objects (one per source). Returns an unsubscribe function.
- `unsubscribe(key)`: Unsubscribe/destroy all subscriptions for a specific event key.
- `unsubscribeAll()`: Unsubscribe/destroy all subscriptions registered with the event bus (tears down all internal effects).
- `resetEvent(key)`: Resets the stored payload for a single event so it behaves as if it has never emitted. This does NOT remove subscriptions — it only clears the latest cached value.
- `resetAllEvents()`: Resets the stored payloads for all events so they behave as if they have never emitted. This does NOT remove subscriptions.

## Plugins & Extensibility

`@angular-libs/event-bus` features a robust, functional plugin architecture that allows intercepted observation, payload modification, and custom lifecycle additions (e.g., cross-tab sync, debouncing, time-travel). To register plugins in your event bus subclass, invoke `registerPlugin`:

```typescript
@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap, AppHeaders> {
  // 1. Property-stored Active Plugin (exposes public controls)
  history = this.registerPlugin(historyPlugin({ keys: ['chat:message'] }));

  constructor() {
    super();

    // 2. Passive Interceptor Plugins
    this.registerPlugin(loggerPlugin());
    this.registerPlugin(syncPlugin());
    this.registerPlugin(debouncePlugin([
      { key: 'input:search-typed', delay: 300 }
    ]));
  }
}
```

### Built-in Plugins

The package ships with four high-profile, plug-and-play functional factories:

| Plugin | Type | Options | Description |
|:---|:---:|:---|:---|
| **`loggerPlugin`** | Passive | `{ enabled?: boolean, theme?: { headerColor?: string, payloadColor?: string } }` | Automatically styles, groups, and logs emissions, timestamps, and metadata headers to the browser console. |
| **`debouncePlugin`** | Passive | `DebounceRule[]` | Intercepts rapid event cascades (like typing or window resizes) and buffers dispatches with a strict custom millisecond delay. |
| **`syncPlugin`** | Passive | `{ keys?: string[], channelName?: string }` | Synchronizes specified events across browser tabs in real time using the highly optimized `BroadcastChannel` API. |
| **`historyPlugin`** | Active | `{ limit?: number, keys?: string[] }` | Exposes a complete historical timeline stack with `.undo()`, `.redo()`, `.canUndo()`, and `.canRedo()` triggers. |

---

## Global Typed Headers

The event bus supports type-safe metadata headers on emissions and plugin pipelines by supplying a second type parameter:

```typescript
interface CustomHeaders {
  origin?: 'server' | 'user' | 'extension';
  traceId?: string;
}

@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap, CustomHeaders> {}

// Strictly typed emission matching CustomHeaders:
eventBus.emit('theme:changed', 'dark', {
  headers: { origin: 'user', traceId: 'tx_abc123' }
});

// Access anywhere on subscriber events:
eventBus.on('theme:changed', {
  callback: (e) => console.log('Tx log:', e.headers?.traceId),
});
```

## RxJS Integration

If parts of your application rely heavily on RxJS (e.g., state management, complex debouncing, or routing pipelines), you can easily bridge the signal-based event bus to an Observable. Since the core library is strictly RxJS-free, we recommend adding this simple integration pattern directly in your application's typed service:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ALEventBus } from '@angular-libs/event-bus';
import { AppEventMap } from './app.event-bus.models'; // your custom event types

@Injectable({ providedIn: 'root' })
export class AppEventBus extends ALEventBus<AppEventMap> {
  /**
   * Returns an Observable of the selected event's payload for integration with RxJS streams.
   * Subscription and tear-down are fully bound to RxJS leaf-subscribers automatically.
   *
   * @example
   * ```typescript
   * private eventBus = inject(AppEventBus);
   *
   * // Perfect for rate-limiting search inputs with standard RxJS operators!
   * searchResults$ = this.eventBus.on$('search:query').pipe(
   *   debounceTime(300),
   *   distinctUntilChanged(),
   *   switchMap(query => this.apiService.search(query))
   * );
   * ```
   */
  on$<K extends keyof AppEventMap>(key: K): Observable<AppEventMap[K]> {
    return new Observable<AppEventMap[K]>((subscriber) => {
      const unsubscribe = this.on(key, {
        callback: (event) => subscriber.next(event.payload),
      });
      return () => unsubscribe();
    });
  }
}
```

<details>
<summary>🤖 <b>AI & Copilot Instructions</b></summary>
<br>

If you are an AI coding assistant, please follow these rules when generating code that uses `@angular-libs/event-bus`:

1. **No RxJS**: This library is strictly Signal-based. Do NOT use `Subject`, `BehaviorSubject`, or `Observable` for the event bus. Use `onToSignal` (or `combineLatestToSignal`).
2. **Setup**: Always extend `ALEventBus<YourAppEventMap>` and provide it in the root (`@Injectable({ providedIn: 'root' })`). Do not use the base class directly without a type map.
3. **Injection**: Prefer Angular's `inject(YourAppEventBus)` over relying on constructor injection.
4. **Reactivity**: Prefer `onToSignal('event')` when binding state to a template to stay aligned with Angular's reactive Signal architecture. Use `{ defaultValue }` when a template binding expects a defined initial value.
5. **Cleanup**: When using the callback-based `on()` method inside a component/directive, always pass an `unsubscribeOn` option for automatic memory management. You can pass a `DestroyRef`, or a string/array-of-strings representing other event keys (e.g., `unsubscribeOn: 'user:logout'`).
6. **Types**: Do not map payloads to `any`. Let TypeScript infer the payload type based on the defined `EventMap`.
7. **Transformations**: Instead of manually mapping values later, use the `transform` property in the options object to map payloads directly (e.g., `this.eventBus.onToSignal('event', { transform: (p) => p.id })`).
8. **Combining Events**: Use `combineLatestToSignal(['event1', 'event2'])` to create a single signal that reacts to multiple events.
9. **Synchronous Reads**: To get the current state imperatively without subscribing, use `latest('event')` instead of manually tracking emitted values in local variables.
11. **Async Fetching / Loading**: For data fetching triggered by events, prefer the `onToResource` API. This couples the event stream directly to Angular's native modern Async `resource` structure with built-in loading, error signals, auto-abort cancellation, and `defaultValue` options.
12. **Testing**: In unit tests, remember to call `resetAllEvents()` in your `beforeEach` blocks to prevent state pollution across tests since the service retains the latest payloads.

**Reference Example:**

```typescript
// 1. Define Map & Service
export interface AppEventMap {
  "item:added": { id: string; name: string };
  "cart:cleared": void;
}
@Injectable({ providedIn: "root" })
export class AppEventBus extends ALEventBus<AppEventMap> {}

// 2. Usage in Component
@Component({ template: `<div>{{ latestItemId() || "No item" }}</div>` })
export class CartComponent {
  private eventBus = inject(AppEventBus);
  private destroyRef = inject(DestroyRef);

  // Good: Signal usage with transformation
  latestItemId = this.eventBus.onToSignal("item:added", {
    transform: (payload) => payload.id,
  });

  // Good: Callback usage (cleanup provided)
  constructor() {
    this.eventBus.on("cart:cleared", {
      callback: () => console.log("Cart was cleared!"),
      unsubscribeOn: this.destroyRef,
    });
  }

  addItem() {
    this.eventBus.emit("item:added", { id: "1", name: "Apple" }); // Strictly typed!
  }
}
```

**Advanced Patterns Example:**

```typescript
@Component({ template: `...` })
export class AdvancedComponent {
  private eventBus = inject(AppEventBus);

  // 1. Combine multiple events into a single Signal
  // Prevents AI from importing RxJS `combineLatest`
  dashboardState = this.eventBus.combineLatestToSignal([{ key: "item:added" }, { key: "cart:cleared" }]);

  // 2. One-time execution (no DestroyRef needed!)
  waitForFirstItem() {
    this.eventBus.once("item:added", {
      callback: (e) => console.log("First item added:", e.payload),
    });
  }

  // 3. Auto-terminate listener on another event
  logItemsUntilCartCleared() {
    this.eventBus.on("item:added", {
      callback: (e) => console.log("Added:", e.payload),
      unsubscribeOn: "cart:cleared", // Automatically unsubscribes when this event is emitted
    });
  }

  // 4. Async resource fetching with modern Resource API & defaultValue
  userDataResource = this.eventBus.onToResource("user:login", {
    defaultValue: { profileUrl: 'assets/default-avatar.png', role: 'guest' },
    loader: async ({ params }) => {
      const resp = await fetch(`/api/users/${params.userId}`);
      return resp.json();
    }
  });
}
```

</details>
