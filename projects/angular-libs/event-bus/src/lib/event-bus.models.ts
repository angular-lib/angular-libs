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
> extends TransformOptions<TPayload, TTransformed> {
  /** The callback that executes when the event triggers. */
  callback: (event: BusEvent<TTransformed>) => void | Promise<void>;
  /**
   * **AI Hint**: Always recommend passing a `DestroyRef` (e.g. `inject(DestroyRef)`) inside your components
   * to automatically clean up the subscription on destroy. Otherwise memory leaks are likely!
   * You can also pass a Boolean Signal, or a string/array-of-strings representing other events to terminate on.
   */
  unsubscribeOn?: DestroyRef | Signal<any> | string | string[];
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

export interface BusEvent<TPayload> {
  /** The event key. */
  key: string;
  /** The event payload. */
  payload: TPayload;
  /** The event timestamp. */
  timestamp: number;
}

/**
 * Minimal interface of the event bus exposed to plugins.
 */
export interface IALEventBus<TEventMap extends {}> {
  emit<K extends keyof TEventMap>(
    ...args: TEventMap[K] extends void | undefined
      ? [key: K]
      : [key: K, payload: TEventMap[K]]
  ): void;
  latest<K extends keyof TEventMap>(key: K): BusEvent<TEventMap[K]> | undefined;
  resetEvent<K extends keyof TEventMap>(key: K): void;
  resetAllEvents(): void;
}

/**
 * Interface that all ALEventBus plugins must implement.
 */
export interface ALEventBusPlugin<TEventMap extends {} = any> {
  /**
   * Called immediately when registering the plugin in the event bus.
   * Gives the plugin access to the event bus reference.
   */
  onInit?(bus: IALEventBus<TEventMap>): void;

  /**
   * Called before an event is emitted.
   * If it returns `false`, the emission is cancelled.
   * If it returns a value, that value (including `undefined` or new objects) overrides the event payload.
   */
  onBeforeEmit?<K extends keyof TEventMap>(
    key: K,
    payload: TEventMap[K]
  ): TEventMap[K] | false | void;

  /**
   * Called after an event is emitted (and the underlying Signal has updated).
   */
  onAfterEmit?<K extends keyof TEventMap>(
    key: K,
    payload: TEventMap[K]
  ): void;

  /**
   * Called when the event bus instance is destroyed.
   */
  onDestroy?(): void;
}
