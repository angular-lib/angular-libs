import {
  signal,
  WritableSignal,
  Signal,
  Injectable,
  DestroyRef,
  inject,
  computed,
  isDevMode,
} from '@angular/core';
import { SyncMessage } from './sync-message';
import { ALStoreConfig, ALStorePlugin } from './interfaces';
import { IALStore } from './interfaces/ial-store';

/**
 * `ALStore` is an abstract base class for creating reactive state management services in Angular using Signals.
 * It provides a centralized, type-safe store for managing application or feature state, with built-in support for
 * cross-tab synchronization via `BroadcastChannel`.
 *
 * * Key Features:
 * - **Reactive State**: Exposes state as Angular Signals (`getSignal`) for seamless integration with templates and `computed`/`effect` functions.
 * - **Plugins**: Utilize `entityPlugin()` for CRUD array operations, `resourcePlugin()` to bridge with async HTTP requests seamlessly, or `historyPlugin()` for instant undo/redo capabilities.
 * - **Synchronous Access**: Allows imperative read/write operations (`get`, `set`, `update`) for non-reactive contexts.
 * - **Cross-Tab Sync**: Automatically synchronizes state changes across browser windows/tabs when a `syncChannel` is provided.
 * - **Initial State Management**: Preserves default values, allowing safe fallback when state items are reset.
 *
 * @example
 * ```ts
 * // 1. Define your complete state shape
 * interface AppState {
 *   theme: 'light' | 'dark';
 *   users: User[];
 *   profile: UserProfile | null;
 *   selectedUserId: number;
 *   document: string;
 * }
 *
 * const initialState: AppState = {
 *   theme: 'light',
 *   users: [],
 *   profile: null,
 *   selectedUserId: 1,
 *   document: ''
 * };
 *
 * // 2. Create a typed service utilizing both primitive state and plugins
 * @Injectable({ providedIn: 'root' })
 * export class AppStore extends ALStore<AppState> {
 *   // Array CRUD operations bound to 'users'
 *   usersAdapter = this.registerPlugin(entityPlugin('users', { idField: 'id' }));
 *
 *   // Async data fetching bound to 'profile', refetching when 'selectedUserId' changes
 *   profileResource = this.registerPlugin(resourcePlugin('profile', {
 *     params: () => ({ id: this.getSignal('selectedUserId')() }),
 *     loader: async ({ params, abortSignal }) => fetchProfile(params.id, abortSignal)
 *   }));
 *
 *   // Undo/redo tracking bound to 'document'
 *   documentHistory = this.registerPlugin(historyPlugin('document', { limit: 10 }));
 *
 *   constructor() {
 *     super(initialState, { syncChannel: 'app_store_sync' });
 *   }
 * }
 *
 * // 3. Inject and use fluently in your components
 * @Component({ ... })
 * export class MyComponent {
 *   private store = inject(AppStore);
 *
 *   // Reactive: A readonly Signal that auto-updates
 *   theme = this.store.getSignal('theme');
 *
 *   // Accessing composed adapter functionality cleanly:
 *   addUser(user: User) {
 *     this.store.usersAdapter.addOne(user);
 *   }
 *
 *   undoTyping() {
 *     this.store.documentHistory.undo();
 *   }
 *
 *   toggleTheme() {
 *     this.store.update('theme', current => current === 'light' ? 'dark' : 'light');
 *   }
 * }
 * ```
 *
 * @template T A record type representing the structure of the store's state.
 */
@Injectable()
export abstract class ALStore<T extends Record<string, any> = {}> implements IALStore<T> {
  protected initialState: T;
  private state: Partial<T> = {};
  private signals = new Map<keyof T, WritableSignal<any>>();
  private plugins: ALStorePlugin<T>[] = [];
  private channel?: BroadcastChannel;
  private destroyRef: DestroyRef | null = null;

