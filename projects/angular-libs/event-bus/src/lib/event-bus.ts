import {
  Injectable,
  WritableSignal,
  computed,
  OnDestroy,
  signal,
  Signal,
  inject,
  DestroyRef,
  resource,
  ResourceRef,
  isDevMode,
} from '@angular/core';
import {
  type CombineLatestOptions,
  type CombineLatestSource,
  type BusEvent,
  type SubscriptionOptions,
  type IALEventBus,
  type ALEventBusPlugin,
  type EmitOptions,
} from './event-bus.models';
import { type TransformedPayloads } from './event-bus.internal';

type ValueWithDefault<TValue, TDefault> = TDefault extends TValue ? TValue : TValue | TDefault;

/**
 * A generic, signal-based event bus service for Angular applications.
 *
 * **AI Agent & Developer Instructions:**
 * - This service uses Angular Signals (`WritableSignal`, `computed`, `effect`) instead of RxJS.
 * - You can inject this directly or extend it to define a strict event map interface.
 * - For connecting events to component state or templates, prefer `onToSignal` which returns a reactive `Signal`.
 * - For side-effects in component initialization contexts, call `on` directly. It automatically detects and binds to the surrounding `DestroyRef` to auto-unsubscribe.
 * - For executing side effects reacting to events outside an injection context (e.g. inside an async method), use `on` or `once` with a callback. If you don't want them to leak, remember to capture the returned unsubscribe function or pass `{ unsubscribeOn: 'manual' }`.
 *
 * @example
 * ```typescript
 * // 1. Define your event map
 * interface AppEventMap {
 *   'user:login': { userId: string };
 *   'user:logout': void;
 * }
 *
 * // 2. Create a typed ALEventBus for your app
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {}
 *
 * // 3. Inject and use in your components or services
 * @Component({ ... })
 * export class MyComponent {
 *   private eventBus = inject(AppEventBus);
 *
 *   // Get reactive state (Signal) directly from the event bus
 *   loginData = this.eventBus.onToSignal('user:login');
 *
 *   constructor() {
 *     // Execute a side effect with automatic cleanup upon destroy (context-aware!)
 *     this.eventBus.on('user:login', {
 *       callback: (event) => console.log('User logged in:', event.payload.userId)
 *     });
 *
 *     // Emit an event requiring a payload
 *     this.eventBus.emit('user:login', { userId: '123' });
 *
 *     // Emit a void event (no payload argument needed!)
 *     this.eventBus.emit('user:logout');
 *   }
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ALEventBus<
  TEventMap extends {},
  THeaders extends Record<string, any> = Record<string, any>
> implements IALEventBus<TEventMap, THeaders>, OnDestroy {
  private readonly NOT_EMITTED = Symbol('NOT_EMITTED');
  private events = new Map<string, WritableSignal<any>>();
  private subscriptions = new Map<
    string,
    Map<string, { dispatch: (event: BusEvent<any, THeaders>) => void; unsubscribe: () => void }>
  >();
  private plugins: ALEventBusPlugin<TEventMap, THeaders>[] = [];

  ngOnDestroy(): void {
    this.unsubscribeAll();
    this.events.clear();
    this.plugins.forEach((plugin) => plugin.onDestroy?.());
    this.plugins = [];
  }

  /**
   * Registers a plugin to extend the event bus functionality.
   * Plugins can react to key lifecycle phases or intercept/modify values before emission.
   * 
   * **AI Agent & Developer Instructions for Building Plugins:**
   * 1. **Contract**: Implement `ALEventBusPlugin<TEventMap, THeaders>`.
   * 2. **Lifecycle Hooks**:
   *    - `onInit(bus)`: Called immediately. Use to store a reference to the event bus.
   *    - `onBeforeEmit(key, payload, options)`: Intercepts events before emission.
   *      - Return `false` to cancel emission completely.
   *      - Return a modified/new payload to override what gets emitted.
   *      - Return nothing (`void`/`undefined`) to emit the payload unchanged.
   *    - `onAfterEmit(key, payload, options)`: React to successful emissions (e.g. logging, storage).
   *    - `onSubscribe(key, subId)` & `onUnsubscribe(key, subId)`: Monitor active subscribers.
   *    - `onDestroy()`: Clean up resources when the bus is destroyed.
   * 3. **Registration Pattern**:
   *    - **Active Plugins**: (e.g., history plugins) that expose API methods should be registered as class fields/properties to allow direct access (e.g., `this.history.undo()`).
   *    - **Passive Plugins**: (e.g., logging or debounce plugins) that run completely in the background should be registered directly within the subclass `constructor`.
   * 
   * @example
   * ```typescript
   * // 1. Create your passive plugin via a factory function (conforming to functional design patterns in this library)
   * export function myLoggingPlugin(): ALEventBusPlugin {
   *   return {
   *     onInit(bus) {
   *       console.log('Plugin initialised');
   *     },
   *     onAfterEmit(key, payload) {
   *       console.log(`Emitted ${key} with payload:`, payload);
   *     }
   *   };
   * }
   * 
   * // 2. Register passive plugins in constructor, active plugins as subclass properties
   * @Injectable({ providedIn: 'root' })
   * export class AppEventBus extends ALEventBus<AppEventMap> {
   *   // Active plugin with programmatic API
   *   history = this.registerPlugin(historyPlugin({ keys: ['document:save'] }));
   * 
   *   constructor() {
   *     super();
   * 
   *     // Passive plugin (logs in the background, no properties needed on class instance)
   *     this.registerPlugin(myLoggingPlugin());
   *   }
   * }
   * ```
   * 
   * @param plugin The plugin instance satisfying `ALEventBusPlugin`.
   * @returns The registered plugin instance.
   */
  protected registerPlugin<P extends ALEventBusPlugin<TEventMap, THeaders>>(plugin: P): P {
    plugin.onInit?.(this);
    this.plugins.push(plugin);
    return plugin;
  }

  /**
   * Unsubscribes all listeners from the event bus.
   * 
   * **AI Hint & Best Practices:** 
   * - Generally avoid calling this method in consuming components.
   * - It is primarily used internally on `ngOnDestroy` of the service, or for complete cleanups during testing.
   * - In component code, rely on the `unsubscribeOn` option within `.on()` instead.
   * 
   * @example
   * ```typescript
   * // Unsubscribe absolutely everyone from everything (typically in tests)
   * eventBus.unsubscribeAll();
   * ```
   */
  unsubscribeAll(): void {
    const allTeardowns: (() => void)[] = [];
    this.subscriptions.forEach((subs) => {
      subs.forEach((sub) => allTeardowns.push(sub.unsubscribe));
    });
    allTeardowns.forEach((unsub) => unsub());
    this.subscriptions.clear();
  }

  /**
   * Unsubscribes from all subscription callbacks registered for a specific event.
   * 
   * **AI Hint & Best Practices:**
   * - Prefer using the automatic/injection-context automatic `unsubscribeOn` or capturing the individual unsubscribe function returned by `.on()`.
   * - This method terminates *all* listeners across the entire application for the specified event key, which could unexpectedly break separate component listeners.
   * 
   * @example
   * ```typescript
   * // Unsubscribe all listeners registered to the 'user:login' event
   * eventBus.unsubscribe('user:login');
   * ```
   * 
   * @param key The event key/type.
   */
  unsubscribe<K extends keyof TEventMap>(key: K): void {
    const keyStr = String(key);
    const subs = this.subscriptions.get(keyStr);
    if (subs) {
      const unsubscribers = Array.from(subs.values()).map((sub) => sub.unsubscribe);
      unsubscribers.forEach((unsub) => unsub());
    }
  }

  /**
   * Resets the cached/stored payload for a single event so it behaves as "not emitted".
   * Future calls to `latest` or `onToSignal` will yield `undefined` (or the fallback `defaultValue`) until the next emission.
   * 
   * **Best Practices & Use Cases:**
   * - Does not tear down active subscription effects or listeners. Use `unsubscribe` or `unsubscribeAll` to remove listeners.
   * - Excellent for purging sensitive or stale state (e.g., clearing auth/user metadata on user logout).
   * 
   * @example
   * ```typescript
   * // Reset the cached 'user:login' data so future reads are undefined
   * eventBus.resetEvent('user:login');
   * ```
   * 
   * @param key The event key/type to reset.
   */
  resetEvent<K extends keyof TEventMap>(key: K): void {
    const keyStr = String(key);
    const sig = this.events.get(keyStr) as WritableSignal<any> | undefined;
    if (sig) {
      sig.set(this.NOT_EMITTED);
    } else {
      // ensure future getSignal reads behave like NOT_EMITTED
      this.events.set(keyStr, signal(this.NOT_EMITTED));
    }
  }

  /**
   * Resets the cached/stored payloads for all events so they behave as "not emitted".
   * 
   * **Best Practices:**
   * - Does not tear down active subscription effects or listeners; use `unsubscribeAll` to remove listeners.
   * - Broadly used during deep application resets (e.g., global logout flow, clean slate redirects).
   * 
   * @example
   * ```typescript
   * // Clear state for all events in the event bus
   * eventBus.resetAllEvents();
   * ```
   */
  resetAllEvents(): void {
    this.events.forEach((sig) => {
      (sig as WritableSignal<any>).set(this.NOT_EMITTED);
    });
  }

  /**
   * Internal helper: Lazily creates or retrieves the underlying `WritableSignal` for a given event key.
   * **AI Hint:** This is a private utility wrapping `Symbol('NOT_EMITTED')` logic. Do NOT call externally.
   */
  private getSignal<TData = any>(key: string): WritableSignal<TData | symbol> {
    if (!this.events.has(key)) {
      this.events.set(key, signal(this.NOT_EMITTED));
    }
    return this.events.get(key)! as WritableSignal<TData | symbol>;
  }

  /**
   * Emits an event to the bus with the specified payload (and optional headers).
   * This synchronously and immediately updates the underlying Signal, updating any derived streams, and executing subscriber callbacks.
   * 
   * **AI Instructions & Best Practices:**
   * - Event emissions are fully synchronous. Do not try to `await` this method.
   * - Payloads are passed by reference. Do not mutate the payload object inside a callback as it affects other subscribers.
   * - For events defined with a `void` or `undefined` payload, the payload argument can be entirely omitted.
   * 
   * @example
   * ```typescript
   * // 1. Emitting an event with a payload
   * eventBus.emit('user:login', { userId: '123' });
   * 
   * // 2. Emitting an event with custom headers
   * eventBus.emit('user:login', { userId: '123' }, { headers: { source: 'auth-guard' } });
   * 
   * // 3. Emitting a void event (no payload needed)
   * eventBus.emit('user:logout');
   * ```
   * 
   * @param args Arguments matching the predefined event shape. Contains the event key, its payload (if any), and optional metadata headers.
   */
  emit<K extends keyof TEventMap>(
    ...args: TEventMap[K] extends void | undefined
      ? [key: K, options?: EmitOptions<THeaders>]
      : [key: K, payload: TEventMap[K], options?: EmitOptions<THeaders>]
  ): void {
    const key = args[0];
    let payload: TEventMap[K] = undefined as any;
    let options: EmitOptions<THeaders> | undefined = undefined;

    if (args.length === 2) {
      if (args[1] && typeof args[1] === 'object' && 'headers' in args[1]) {
        options = args[1] as EmitOptions<THeaders>;
      } else {
        payload = args[1] as TEventMap[K];
      }
    } else if (args.length === 3) {
      payload = args[1] as TEventMap[K];
      options = args[2] as EmitOptions<THeaders>;
    }

    for (const plugin of this.plugins) {
      if (plugin.onBeforeEmit) {
        const result = plugin.onBeforeEmit(key, payload, options);
        if (result === false) {
          return;
        }
        if (result !== undefined) {
          payload = result as TEventMap[K];
        }
      }
    }

    const event: BusEvent<TEventMap[K], THeaders> = {
      key: key as string,
      payload,
      timestamp: Date.now(),
      headers: options?.headers,
    };
    this.getSignal<BusEvent<TEventMap[K], THeaders>>(key as string).set(event);

    // Call subscribers synchronously
    const subs = this.subscriptions.get(key as string);
    if (subs) {
      const receivers = Array.from(subs.values());
      receivers.forEach((sub) => {
        sub.dispatch(event);
      });
    }

    for (const plugin of this.plugins) {
      plugin.onAfterEmit?.(key, payload, options);
    }
  }

  /**
   * Synchronously retrieves the latest event envelope (payload, timestamp, and optional headers) for the specified key.
   * If the event has never been emitted, or was explicitly reset, returns `undefined`.
   * 
   * **Best Practices:**
   * - Perfect for one-off synchronous validation checks where you don't need a reactive stream.
   * 
   * @example
   * ```typescript
   * // Synchronously fetch the last emitted login event envelope
   * const lastEvent = eventBus.latest('user:login');
   * if (lastEvent) {
   *   console.log('Last logged in user ID:', lastEvent.payload.userId);
   *   console.log('Timestamp:', lastEvent.timestamp);
   * }
   * ```
   * 
   * @param key The event key to query.
   * @returns The `BusEvent` wrapper object, or `undefined`.
   */
  latest<K extends keyof TEventMap>(
    key: K,
  ): BusEvent<TEventMap[K], THeaders> | undefined {
    const signalValue = this.getSignal<BusEvent<TEventMap[K], THeaders>>(key as string)();
    return signalValue === this.NOT_EMITTED
      ? undefined
      : (signalValue as BusEvent<TEventMap[K], THeaders>);
  }

  /**
   * Creates a reactive Angular Signal that updates whenever the specified event is emitted.
   * 
   * **AI Instructions & Best Practices:** 
   * - This is the preferred, idiomatic way to consume events inside modern Angular templates or as derived state using `computed()`.
   * - By default, it returns `undefined` until the first event is emitted.
   * - Use the `defaultValue` option to supply a synchronous fallback value before the first emission.
   * - Use the `transform` option to refine or map the payload directly within the reactive stream.
   *
   * @example
   * ```typescript
   * // 1. Basic usage - returns Signal<UserData | undefined>
   * currentUser = this.eventBus.onToSignal('user:login');
   * 
   * // 2. With default fallback value - returns Signal<boolean>
   * isLoggedIn = this.eventBus.onToSignal('user:login', {
   *   defaultValue: false,
   *   transform: (user) => !!user
   * });
   * 
   * // 3. With a transformation helper - returns Signal<string | undefined>
   * username = this.eventBus.onToSignal('user:login', {
   *   transform: (user) => user.name.toUpperCase()
   * });
   * ```
   *
   * @param key The event key to listen to.
   * @param options Configuration for mapping/transforming the payload and/or defining a fallback default value.
   * @returns A reactive Signal yielding the latest event payload or transformed value.
   */
  onToSignal<
    K extends keyof TEventMap,
    TTransformed = TEventMap[K],
    TDefault = undefined
  >(
    key: K,
    options?: {
      transform?: (payload: TEventMap[K]) => TTransformed;
      defaultValue?: TDefault;
    },
  ): Signal<ValueWithDefault<TTransformed, TDefault>> {
    return computed(() => {
      const value = this.getSignal<BusEvent<TEventMap[K], THeaders>>(key as string)();
      if (value === this.NOT_EMITTED) {
        return options?.defaultValue as any;
      }
      const hubEvent = value as BusEvent<TEventMap[K], THeaders>;
      return (options?.transform
        ? options.transform(hubEvent.payload)
        : (hubEvent.payload as any)) as any;
    });
  }

  /**
   * Creates a reactive Angular `ResourceRef` that triggers an asynchronous loader whenever the specified event is emitted.
   * Leverages Angular's modern Resource API to expertly handle loading/error states and auto-cancellation
   * (via `AbortSignal`) when multiple events are emitted rapidly.
   * 
   * **AI Instructions & Best Practices:** 
   * - This is the perfect pattern for connecting events directly to asynchronous operations (such as HTTP requests, DB queries, etc.).
   * - Returning `undefined` from the params initially blocks loading until the event fires at least once, unless a standard `defaultValue` is specified.
   * - You can pre-process the event payload with a standard sync transformation helper before passing it to the async loader.
   *
   * @example
   * ```typescript
   * // 1. Basic usage without transform:
   * // The event payload is { userId: string }, so `params` inside loader has the same shape.
   * userProfileResource = this.eventBus.onToResource('user:login', {
   *   loader: async ({ params, abortSignal }) => {
   *     const res = await fetch(`/api/users/${params.userId}`, { signal: abortSignal });
   *     return res.json();
   *   }
   * });
   * 
   * // 2. Advanced usage with a transform function:
   * // The payload is mapped from `doc` to the string `doc.id`, so `params` inside loader is just that string.
   * documentResource = this.eventBus.onToResource('doc:selected', {
   *   defaultValue: null,
   *   transform: (doc) => doc.id,
   *   loader: async ({ params: docId, abortSignal }) => {
   *     return this.docService.fetchDetails(docId, abortSignal);
   *   }
   * });
   * ```
   *
   * @param key The event key.
   * @param options Configuration detailing the async loader, initial default fallback value, and an optional transform function.
   * @returns A ResourceRef representing the status and resolved async value.
   */
  onToResource<
    K extends keyof TEventMap,
    TResponse,
    TTransformed = TEventMap[K],
    TDefault = undefined
  >(
    key: K,
    options: {
      transform?: (payload: TEventMap[K]) => TTransformed;
      loader: (ctx: {
        params: TTransformed;
        abortSignal: AbortSignal;
      }) => Promise<TResponse> | TResponse;
      defaultValue?: TDefault;
    },
  ): ResourceRef<ValueWithDefault<TResponse, TDefault>> {
    const keyStr = String(key);

    return resource<TResponse | TDefault, { payload: TTransformed } | undefined>({
      defaultValue: options.defaultValue as TResponse | TDefault,
      params: () => {
        const value = this.getSignal<BusEvent<TEventMap[K], THeaders>>(keyStr)();
        if (value === this.NOT_EMITTED) {
          return undefined;
        }
        const busEvent = value as BusEvent<TEventMap[K], THeaders>;
        const transformed = options.transform
          ? options.transform(busEvent.payload)
          : (busEvent.payload as any);
        return { payload: transformed };
      },
      loader: async ({ params, abortSignal }) => {
        if (params === undefined) {
          return undefined as any;
        }
        return options.loader({ params: params.payload as any, abortSignal });
      },
    }) as any;
  }

  /**
   * Subscribes a callback to receive emissions for a specified event key.
   * 
   * **AI Instructions & Best Practices:**
   * - Use this when responding to events with side effects (e.g., launching dialogs, showing toast notifications, updating global analytic logs).
   * - **Zero-Boilerplate Memory Management**: If called inside an active Angular injection context (e.g., within constructor, field-initializers, or factory functions),
   *   it automatically retrieves `DestroyRef` and safely registers auto-unsubscription under the hood.
   * - If created outside an injection context (e.g., in a late dynamically loaded component function), capture the returned `() => void` unsubscribe function or supply an explicit `unsubscribeOn` token in `options` to avoid memory leaks.
   *
   * @example
   * ```typescript
   * // 1. Inside component constructor - auto-unsubscribes when component is destroyed
   * constructor() {
   *   this.eventBus.on('user:login', {
   *     callback: (event) => console.log('Welcome back', event.payload.userId)
   *   });
   * }
   * 
   * // 2. Using an explicit transform and custom header options
   * this.eventBus.on('user:login', {
   *   transform: (user) => user.email,
   *   callback: (event) => console.log('Transformed email payload:', event.payload)
   * });
   * 
   * // 3. Late/dynamic manual cleanup setup
   * const unsubscribe = this.eventBus.on('theme:changed', {
   *   unsubscribeOn: 'manual', // Silences potential leak warnings in dev mode
   *   callback: (evt) => applyNewTheme(evt.payload)
   * });
   * // Call unsubscribe() manually when done!
   * ```
   *
   * @param key The event key.
   * @param options Subscription configuration including the callback, optional payload transform, and/or unsubscription strategies.
   * @returns A cleanup function to manually unsubscribe.
   */
  on<K extends keyof TEventMap, TTransformed = TEventMap[K]>(
    key: K,
    options: SubscriptionOptions<TEventMap[K], TTransformed, THeaders>,
  ): () => void {
    const { callback, transform, unsubscribeOn } = options;
    const keyStr = String(key);
    const subscriptionId = `sub:${keyStr}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;

    this.plugins.forEach((p) => p.onSubscribe?.(keyStr, subscriptionId));

    const dispatch = (busEvent: BusEvent<TEventMap[K], THeaders>) => {
      const { key, timestamp, payload, headers } = busEvent;
      const transformed = transform
        ? transform(payload as TEventMap[K])
        : (payload as unknown as TTransformed);

      const evt = { key, timestamp, payload: transformed, headers };

      try {
        const res = callback(evt);
        if (res instanceof Promise) {
          res.catch((err) =>
            console.error(`Error in callback for event ${keyStr}:`, err),
          );
        }
      } catch (err) {
        console.error(`Error in callback for event ${keyStr}:`, err);
      }
    };

    let cleanupTracker: (() => void) | null = null;

    const unsubscribe = () => {
      const subs = this.subscriptions.get(keyStr);
      if (subs && subs.has(subscriptionId)) {
        subs.delete(subscriptionId);
        if (subs.size === 0) {
          this.subscriptions.delete(keyStr);
        }
        this.plugins.forEach((p) => p.onUnsubscribe?.(keyStr, subscriptionId));
      }
      if (cleanupTracker) {
        cleanupTracker();
        cleanupTracker = null;
      }
    };

    if (!this.subscriptions.has(keyStr)) {
      this.subscriptions.set(keyStr, new Map());
    }
    this.subscriptions.get(keyStr)!.set(subscriptionId, { dispatch, unsubscribe });

    // Context-guided automatic DestroyRef resolution
    let contextDestroyRef: DestroyRef | null = null;
    try {
      contextDestroyRef = inject(DestroyRef, { optional: true });
    } catch {
      // Safely ignore if executed outside an active injection context
    }

    if (isDevMode() && !contextDestroyRef && !unsubscribeOn) {
      console.warn(
        `[ALEventBus] Potential memory leak: Subscription for event "${keyStr}" was created outside an injection context without an explicit 'unsubscribeOn' strategy.\n` +
        `Make sure to either:\n` +
        `1. Call on() inside an injection context (e.g. constructor or field initializer) to enable automatic cleanup.\n` +
        `2. Manually capture and call the returned unsubscribe function.\n` +
        `3. Pass an explicit 'unsubscribeOn' strategy (e.g. DestroyRef or list of terminating event keys).\n` +
        `To suppress this warning, explicitly pass: { unsubscribeOn: 'manual' }`
      );
    }

    const finalUnsubscribeOn = unsubscribeOn === 'manual'
      ? undefined
      : (unsubscribeOn ?? contextDestroyRef ?? undefined);

    if (finalUnsubscribeOn) {
      if (typeof (finalUnsubscribeOn as any).onDestroy === 'function') {
        const cleanupDestroy = (finalUnsubscribeOn as DestroyRef).onDestroy(unsubscribe);
        if (typeof cleanupDestroy === 'function') {
          cleanupTracker = cleanupDestroy;
        }
      } else {
        const keys = Array.isArray(finalUnsubscribeOn) ? finalUnsubscribeOn : [finalUnsubscribeOn];
        const cancelSubs = keys.map((k) =>
          this.on(k as any, { callback: () => unsubscribe() }),
        );
        cleanupTracker = () => cancelSubs.forEach((unsub) => unsub());
      }
    }

    return unsubscribe;
  }

  /**
   * Subscribes a callback to receive exactly ONE emission for a specified event key, and then automatically unsubscribes.
   * 
   * **Best Practices:**
   * - Perfect for one-time initialization routines, lazy setups, or transient feedback routines.
   * 
   * @example
   * ```typescript
   * // Fire a callback the very first time the user logs in
   * this.eventBus.once('user:login', {
   *   callback: (event) => {
   *     console.log('App successfully initialised for user', event.payload.userId);
   *   }
   * });
   * ```
   * 
   * @param key The event key.
   * @param options Subscription configuration including the callback, payload transform, and optional unsubscription strategies.
   * @returns A manual cleanup function if the listener needs to be terminated before the event fires.
   */
  once<K extends keyof TEventMap, TTransformed = TEventMap[K]>(
    key: K,
    options: SubscriptionOptions<TEventMap[K], TTransformed, THeaders>,
  ): () => void {
    let unsubscribe: () => void;
    const oneTimeCallback = async (event: BusEvent<TTransformed, THeaders>) => {
      if (unsubscribe) {
        unsubscribe();
      }
      try {
        await options.callback(event);
      } catch (error) {
        console.error(
          `Error in once callback for event ${String(key)}:`,
          error,
        );
      }
    };
    unsubscribe = this.on(key, {
      callback: oneTimeCallback,
      transform: options.transform,
      unsubscribeOn: options.unsubscribeOn,
    } as any);
    return unsubscribe;
  }

  /**
   * Combines the latest payloads of multiple events into a single, synchronously updated reactive Signal.
   * 
   * **AI Instructions & Best Practices:**
   * - Useful when deriving state that depends on multiple events simultaneously.
   * - Under the hood, this compiles the events into a tuple of transformed values.
   * - Yields `undefined` until *every* specified source event has emitted at least once.
   * 
   * @example
   * ```typescript
   * // Combine multiple sources into one reactive Signal
   * connectionState = this.eventBus.combineLatestToSignal([
   *   { key: 'network:ping', transform: (p) => p.latency },
   *   { key: 'user:session' }
   * ]);
   * 
   * // connectionState() is undefined until both events emit.
   * // Afterwards, it returns a precise tuple: [number, SessionData]
   * ```
   *
   * @param sources A read-only array of `CombineLatestSource` objects detailing target event keys and optional transforms.
   * @returns A reactive Signal yielding the tuple of mapped event payloads, or `undefined`.
   */
  combineLatestToSignal<const TSources extends readonly CombineLatestSource[]>(
    sources: TSources,
  ): Signal<TransformedPayloads<TSources> | undefined> {
    return computed(() => {
      const values = sources.map((s) => this.getSignal(s.key)());
      if (values.some((v) => v === this.NOT_EMITTED)) {
        return undefined;
      }
      const hubEvents = values as BusEvent<any>[];
      return hubEvents.map((hubEvent, i) => {
        const source = sources[i];
        return source.transform
          ? source.transform(hubEvent.payload)
          : hubEvent.payload;
      }) as TransformedPayloads<TSources>;
    });
  }

  /**
   * Subscribes to the combination of the latest values of multiple events and executes a callback side-effect.
   * 
   * **Best Practices:**
   * - The callback triggers only after *all* combined source events have emitted at least once.
   * - After that threshold, any subsequent emission from *any* of the sources triggers the callback with the latest state of all combined events.
   * 
   * @example
   * ```typescript
   * const unsubscribe = this.eventBus.combineLatest({
   *   sources: [
   *     { key: 'user:login' },
   *     { key: 'config:loaded', transform: (c) => c.features }
   *   ],
   *   callback: ([loginEvent, configEvent]) => {
   *     console.log('User logged in AND configuration was loaded!');
   *     this.initFeaturesForUser(loginEvent.payload.userId, configEvent.payload);
   *   }
   * });
   * 
   * // Call unsubscribe() to clean up all underlying subscriptions
   * ```
   *
   * @param options Configuration detailing target sources and the trigger callback function.
   * @returns A manual unsubscribe function that tears down all internally managed subscriptions.
   */
  combineLatest<const TSources extends readonly CombineLatestSource[]>(
    options: CombineLatestOptions<TSources>,
  ): () => void {
    const { sources, callback } = options;

    const checkAndTrigger = () => {
      const values = sources.map((s) => this.getSignal(s.key)());
      if (values.some((v) => v === this.NOT_EMITTED)) {
        return;
      }
      const hubEvents = values as BusEvent<any>[];
      const payloads = hubEvents.map((hubEvent, i) => {
        const source = sources[i];
        return source.transform
          ? source.transform(hubEvent.payload)
          : hubEvent.payload;
      }) as TransformedPayloads<TSources>;

      // Build BusEvent<TTransformed>[] matching sources order
      const events = payloads.map((payload, i) => ({
        key: sources[i].key,
        timestamp: hubEvents[i].timestamp,
        payload,
        headers: hubEvents[i].headers,
      })) as any;

      const result = callback(events);
      if (result instanceof Promise) {
        const keys = sources.map((s) => s.key).join(', ');
        result.catch((error) =>
          console.error(
            `Error in combineLatest callback for events ${keys}:`,
            error,
          ),
        );
      }
    };

    const unsubscribes = sources.map((source) =>
      this.on(source.key as any, {
        callback: () => checkAndTrigger(),
      }),
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }
}
