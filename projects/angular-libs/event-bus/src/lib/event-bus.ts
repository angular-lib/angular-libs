import {
  DestroyRef,
  Injectable,
  Injector,
  ResourceRef,
  Signal,
  WritableSignal,
  computed,
  inject,
  isDevMode,
  resource,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import {
  BusEvent,
  EmitArgs,
  EmitOptions,
  EventBusPlugin,
  EventKey,
  OnOptions,
  PluginContext,
  PluginHooks,
  Projection,
  ProjectionOptions,
  ProjectionReducers,
  ResourceOptions,
  SignalOptions,
} from './event-bus.models';
import { createProjection } from './projection';

// `NoInfer` stops an annotated target (e.g. `x: Signal<string> = …`) from inferring away `| undefined`.
type ValueWithDefault<TValue, TDefault> = NoInfer<TDefault extends TValue ? TValue : TValue | TDefault>;

/** The event passed to a handler listening to one or more keys, discriminated by `key`. */
export type EventFor<TEventMap, THeaders extends object, K extends EventKey<TEventMap>> = {
  [P in K]: BusEvent<TEventMap[P], THeaders, P>;
}[K];

type AnyEvent = BusEvent<any, any, string>;
type AnyListener = (event: AnyEvent) => void;

/**
 * A typed, signal-based event bus. Extend it with your event map and provide it like any service.
 *
 * @example
 * ```ts
 * export interface AppEventMap {
 *   'user:login': { userId: string };
 *   'user:logout': void;
 *   'search:typed': string;
 * }
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   constructor() {
 *     super();
 *     this.use(withLogger(), withDebounce('search:typed', 300));
 *   }
 * }
 *
 * // component
 * bus = inject(AppEventBus);
 * user = this.bus.onToSignal('user:login');
 * constructor() {
 *   this.bus.on('user:logout', () => this.router.navigate(['/']));
 * }
 * login() {
 *   this.bus.emit('user:login', { userId: '42' });
 * }
 * ```
 *
 * Providing the bus in a component's `providers` gives that subtree its own instance, destroyed
 * with the component.
 */
@Injectable({ providedIn: 'root' })
export class ALEventBus<TEventMap extends object, THeaders extends object = Record<string, unknown>> {
  readonly #injector = inject(Injector);
  /** Listeners per key. The value is the subscription id for `on()` subscriptions, `null` for internal ones. */
  readonly #listeners = new Map<string, Map<AnyListener, string | null>>();
  readonly #latest = new Map<string, WritableSignal<AnyEvent | undefined>>();
  readonly #plugins: PluginHooks<TEventMap, THeaders, unknown>[] = [];
  readonly #queue: AnyEvent[] = [];
  #pipeline: (event: AnyEvent) => void = (event) => this.#deliver(event);
  #delivering = false;
  #destroyed = false;
  #subscriptionCount = 0;
  readonly #pluginContext: PluginContext<TEventMap, THeaders> = {
    hydrate: (key, payload, options) => {
      const latest = this.#latestSignal(key);
      if (untracked(latest)) return;
      latest.set({ key, payload, headers: options?.headers, origin: 'storage', timestamp: options?.timestamp ?? Date.now() });
    },
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.#destroyed = true;
      this.#runHook('destroy', (plugin) => plugin.destroy?.());
      this.#listeners.clear();
      this.#queue.length = 0;
    });
  }

  /**
   * Adds plugins, in order. Call it from your subclass constructor or a field initializer.
   * With a single plugin, returns the `api` it exposes.
   *
   * @example
   * ```ts
   * export class AppEventBus extends ALEventBus<AppEventMap> {
   *   analytics = this.use(analyticsPlugin()); // its api, e.g. analytics.flush()
   *
   *   constructor() {
   *     super();
   *     this.use(withLogger(), withCrossTabSync({ channel: 'my-app', keys: ['user:logout'] }));
   *   }
   * }
   * ```
   */
  protected use<TApi>(plugin: EventBusPlugin<TEventMap, THeaders, TApi>): TApi;
  protected use(...plugins: EventBusPlugin<TEventMap, THeaders, any>[]): void;
  protected use(...plugins: EventBusPlugin<TEventMap, THeaders, any>[]): unknown {
    const added = runInInjectionContext(this.#injector, () =>
      plugins.map((plugin) => plugin(this, this.#pluginContext) ?? {}),
    );
    this.#plugins.push(...added);
    this.#pipeline = this.#plugins.reduceRight<(event: AnyEvent) => void>(
      (next, plugin) => (plugin.handle ? (event) => runHandle(plugin, event, next) : next),
      (event) => this.#deliver(event),
    );
    return added.length === 1 ? added[0].api : undefined;
  }

  /**
   * Emits an event. Emits from inside a handler are delivered after the current event, in order.
   *
   * @example
   * ```ts
   * bus.emit('user:login', { userId: '42' });
   * bus.emit('user:logout');
   * bus.emit('user:logout', undefined, { headers: { reason: 'timeout' } });
   * ```
   */
  emit<K extends EventKey<TEventMap>>(...args: EmitArgs<TEventMap, K, THeaders>): void {
    if (this.#destroyed) return;
    const [key, payload, options] = args as unknown as [K, TEventMap[K], EmitOptions<THeaders> | undefined];
    const event: BusEvent<TEventMap[K], THeaders, K> = {
      key,
      payload,
      headers: options?.headers,
      origin: options?.origin ?? 'local',
      timestamp: Date.now(),
    };
    // Plugins and handlers are side effects: never let them become dependencies of a caller's
    // `computed` or `effect`.
    untracked(() => this.#pipeline(event));
  }

  /**
   * Runs `handler` for every delivered event of one or more keys.
   *
   * Stops automatically when the surrounding injection context (component, directive, service) is
   * destroyed, and additionally on `options.unsubscribeOn`. Outside an injection context, pass
   * `unsubscribeOn` or call the returned function. Errors thrown by the handler, or promises it
   * rejects, are logged and never affect other handlers.
   *
   * @example
   * ```ts
   * bus.on('user:login', (user) => this.loadProfile(user.userId));
   * bus.on(['cart:add', 'cart:clear'], (_, event) => this.track(event.key));
   * bus.on('item:added', handler, { unsubscribeOn: 'cart:cleared' });
   * ```
   * @returns A function that stops listening.
   */
  on<K extends EventKey<TEventMap>>(
    key: K | readonly K[],
    handler: (payload: TEventMap[K], event: EventFor<TEventMap, THeaders, K>) => unknown,
    options?: OnOptions<TEventMap>,
  ): () => void {
    const keys: readonly string[] = Array.isArray(key) ? key : [key as string];
    const unsubscribeOn = options?.unsubscribeOn;

    let contextDestroyRef: DestroyRef | null = null;
    try {
      contextDestroyRef = inject(DestroyRef, { optional: true });
    } catch {
      // Outside an injection context.
    }
    if (isDevMode() && !contextDestroyRef && unsubscribeOn === undefined) {
      console.warn(
        `[ALEventBus] on('${keys.join("', '")}') was called outside an injection context without ` +
          `'unsubscribeOn'. Call the returned function to stop it, or pass { unsubscribeOn: 'manual' } ` +
          `to silence this warning.`,
      );
    }

    const cleanups: (() => void)[] = [];
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      cleanups.forEach((cleanup) => cleanup());
    };

    if (unsubscribeOn !== 'manual') {
      // Register cleanup before attaching: a destroyed DestroyRef throws here, before anything leaks.
      for (const destroyRef of [contextDestroyRef, isDestroyRef(unsubscribeOn) ? unsubscribeOn : null]) {
        if (destroyRef) cleanups.push(destroyRef.onDestroy(stop));
      }
      if (isAbortSignal(unsubscribeOn)) {
        if (unsubscribeOn.aborted) {
          stop();
          return stop;
        }
        unsubscribeOn.addEventListener('abort', stop, { once: true });
        cleanups.push(() => unsubscribeOn.removeEventListener('abort', stop));
      }
      if (typeof unsubscribeOn === 'string' || Array.isArray(unsubscribeOn)) {
        const terminators: readonly string[] = Array.isArray(unsubscribeOn) ? unsubscribeOn : [unsubscribeOn];
        for (const terminator of terminators) cleanups.push(this.#subscribe(terminator, stop));
      }
    }

    const call = handler as (payload: unknown, event: AnyEvent) => unknown;
    for (const k of keys) {
      const subscriptionId = `${k}#${++this.#subscriptionCount}`;
      const listener: AnyListener = (event) => {
        const result = call(event.payload, event);
        if (result instanceof Promise) {
          result.catch((error) => console.error(`[ALEventBus] Async handler for "${event.key}" rejected.`, error));
        }
      };
      cleanups.push(this.#subscribe(k, listener, subscriptionId));
      this.#runHook('onSubscribe', (plugin) => plugin.onSubscribe?.(k as EventKey<TEventMap>, subscriptionId));
    }
    return stop;
  }

  /** Like `on`, but stops after the first delivered event. */
  once<K extends EventKey<TEventMap>>(
    key: K | readonly K[],
    handler: (payload: TEventMap[K], event: EventFor<TEventMap, THeaders, K>) => unknown,
    options?: OnOptions<TEventMap>,
  ): () => void {
    const stop = this.on(
      key,
      (payload, event) => {
        stop();
        return handler(payload, event);
      },
      options,
    );
    return stop;
  }

  /**
   * The latest delivered event of `key`, or `undefined` if none since creation or the last reset.
   * Reading it inside `computed`/`effect` tracks it.
   */
  latest<K extends EventKey<TEventMap>>(key: K): BusEvent<TEventMap[K], THeaders, K> | undefined {
    return this.#latestSignal(key)() as BusEvent<TEventMap[K], THeaders, K> | undefined;
  }

  /**
   * A signal of the latest payload of `key`, optionally transformed. Starts with the payload already
   * delivered (or `defaultValue` / `undefined`) and follows every new one.
   *
   * Signals compare by value: the same payload twice does not notify twice. Use `on()` or a
   * `projection()` when every occurrence matters.
   *
   * @example
   * ```ts
   * user = bus.onToSignal('user:login');                        // Signal<User | undefined>
   * name = bus.onToSignal('user:login', { transform: (u) => u.name, defaultValue: 'guest' });
   * ```
   */
  onToSignal<K extends EventKey<TEventMap>, TTransformed = TEventMap[K], TDefault = undefined>(
    key: K,
    options?: SignalOptions<TEventMap[K], TTransformed, TDefault>,
  ): Signal<ValueWithDefault<TTransformed, TDefault>> {
    const latest = this.#latestSignal(key);
    return computed(() => {
      const event = latest();
      if (!event) return options?.defaultValue as ValueWithDefault<TTransformed, TDefault>;
      const value = options?.transform ? options.transform(event.payload) : event.payload;
      return value as ValueWithDefault<TTransformed, TDefault>;
    });
  }

  /**
   * A signal of the latest payloads of several events as a typed tuple, or `undefined` until every
   * event has been delivered at least once.
   *
   * @example
   * ```ts
   * session = bus.combineLatestToSignal(['user:login', 'config:loaded']); // Signal<[User, Config] | undefined>
   * ```
   */
  combineLatestToSignal<const TKeys extends readonly EventKey<TEventMap>[]>(
    keys: TKeys,
  ): Signal<{ -readonly [I in keyof TKeys]: TEventMap[TKeys[I]] } | undefined> {
    const sources = keys.map((key) => this.#latestSignal(key));
    return computed(() => {
      const payloads: unknown[] = [];
      for (const source of sources) {
        const event = source();
        if (!event) return undefined;
        payloads.push(event.payload);
      }
      return payloads as { -readonly [I in keyof TKeys]: TEventMap[TKeys[I]] };
    });
  }

  /**
   * Runs `handler` with the latest payloads of all `keys` whenever one of them is delivered, once
   * every key has been delivered at least once. Cleanup works like `on()`.
   */
  combineLatest<const TKeys extends readonly EventKey<TEventMap>[]>(
    keys: TKeys,
    handler: (payloads: { -readonly [I in keyof TKeys]: TEventMap[TKeys[I]] }) => unknown,
    options?: OnOptions<TEventMap>,
  ): () => void {
    const combined = this.combineLatestToSignal(keys);
    return this.on(
      keys as readonly EventKey<TEventMap>[],
      () => {
        const payloads = untracked(combined);
        return payloads ? handler(payloads) : undefined;
      },
      options,
    );
  }

  /**
   * An Angular `ResourceRef` that runs `loader` every time `key` is delivered — even with an
   * identical payload — and aborts the previous load. Idle until the first event; `resetEvent(key)`
   * returns it to idle.
   *
   * @example
   * ```ts
   * profile = bus.onToResource('user:login', {
   *   transform: (user) => user.userId,
   *   loader: ({ params: userId, abortSignal }) =>
   *     fetch(`/api/users/${userId}`, { signal: abortSignal }).then((r) => r.json() as Promise<Profile>),
   * });
   * ```
   */
  onToResource<K extends EventKey<TEventMap>, TResponse, TTransformed = TEventMap[K], TDefault = undefined>(
    key: K,
    options: ResourceOptions<TEventMap[K], TTransformed, TResponse, TDefault>,
  ): ResourceRef<ValueWithDefault<TResponse, TDefault>> {
    const latest = this.#latestSignal(key);
    const transform = options.transform ?? ((payload: TEventMap[K]) => payload as unknown as TTransformed);

    return resource<TResponse | TDefault, { event: BusEvent<TEventMap[K]>; value: TTransformed } | undefined>({
      injector: options.injector,
      defaultValue: options.defaultValue as TDefault,
      // A fresh object per event, so every delivery reloads even when the payload is unchanged.
      params: () => {
        const event = latest() as BusEvent<TEventMap[K]> | undefined;
        return event ? { event, value: transform(event.payload) } : undefined;
      },
      loader: async ({ params, abortSignal }) => options.loader({ params: params.value, abortSignal, event: params.event }),
    }) as ResourceRef<ValueWithDefault<TResponse, TDefault>>;
  }

  /**
   * Creates state derived from events. Declare it as a field of your bus class. Every delivered event
   * runs its reducer (identical payloads count). Optionally keeps snapshots for undo/redo.
   *
   * @example
   * ```ts
   * export class AppEventBus extends ALEventBus<AppEventMap> {
   *   cart = this.projection({ items: [] as Item[] }, {
   *     'cart:add': (s, item) => ({ items: [...s.items, item] }),
   *     'cart:clear': () => ({ items: [] }),
   *   }, { undo: true });
   * }
   *
   * // cart.state(), cart.undo(), cart.redo(), cart.canUndo()
   * ```
   */
  protected projection<TState>(
    initial: TState,
    reducers: ProjectionReducers<TEventMap, NoInfer<TState>, THeaders>,
    options?: ProjectionOptions,
  ): Projection<TState> {
    return createProjection(initial, reducers, options, (key, listener) => this.#subscribe(key, listener));
  }

  /** Forgets the latest payload of `key`. Signals return to their default, resources to idle. */
  resetEvent<K extends EventKey<TEventMap>>(key: K, options?: { origin?: string }): void {
    this.#latest.get(key)?.set(undefined);
    this.#notifyReset(key, options?.origin ?? 'local');
  }

  /** Forgets the latest payload of every event. Handlers and projections are unaffected. */
  resetAllEvents(options?: { origin?: string }): void {
    this.#latest.forEach((latest) => latest.set(undefined));
    this.#notifyReset(undefined, options?.origin ?? 'local');
  }

  /** Stops every handler of `key` across the app, including projections. Prefer the function returned by `on()`. */
  unsubscribe<K extends EventKey<TEventMap>>(key: K): void {
    const listeners = this.#listeners.get(key);
    this.#listeners.delete(key);
    listeners?.forEach((id) => id && this.#notifyUnsubscribe(key, id));
  }

  /** Stops every handler, including projections. Mostly useful in tests. */
  unsubscribeAll(): void {
    [...this.#listeners.keys()].forEach((key) => this.unsubscribe(key as EventKey<TEventMap>));
  }

  #subscribe(key: string, listener: AnyListener, subscriptionId: string | null = null): () => void {
    let listeners = this.#listeners.get(key);
    if (!listeners) this.#listeners.set(key, (listeners = new Map()));
    listeners.set(listener, subscriptionId);
    return () => {
      // Already gone after unsubscribe(key) / unsubscribeAll(), which notified plugins themselves.
      if (this.#listeners.get(key)?.delete(listener) && subscriptionId) this.#notifyUnsubscribe(key, subscriptionId);
    };
  }

  #notifyUnsubscribe(key: string, subscriptionId: string): void {
    this.#runHook('onUnsubscribe', (plugin) => plugin.onUnsubscribe?.(key as EventKey<TEventMap>, subscriptionId));
  }

  #runHook(name: string, run: (plugin: PluginHooks<TEventMap, THeaders, unknown>) => void): void {
    for (const plugin of this.#plugins) {
      try {
        run(plugin);
      } catch (error) {
        console.error(`[ALEventBus] Plugin ${name}() threw.`, error);
      }
    }
  }

  #latestSignal(key: string): WritableSignal<AnyEvent | undefined> {
    let latest = this.#latest.get(key);
    if (!latest) this.#latest.set(key, (latest = signal<AnyEvent | undefined>(undefined)));
    return latest;
  }

  #notifyReset(key: EventKey<TEventMap> | undefined, origin: string): void {
    this.#runHook('onReset', (plugin) => plugin.onReset?.(key, origin));
  }

  #deliver(event: AnyEvent): void {
    if (this.#destroyed) return;
    this.#queue.push(event);
    if (this.#delivering) return;

    this.#delivering = true;
    try {
      untracked(() => {
        while (this.#queue.length > 0) {
          const next = this.#queue.shift()!;
          this.#latestSignal(next.key).set(next);
          for (const listener of [...(this.#listeners.get(next.key)?.keys() ?? [])]) {
            try {
              listener(next);
            } catch (error) {
              console.error(`[ALEventBus] Handler for "${next.key}" threw.`, error);
            }
          }
          this.#runHook('onAfterEmit', (plugin) => plugin.onAfterEmit?.(next as never));
        }
      });
    } finally {
      this.#delivering = false;
      // Empty after a normal drain; after an unexpected throw, don't replay leftovers on a later emit.
      this.#queue.length = 0;
    }
  }
}

function runHandle(plugin: PluginHooks<any, any, unknown>, event: AnyEvent, next: (event: AnyEvent) => void): void {
  let passed = false;
  try {
    plugin.handle!(event as never, (e) => {
      passed = true;
      next(e);
    });
  } catch (error) {
    console.error(`[ALEventBus] Plugin handle() threw for "${event.key}"; passing the event on unchanged.`, error);
    // Fail open: a broken logger or analytics plugin must not swallow events.
    if (!passed) next(event);
  }
}

function isDestroyRef(value: unknown): value is DestroyRef {
  return typeof (value as DestroyRef | undefined)?.onDestroy === 'function';
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return typeof AbortSignal !== 'undefined' && value instanceof AbortSignal;
}
