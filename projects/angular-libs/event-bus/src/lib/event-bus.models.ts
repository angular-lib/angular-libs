import { DestroyRef, Injector, Signal } from '@angular/core';
import type { ALEventBus } from './event-bus';
import type { StorageOptions } from './storage';

/** The string keys of an event map. */
export type EventKey<TEventMap> = Extract<keyof TEventMap, string>;

/** A delivered event. */
export interface BusEvent<
  TPayload = unknown,
  THeaders extends object = Record<string, unknown>,
  TKey extends string = string,
> {
  readonly key: TKey;
  readonly payload: TPayload;
  /** Optional metadata passed with `emit(key, payload, { headers })`. */
  readonly headers?: THeaders;
  /**
   * `'local'` for `emit()`, `'remote'` for events received by `withCrossTabSync()`, `'storage'` for
   * values restored by `withPersistence()`.
   */
  readonly origin: 'local' | 'remote' | 'storage' | (string & {});
  readonly timestamp: number;
}

/**
 * Any event of an event map, as a union discriminated by `key`:
 * `if (event.key === 'user:login') event.payload.userId`.
 */
export type EventOf<TEventMap, THeaders extends object = Record<string, unknown>> = {
  [K in EventKey<TEventMap>]: BusEvent<TEventMap[K], THeaders, K>;
}[EventKey<TEventMap>];

export interface EmitOptions<THeaders extends object = Record<string, unknown>> {
  headers?: THeaders;
  /** Marks where the event came from. Defaults to `'local'`; bridges set e.g. `'remote'`. */
  origin?: string;
}

/** `emit` arguments: the payload may be omitted for `void` events. */
export type EmitArgs<TEventMap, K extends keyof TEventMap, THeaders extends object> = TEventMap[K] extends void | undefined
  ? [key: K] | [key: K, payload: undefined, options?: EmitOptions<THeaders>]
  : [key: K, payload: TEventMap[K], options?: EmitOptions<THeaders>];

/**
 * When a subscription stops, besides the surrounding injection context's `DestroyRef`
 * (which always applies unless `'manual'`):
 * - `'manual'`: only when you call the returned function.
 * - A `DestroyRef` or `AbortSignal`.
 * - One or more event keys: when any of them is emitted.
 */
export type UnsubscribeOn<TEventMap> = 'manual' | DestroyRef | AbortSignal | EventKey<TEventMap> | readonly EventKey<TEventMap>[];

export interface OnOptions<TEventMap> {
  unsubscribeOn?: UnsubscribeOn<TEventMap>;
}

/** Passes an event on to the next plugin's `handle`, or to handlers at the end of the chain. */
export type Next<TEventMap, THeaders extends object = Record<string, unknown>> = (event: EventOf<TEventMap, THeaders>) => void;

/**
 * What a plugin does. Every hook is optional.
 *
 * - `handle` intercepts events before handlers: pass on (`next(event)`), change
 *   (`next({ ...event, payload })`), drop (don't call `next`) or defer (call `next` later — the event
 *   continues from the same point, so later plugins see it exactly once).
 * - `onAfterEmit` observes an event after every handler has received it.
 * - `api` is returned by `use()`, so a plugin can expose methods on your bus.
 */
export interface PluginHooks<TEventMap = any, THeaders extends object = Record<string, unknown>, TApi = void> {
  handle?(event: EventOf<TEventMap, THeaders>, next: Next<TEventMap, THeaders>): void;
  /** Called after every handler has received `event`, including events emitted from handlers. */
  onAfterEmit?(event: EventOf<TEventMap, THeaders>): void;
  /** Called when `on()` / `once()` / `combineLatest()` start listening to `key`. */
  onSubscribe?(key: EventKey<TEventMap>, subscriptionId: string): void;
  /** Called when that subscription stops, for whatever reason. */
  onUnsubscribe?(key: EventKey<TEventMap>, subscriptionId: string): void;
  /** Called after `resetEvent(key)` (`key` set) or `resetAllEvents()` (`key` undefined). */
  onReset?(key: EventKey<TEventMap> | undefined, origin: string): void;
  /** Called when the bus is destroyed. */
  destroy?(): void;
  /** Returned by `use(plugin)`. */
  api?: TApi;
}

/** Extra capabilities handed to plugins. */
export interface PluginContext<TEventMap, THeaders extends object = Record<string, unknown>> {
  /**
   * Sets the latest event of `key` without running handlers or plugins, so signals, `latest()` and
   * resources see it (with `origin: 'storage'`). For restoring saved state. Ignored when `key`
   * already has an event.
   */
  hydrate<K extends EventKey<TEventMap>>(key: K, payload: TEventMap[K], options?: { headers?: THeaders; timestamp?: number }): void;
}

/**
 * A plugin: runs once when passed to `use()`, in the bus's injection context (so it can `inject()`),
 * and returns its hooks.
 */
export type EventBusPlugin<TEventMap extends object = any, THeaders extends object = Record<string, unknown>, TApi = void> = (
  bus: ALEventBus<TEventMap, THeaders>,
  context: PluginContext<TEventMap, THeaders>,
) => PluginHooks<TEventMap, THeaders, TApi> | void;

export interface SignalOptions<TPayload, TTransformed, TDefault> {
  transform?: (payload: TPayload) => TTransformed;
  defaultValue?: TDefault;
}

export interface ResourceOptions<TPayload, TTransformed, TResponse, TDefault> {
  /** Maps the payload to the loader's `params`. Defaults to the payload itself. */
  transform?: (payload: TPayload) => TTransformed;
  loader: (ctx: { params: TTransformed; abortSignal: AbortSignal; event: BusEvent<TPayload> }) => Promise<TResponse> | TResponse;
  /** Value while idle (before the first event, or after `resetEvent`). */
  defaultValue?: TDefault;
  /** Needed outside an injection context. */
  injector?: Injector;
}

/** Reducers of a projection, one per event key it reacts to. */
export type ProjectionReducers<TEventMap, TState, THeaders extends object = Record<string, unknown>> = {
  [K in EventKey<TEventMap>]?: (state: TState, payload: TEventMap[K], event: BusEvent<TEventMap[K], THeaders, K>) => TState;
};

export interface ProjectionOptions {
  /** Keep snapshots for undo/redo. `true` keeps 50. */
  undo?: boolean | { limit: number };
  /**
   * Save the state to storage and restore it on startup. A string is the storage key; the object
   * form adds `version`, `storage`, `serialize` and `deserialize`. Undo history is not saved.
   */
  persist?: string | ({ key: string } & StorageOptions);
}

/** State derived from events. Returned by `projection()` inside your bus class. */
export interface Projection<TState> {
  readonly state: Signal<TState>;
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;
  /** Restores the previous state. Returns `false` when there is nothing to undo (or undo is off). */
  undo(): boolean;
  /** Re-applies the last undone state. Returns `false` when there is nothing to redo. */
  redo(): boolean;
  /** Forgets undo/redo history, keeping the current state. */
  clearHistory(): void;
  /** Returns to the initial state and forgets history. */
  reset(): void;
}
