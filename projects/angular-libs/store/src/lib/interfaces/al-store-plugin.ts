import { IALStore } from './ial-store';

/**
 * Interface that all ALStore plugins must implement.
 * Plugins can react to key lifecycle phases or intercept and modify values before they are written.
 */
export interface ALStorePlugin<T extends Record<string, any> = Record<string, any>> {
  /**
   * Called immediately when registering the plugin in the store.
   * Gives the plugin access to the store reference so it can read/write data, register effect contexts, etc.
   * May be async (e.g. hydrating from IndexedDB / SQLite); the store does not await it.
   */
  onInit?(store: IALStore<T>): void | Promise<void>;

  /**
   * Called before a property value changes in the store.
   * If provided, the return value of this function will override the actual value committed to the store.
   */
  onBeforeUpdate?(key: keyof T, prevValue: any, newValue: any): any;

  /**
   * Called after a property value changes in the store.
   * Ideal for recording histories, writing side effects, triggering logs, syncing with storage, etc.
   */
  onAfterUpdate?(key: keyof T, prevValue: any, newValue: any): void;

  /**
   * Called when the store is destroyed (via Angular `DestroyRef`).
   * Use for unsubscribing from sockets, closing DB handles, or clearing timers.
   */
  onDestroy?(): void;
}
