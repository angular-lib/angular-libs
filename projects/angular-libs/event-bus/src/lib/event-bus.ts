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
  type TransformOptions,
  type IALEventBus,
  type ALEventBusPlugin,
  type EmitOptions,
} from './event-bus.models';
import { type TransformedPayloads } from './event-bus.internal';

/**
 * A generic, signal-based event bus service for Angular applications.
 *
 * **AI Agent & Developer Instructions:**
 * - This service uses Angular Signals (`WritableSignal`, `computed`, `effect`) instead of RxJS.
 * - You can inject this directly or extend it to define a strict event map interface.
 * - For connecting events to component state or templates, prefer `onToSignal` which returns a reactive `Signal`.
 * - For side-effects in component initialization contexts, call `on` directly. It automatically detects and binds to the surrounding `DestroyRef` to auto-unsubscribe.
 * - For executing side effects reacting to events outside an injection context (e.g. inside an async method), use `on` or `once` with a callback. If you don't want them to leak, remember to capture the returned unsubscribe function or pass `{ unsubscribeOn: 'manual' }`.
 * - Event emissions are synchronous. Do not `await` the `emit()` method.
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
   * **AI Hint:** Generally avoid using this in consuming components. It is primarily used
   * internally on `ngOnDestroy` of the service, or for complete app resets (e.g., testing).
   * In component code, rely on the `unsubscribeOn` param within `.on()` instead.
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
   * Unsubscribes from all subscriptions for a given event.
   * **AI Hint:** Prefer using the automatic `unsubscribeOn` token or the individual
   * cleanup function returned by `.on()`. This method terminates *all* listeners across
   * the app for a specific event key, which could unintentionally break other features.
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
   * Resets the stored payload for a single event so it behaves as "not emitted".
   * Does not remove any subscription effects. Use `unsubscribe` or `unsubscribeAll`
   * to remove listeners.
   * **AI Hint:** Useful when you need to explicitly clear sensitive or outdated state
   * (e.g., clearing auth data on user logout) so that future components calling
   * `onToSignal` or `latest` correctly receive `undefined`.
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
   * Resets the stored payloads for all events so they behave as "not emitted".
   * Does not remove any subscription effects. Use `unsubscribeAll` to remove listeners.
   * **AI Hint:** Generally used when resetting the entire app state (e.g., during logout).
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
   * Emits an event to the bus with the specified payload.
   * This immediately updates the underlying Signal, triggering any active `effect`s (from `.on()`)
   * and updating any computed state (from `.onToSignal()`).
   *
   * **AI Hint:** Event emissions are synchronous. Do not `await` this method. Payloads are passed by reference, so do not mutate the payload inside callbacks.
   *
   * @param args Arguments containing the predefined event key, its payload (optional if void/undefined), and options (optional headers).
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
          payload = result;
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
   * Gets the latest event for a given key.
   * Useful for synchronously reading the last emitted value.
   * If the event has never been emitted or was reset, returns `undefined`.
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
   * **AI Instructions:** This is the preferred way to consume events for use in modern Angular templates
   * or as derived state using `computed`. It returns `undefined` until the first emission (or `options.defaultValue` if provided).
   * You can optionally apply a transformation function.
   *
   * @param key The event key to listen to.
   * @param options An optional object to transform the payload and/or provide a default fallback value.
   * @returns A Signal containing the latest event payload (or transformed payload).
   */
  onToSignal<K extends keyof TEventMap, TTransformed = TEventMap[K], TDefault = undefined>(
    key: K,
    options?: TransformOptions<TEventMap[K], TTransformed> & { defaultValue?: TDefault },
  ): Signal<TTransformed | TDefault> {
    return computed(() => {
      const value = this.getSignal<BusEvent<TEventMap[K], THeaders>>(key as string)();
      if (value === this.NOT_EMITTED) {
        return options?.defaultValue as TDefault;
      }
      const hubEvent = value as BusEvent<TEventMap[K], THeaders>;
      return options?.transform
        ? options.transform(hubEvent.payload)
        : (hubEvent.payload as unknown as TTransformed);
    });
  }

  /**
   * Creates a reactive Angular ResourceRef that triggers an asynchronous loader whenever the event is emitted.
   * Leverages the modern Resource API to handle loading state, error states, and automatic request cancelation
   * (via `AbortSignal`) when multiple events are emitted rapidly.
   *
   * @param key The event key.
   * @param options Object detailing the async loader, initial default value, and an optional transform function.
   * @returns A ResourceRef representing the async operation's status and resolved value.
   */
  onToResource<
    K extends keyof TEventMap,
    TResponse,
    TTransformed = TEventMap[K],
    TDefault = undefined,
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
  ): ResourceRef<TResponse | TDefault> {
    const keyStr = String(key);

    return resource({
      defaultValue: options.defaultValue,
      params: () => {
        const value = this.getSignal<BusEvent<TEventMap[K], THeaders>>(keyStr)();
        if (value === this.NOT_EMITTED) {
          return undefined;
        }
        const busEvent = value as BusEvent<TEventMap[K], THeaders>;
        const transformed = options.transform
          ? options.transform(busEvent.payload)
          : (busEvent.payload as unknown as TTransformed);
        return { payload: transformed };
      },
      loader: async ({ params, abortSignal }) => {
        if (params === undefined) {
          return undefined as any;
        }
        return options.loader({ params: params.payload, abortSignal });
      },
    }) as ResourceRef<TResponse | TDefault>;
  }

  /**
   * Subscribes to an event and fires a callback function when the event occurs.
   * **AI Instructions:** Use this when a side-effect needs to respond to events.
   * By default, if this method is called within an Angular injection context (e.g. within a component or service constructor or field initialization),
   * it automatically resolves `DestroyRef` contextually and registers auto-unsubscription, protecting against memory leaks without extra boilerplate.
   * Under other execution profiles (like dynamic async handlers), capture the returned unsubscribe function or specify alternative termination conditions.
   *
   * @param key The event key.
   * @param options Object detailing the callback, optional transform function, and memory management token.
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
   * Subscribes to an event for exactly one emission and then automatically unsubscribes.
   * Useful for initialization routines or one-off responses.
   * @param key The event key.
   * @param options Object detailing the callback and optional memory token.
   * @returns A manual cleanup function if it needs to be cancelled before the event fires.
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
   * Combines the latest payloads of multiple events into a single reactive Signal.
   * Useful when deriving state that depends on multiple events simultaneously.
   * Returns `undefined` until every source event has emitted at least once.
   *
   * @param sources An array of `CombineLatestSource` containing event keys and optional transforms.
   * @returns A mapped Array payload wrapped in a Signal.
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
   * Subscribes to the combination of the latest values of multiple events.
   * Fired only when all combined sources have emitted at least once.
   * Useful when side effects depend on multi-event state.
   *
   * @param options Configuration for multiple sources and the callback function.
   * @returns A manual unsubscribe function that destroys all internal effects for this subscription.
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
