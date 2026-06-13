import { signal, Signal, DestroyRef, inject } from '@angular/core';
import { ALStorePlugin } from '../interfaces/al-store-plugin';
import { IALStore } from '../interfaces/ial-store';

/**
 * Configuration options for the robust IndexedDB state persistence plugin.
 */
export interface IndexedDBPluginOptions {
  /** The name of the IndexedDB database. Defaults to 'al-store-db'. */
  dbName?: string;
  /** The name of the object store. Defaults to 'state-store'. */
  storeName?: string;
  /** The schema/database version of IndexedDB. Defaults to 1. */
  version?: number;
  /**
   * If true, enables live cross-tab synchronization using the browser's `BroadcastChannel` API.
   * This ensures state updates are mirrored across all active browser windows or tabs.
   * 
   * @default true
   */
  broadcast?: boolean;
}

export interface IndexedDBPlugin<T extends Record<string, any>> extends ALStorePlugin<T> {
  /** Reactive signal indicating when hydration from IndexedDB is complete and ready */
  isReady: Signal<boolean>;
}

/**
 * Creates a robust, functional IndexedDB state persistence plugin.
 * It asynchronously hydrates targeted state keys from an IndexedDB database
 * and writes updates without blocking or class inheritance.
 *
 * @template StoreState The overall state structure of the store.
 *
 * @param keys The keys inside the state to persist.
 * @param options Configurations including dbName, storeName, and version.
 *
 * @example
 * ```ts
 * interface AppState {
 *   theme: 'light' | 'dark';
 *   tasks: Task[];
 * }
 * const initialState: AppState = { theme: 'light', tasks: [] };
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppStore extends ALStore<AppState> {
 *   // Automatically saves 'tasks' in IndexedDB under custom credentials
 *   tasksDb = this.registerPlugin(
 *     indexedDBPlugin(['tasks'], { storeName: 'tasks-store' })
 *   );
 *
 *   constructor() {
 *     super(initialState);
 *   }
 * }
 * ```
 */
export function indexedDBPlugin<StoreState extends Record<string, any>>(
  keys: (keyof StoreState)[] | 'all',
  options?: IndexedDBPluginOptions
): IndexedDBPlugin<StoreState> {
  const storeName = options?.storeName ?? 'state-store';
  const dbName = options?.dbName ?? `al-store-db_${storeName}`;
  const version = options?.version ?? 1;
  const broadcast = options?.broadcast ?? true;

  const _isReady = signal(false);
  
  let db: IDBDatabase | null = null;
  let resolvedKeys: (keyof StoreState)[] = [];
  let isPluginDisabled = false;
  let isHydrating = false;
  let broadcastChannel: BroadcastChannel | undefined;
  let isSyncing = false;

  // Track if a key has been written to by the application before hydration completed
  const dirtyKeysDuringHydration = new Set<keyof StoreState>();

  // Robust Angular Injection Context Capture
  let destroyRef: DestroyRef | null = null;
  try {
    destroyRef = inject(DestroyRef);
  } catch (e) {
    // Fail-safe if plugin instantiates outside of creation context (e.g. dynamic injection contexts)
  }

  const openDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(dbName, version);
        request.onupgradeneeded = () => {
          const dbInstance = request.result;
          if (!dbInstance.objectStoreNames.contains(storeName)) {
            dbInstance.createObjectStore(storeName);
          }
        };
        request.onsuccess = () => {
          db = request.result;
          db.onversionchange = () => {
            db?.close();
            console.warn(`[IndexedDBPlugin] Database "${dbName}" connection closed due to a version upgrade request from another tab.`);
          };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          reject(new Error(`Database open requests to "${dbName}" are blocked by another open connection.`));
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  const getVal = (key: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const setVal = (key: string, value: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const removeVal = (key: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  return {
    isReady: _isReady.asReadonly(),

    async onInit(store: IALStore<StoreState>) {
      const isBrowser = typeof window !== 'undefined' && !!window.indexedDB;
      if (!isBrowser) {
        _isReady.set(true);
        return;
      }

      resolvedKeys = keys === 'all'
        ? (Object.keys(store.snapshot()) as (keyof StoreState)[])
        : keys;

      try {
        await openDb();
      } catch (e) {
        console.warn('[IndexedDBPlugin] Fail-soft: IndexedDB failed to open. Running in-memory:', e);
        isPluginDisabled = true;
        _isReady.set(true);
        return;
      }

      // Safe clean up on Store destruction
      if (destroyRef) {
        destroyRef.onDestroy(() => {
          db?.close();
          broadcastChannel?.close();
        });
      }

      // Live Mirroring via Broadcast Channel
      if (broadcast && typeof BroadcastChannel !== 'undefined') {
        try {
          broadcastChannel = new BroadcastChannel(`al-idb:${dbName}:${storeName}`);
          broadcastChannel.onmessage = (event) => {
            const { key, value } = event.data;
            const matchingKey = resolvedKeys.find((k) => String(k) === key);

            if (matchingKey) {
              isSyncing = true;
              try {
                if (value === undefined) {
                  store.reset(matchingKey);
                } else if (JSON.stringify(store.get(matchingKey)) !== JSON.stringify(value)) {
                  store.set(matchingKey, value);
                }
              } finally {
                isSyncing = false;
              }
            }
          };
        } catch (e) {
          console.warn('[IndexedDBPlugin] Failed to initialize BroadcastChannel:', e);
        }
      }

      // Async Hydration with Race Safety
      isHydrating = true;
      try {
        for (const key of resolvedKeys) {
          try {
            const savedValue = await getVal(String(key));
            
            // Only write if the application has not modified this key during the hydration window
            if (savedValue !== undefined && savedValue !== null && !dirtyKeysDuringHydration.has(key)) {
              store.set(key, savedValue);
            }
          } catch (e) {
            console.error(`[IndexedDBPlugin] Failed to hydrate key "${String(key)}":`, e);
          }
        }
      } finally {
        isHydrating = false;
        _isReady.set(true);
        dirtyKeysDuringHydration.clear();
      }
    },

    onBeforeUpdate(key, prevValue, newValue) {
      // If store writes happen before hydration is complete, and NOT by the hydration process itself, mark as dirty
      if (!isHydrating && !_isReady() && resolvedKeys.includes(key)) {
        dirtyKeysDuringHydration.add(key);
      }
      return newValue;
    },

    onAfterUpdate(key, prevValue, newValue) {
      if (isPluginDisabled || isHydrating || !resolvedKeys.includes(key)) return;

      // Only perform database writes if change didn't originate from a sync event
      if (!isSyncing && db) {
        if (newValue === undefined) {
          removeVal(String(key)).catch(e => console.error(`[IndexedDBPlugin] Fail-soft delete fail:`, e));
        } else {
          setVal(String(key), newValue).catch(e => {
            console.error(`[IndexedDBPlugin] Persist write failed for "${String(key)}":`, e);
          });
        }
      }

      // Sync other tabs/windows in real time (Only execute if change did not originate from a sync message)
      if (broadcast && broadcastChannel && !isSyncing) {
        try {
          broadcastChannel.postMessage({ key: String(key), value: newValue });
        } catch (e) {
          console.warn('[IndexedDBPlugin] Failed broadcasting message:', e);
        }
      }
    }
  };
}
