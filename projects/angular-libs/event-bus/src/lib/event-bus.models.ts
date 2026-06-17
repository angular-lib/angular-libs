import { DestroyRef, Signal } from '@angular/core';
import { TransformedEvents } from './event-bus.internal';

/**
 * Base configuration for transforming an event's payload.
 * @template TPayload The type of the original event payload.
 * @template TTransformed The type of the transformed payload.
 */
export interface TransformOptions<TPayload, TTransformed> {
  /** Transform the event payload. */
  transform?: (payload: TPayload) => TTransformed;
}

/**
 * Configuration for the callback-based `on` and `once` methods.
 */
export interface SubscriptionOptions<
  TPayload,
  TTransformed,
  THeaders extends Record<string, any> = Record<string, any>,
> extends TransformOptions<TPayload, TTransformed> {
  /** The callback that executes when the event triggers. */
  callback: (event: BusEvent<TTransformed, THeaders>) => void | Promise<void>;
  /**
   * **AI Hint**: Controls when the subscription is automatically cleaned up.
   * - By default (`undefined`), if called in an injection context (e.g. constructor or field initializer),
   *   it automatically resolves the context's `DestroyRef` to auto-unsubscribe on destruction.
   * - Pass `'manual'` to bypass automatic injection-context cleanup entirely.
   * - Pass an explicit `DestroyRef` instance.
   * - Pass an event key or an array of keys (e.g. `'user:logout'`) to auto-unsubscribe when any of those events fire.
   */
  unsubscribeOn?: DestroyRef | 'manual' | string | string[];
}

/**
 * Defines a single event source for `combineLatest` methods.
 */
export interface CombineLatestSource<
  TPayload = any,
  TTransformed = TPayload,
> extends TransformOptions<TPayload, TTransformed> {
  key: string;
}

/**
 * Configuration for the callback-based `combineLatest` method.
 */
export interface CombineLatestOptions<
  TSources extends readonly CombineLatestSource[],
> {
  sources: TSources;
  callback: (events: TransformedEvents<TSources>) => void | Promise<void>;
}

export interface BusEvent<TPayload, THeaders extends Record<string, any> = Record<string, any>> {
  /** The event key. */
  key: string;
  /** The event payload. */
  payload: TPayload;
  /** The event timestamp. */
  timestamp: number;
  /** Transient metadata context passed along with the event emission. */
  headers?: THeaders;
}

/**
 * Options configurable during an event emission.
 */
export interface EmitOptions<THeaders extends Record<string, any> = Record<string, any>> {
  /** Optional metadata headers accompanying the payload. */
  headers?: THeaders;
}

/**
 * Minimal interface of the event bus exposed to plugins.
 */
export interface IALEventBus<TEventMap extends {}, THeaders extends Record<string, any> = Record<string, any>> {
  emit<K extends keyof TEventMap>(
    ...args: TEventMap[K] extends void | undefined
      ? [key: K, options?: EmitOptions<THeaders>]
      : [key: K, payload: TEventMap[K], options?: EmitOptions<THeaders>]
  ): void;
  latest<K extends keyof TEventMap>(key: K): BusEvent<TEventMap[K], THeaders> | undefined;
  resetEvent<K extends keyof TEventMap>(key: K): void;
  resetAllEvents(): void;
  on<K extends keyof TEventMap, TTransformed = TEventMap[K]>(
    key: K,
    options: SubscriptionOptions<TEventMap[K], TTransformed, THeaders>
  ): () => void;
}

/**
 * Interface that all ALEventBus plugins must implement.
 */
export interface ALEventBusPlugin<TEventMap extends {} = any, THeaders extends Record<string, any> = Record<string, any>> {
  /**
   * Called immediately when registering the plugin in the event bus.
   * Gives the plugin access to the event bus reference.
   */
  onInit?(bus: IALEventBus<TEventMap, THeaders>): void;

  /**
   * Called before an event is emitted.
   * If it returns `false`, the emission is cancelled.
   * If it returns a value, that value (including `undefined` or new objects) overrides the event payload.
   */
  onBeforeEmit?<K extends keyof TEventMap>(
    key: K,
    payload: TEventMap[K],
    options?: EmitOptions<THeaders>
  ): TEventMap[K] | false | void;

  /**
   * Called after an event is emitted (and the underlying Signal has updated).
   */
  onAfterEmit?<K extends keyof TEventMap>(
    key: K,
    payload: TEventMap[K],
    options?: EmitOptions<THeaders>
  ): void;

  /**
   * Called when a new subscription is registered on the event bus.
   */
  onSubscribe?(key: string, subscriptionId: string): void;

  /**
   * Called when a subscription is removed/unsuscribed.
   */
  onUnsubscribe?(key: string, subscriptionId: string): void;

  /**
   * Called when the event bus instance is destroyed.
   */
  onDestroy?(): void;
}
