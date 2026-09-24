import { DestroyRef, Injector, Signal } from '@angular/core';
import type { ALEventBus } from './event-bus';

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
  /** `'local'` for `emit()`; `'remote'` for events received by `withCrossTabSync()`. */
  readonly origin: 'local' | 'remote' | (string & {});
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

/** Passes an event on to the next middleware, or to listeners at the end of the pipeline. */
export type Next<TEventMap, THeaders extends object = Record<string, unknown>> = (event: EventOf<TEventMap, THeaders>) => void;

/**
 * Middleware sees every event before listeners. It can pass it on (`next(event)`), change it
 * (`next({ ...event, payload })`), drop it (not calling `next`) or defer it (calling `next` later).
 * A deferred event continues from the same point, so later middleware sees it exactly once.
 */
export interface Middleware<TEventMap = any, THeaders extends object = Record<string, unknown>> {
  handle(event: EventOf<TEventMap, THeaders>, next: Next<TEventMap, THeaders>): void;
  /** Called after `resetEvent(key)` (`key` set) or `resetAllEvents()` (`key` undefined). */
  onReset?(key: EventKey<TEventMap> | undefined, origin: string): void;
  /** Called when the bus is destroyed. */
  destroy?(): void;
}

/** Runs once when passed to `use()`, in the bus's injection context. May return middleware. */
export type EventBusFeature<TEventMap extends object = any, THeaders extends object = Record<string, unknown>> = (
  bus: ALEventBus<TEventMap, THeaders>,
) => Middleware<TEventMap, THeaders> | void;

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