  /**
   * Registers a plugin to extend the store functionality.
   * Plugins can react to key lifecycle phases or intercept/modify values before they are written.
   * 
   * **AI Agent & Developer Instructions for Building Plugins:**
   * 1. **Contract**: Implement `ALStorePlugin<T>`.
   * 2. **Lifecycle Hooks**:
   *    - `onInit(store)`: Called immediately on registration. Gives the plugin access to the `ALStore` reference.
   *    - `onBeforeUpdate(key, prevValue, newValue)`: Called before a property value changes. Return a new value to override what gets written to the state.
   *    - `onAfterUpdate(key, prevValue, newValue)`: Called after a property value changes. Perfect for tracking history, writing side effects, syncing to storage, logging, etc.
   *    - `onDestroy()`: Called when the store is destroyed. Use for cleanup (subscriptions, DB handles).
   * 3. **Registration Pattern**:
   *    - **Active Plugins**: (e.g., entity, resource, history plugins) that expose API methods should be registered as class fields/properties to allow direct access (e.g., `this.users.add(item)`).
   *    - **Passive Plugins**: (e.g., logging, persistence, or sync plugins) that run completely in the background should be registered directly within the subclass `constructor`.
   * 
   * @example
   * ```typescript
   * // 1. Create your passive plugin via a factory function (conforming to functional design patterns in this library)
   * export function myLoggerPlugin(): ALStorePlugin<any> {
   *   return {
   *     onInit(store) {
   *       console.log('Store Plugin initialised');
   *     },
   *     onAfterUpdate(key, prev, next) {
   *       console.log(`State change [${String(key)}]:`, prev, '->', next);
   *     }
   *   };
   * }
   * 
   * // 2. Register passive plugins in constructor, active plugins as subclass properties
   * @Injectable({ providedIn: 'root' })
   * export class AppStore extends ALStore<AppState> {
   *   // Active plugin with programmatic API
   *   users = this.registerPlugin(entityPlugin('users', { idField: 'id' }));
   * 
   *   constructor() {
   *     super(initialState);
   *     
   *     // Passive plugin (logs in the background, no properties needed on class instance)
   *     this.registerPlugin(myLoggerPlugin());
   *   }
   * }
   * ```
   * 
   * @param plugin The plugin instance satisfying `ALStorePlugin`.
   * @returns The registered plugin instance.
   */
  protected registerPlugin<P extends ALStorePlugin<T>>(plugin: P): P {
    plugin.onInit?.(this);
    this.plugins.push(plugin);
    return plugin;
  }

  constructor(initialState?: T, config?: ALStoreConfig) {
    try {
      this.destroyRef = inject(DestroyRef, { optional: true });
    } catch {
      // Soft fallback if instantiated outside an active injection context
    }
    this.initialState = initialState || ({} as T);
    const { syncChannel } = config || {};
    if (syncChannel && typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(syncChannel);

      this.channel.onmessage = (event: MessageEvent<SyncMessage<T>>) => {
        const data = event.data;
        switch (data.action) {
          case 'set':
            if (data.key !== undefined) {
              this.internalSet(data.key, data.value as any);
            }
            break;
          case 'reset':
            this.internalReset(data.key);
            break;
          case 'patchState':
            if (data.partialState) {
              this.internalPatchState(data.partialState);
            }
            break;
        }
      };
    }

    this.destroyRef?.onDestroy(() => {
      this.channel?.close();
      this.runOnDestroy();
    });
  }

  /**
   * Runs every plugin's `onDestroy` hook.
   * Errors are isolated so one failing plugin does not block others.
   */
  private runOnDestroy(): void {
    for (const plugin of this.plugins) {
      if (!plugin.onDestroy) continue;
      try {
        plugin.onDestroy();
      } catch (e) {
        console.error('[ALStore] Plugin onDestroy threw.', e);
      }
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return key in this.state ? (this.state[key] as T[K]) : (this.initialState?.[key] as T[K]);
  }

  getSignal<K extends keyof T>(key: K): Signal<T[K]> {
    if (!this.signals.has(key)) {
      this.signals.set(key, signal(this.get(key)));
    }
    return this.signals.get(key)!.asReadonly();
  }

  select<R>(projector: (state: T) => R): Signal<R> {
    const self = this;
    return computed(() => {
      // Subscribe to every known key so `in`, `Object.keys`, and spread stay reactive.
      const known = new Set<string | symbol>([
        ...Object.keys(self.initialState || {}),
        ...Object.keys(self.state),
      ]);
      for (const k of known) {
        self.getSignal(k as keyof T)();
      }

      const stateProxy = new Proxy({} as T, {
        get: (_, prop: string | symbol) => {
          return self.getSignal(prop as keyof T)();
        },
        has: (_, prop: string | symbol) => {
          if (typeof prop === 'string') {
            self.getSignal(prop as keyof T)();
          }
          return prop in self.state || prop in self.initialState;
        },
        ownKeys: () => Reflect.ownKeys({ ...self.initialState, ...self.state }),
        getOwnPropertyDescriptor: (_, prop: string | symbol) => {
          if (typeof prop === 'symbol') return undefined;
          if (prop in self.state || prop in self.initialState) {
            return {
              enumerable: true,
              configurable: true,
              get: () => self.getSignal(prop as keyof T)(),
            };
          }
          return undefined;
        },
      });
      return projector(stateProxy);
    });
  }

  private safePostMessage(data: SyncMessage<T>): void {
    try {
      this.channel?.postMessage(data);
    } catch (err) {
      if (isDevMode()) {
        console.warn('[ALStore] BroadcastChannel.postMessage failed (value may not be structured-cloneable).', err);
      }
    }
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    if (value === undefined) {
      return this.reset(key);
    }
    this.internalSet(key, value);
    this.safePostMessage({ action: 'set', key, value });
  }

  private internalSet<K extends keyof T>(key: K, value: T[K]): void {
    const prevValue = this.get(key);
    const finalValue = this.runOnBeforeUpdate(key, prevValue, value);
    this.state[key] = finalValue;
    this.updateSignal(key, finalValue);
    this.runOnAfterUpdate(key, prevValue, finalValue);
  }

  /**
   * Runs every plugin's `onBeforeUpdate` hook for the given key, threading the (possibly
   * transformed) value through each plugin in registration order.
   *
   * A plugin that throws is isolated: its error is logged and its contribution to `finalValue`
   * is discarded, but every other registered plugin still runs for this update.
   */
  private runOnBeforeUpdate<K extends keyof T>(key: K, prevValue: T[K], value: T[K]): T[K] {
    let finalValue = value;
    for (const plugin of this.plugins) {
      if (!plugin.onBeforeUpdate) continue;
      try {
        const result = plugin.onBeforeUpdate(key, prevValue, finalValue);
        if (result !== undefined) {
          finalValue = result;
        }
      } catch (e) {
        console.error(
          `[ALStore] Plugin onBeforeUpdate threw for key "${String(key)}"; ignoring this plugin's contribution for this update.`,
          e,
        );
      }
    }
    return finalValue;
  }

  /**
   * Runs every plugin's `onAfterUpdate` hook for the given key.
   *
   * A plugin that throws is isolated: its error is logged, but every other registered plugin
   * still runs for this update.
   */
  private runOnAfterUpdate<K extends keyof T>(key: K, prevValue: T[K], newValue: T[K]): void {
    for (const plugin of this.plugins) {
      if (!plugin.onAfterUpdate) continue;
      try {
        plugin.onAfterUpdate(key, prevValue, newValue);
      } catch (e) {
        console.error(`[ALStore] Plugin onAfterUpdate threw for key "${String(key)}".`, e);
      }
    }
  }

  update<K extends keyof T>(key: K, updateFn: (currentValue: T[K]) => T[K]): void {
    const currentValue = this.get(key);
    const newValue = updateFn(currentValue);
    this.set(key, newValue);
  }

  snapshot(): T {
    return { ...this.initialState, ...this.state } as T;
  }

  patchState(stateOrUpdater: Partial<T> | ((state: T) => Partial<T>)): void {
    const partialState =
      typeof stateOrUpdater === 'function' ? stateOrUpdater(this.snapshot()) : stateOrUpdater;

    this.internalPatchState(partialState);
    this.safePostMessage({ action: 'patchState', partialState });
  }

  private internalPatchState(partialState: Partial<T>): void {
    for (const [key, value] of Object.entries(partialState)) {
      if (value === undefined) {
        this.internalReset(key as keyof T);
      } else {
        this.internalSet(key as keyof T, value as any);
      }
    }
  }

  reset<K extends keyof T>(key?: K): void {
    this.internalReset(key);
    this.safePostMessage({ action: 'reset', key });
  }

  /**
   * Safe getter to expose the resolved `IALStore<T>` type upcast to adapters.
   * Useful when composing adapters locally in the constructor or property initializers
   * because TypeScript's deferred inference on `this` often produces fallback generic types.
   */
  protected get storeRef(): IALStore<T> {
    return this;
  }

  private internalReset<K extends keyof T>(key?: K): void {
    if (key !== undefined) {
      const prevValue = this.get(key);
      const initialVal = this.initialState?.[key];
      const finalValue = this.runOnBeforeUpdate(key, prevValue, initialVal);
      delete this.state[key];
      if (finalValue !== initialVal) {
        this.state[key] = finalValue as any;
      }
      this.updateSignalWithInitialState(key);
      if (finalValue !== initialVal) {
        this.updateSignal(key, finalValue);
      }
      this.runOnAfterUpdate(key, prevValue, finalValue);
    } else {
      const prevSnapshot = this.snapshot();
      this.state = {};
      const keysArray = Array.from(new Set([...Object.keys(this.initialState || {}), ...Object.keys(prevSnapshot)])) as (keyof T)[];
      for (const k of keysArray) {
        const prevValue = prevSnapshot[k];
        const initialVal = this.initialState?.[k];
        const finalValue = this.runOnBeforeUpdate(k, prevValue, initialVal);
        if (finalValue !== initialVal) {
          this.state[k] = finalValue as any;
        }
        this.updateSignalWithInitialState(k);
        if (finalValue !== initialVal) {
          this.updateSignal(k, finalValue);
        }
        this.runOnAfterUpdate(k, prevValue, finalValue);
      }
    }
  }

  private updateSignal(key: keyof T, value: any): void {
    if (this.signals.has(key)) {
      this.signals.get(key)!.set(value);
    }
  }

  private updateSignalWithInitialState(key: keyof T): void {
    if (this.signals.has(key)) {
      this.signals.get(key)!.set(this.initialState?.[key]);
    }
  }
}
