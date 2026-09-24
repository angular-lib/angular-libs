/** The part of the Web Storage API used for persistence. `localStorage` and `sessionStorage` fit. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Options shared by `withPersistence()` and persisted projections. */
export interface StorageOptions {
  /** Bump when the saved shape changes; data saved under another version is discarded. Defaults to 1. */
  version?: number;
  /** Defaults to `localStorage`. Unavailable storage (SSR, blocked) turns persistence off silently. */
  storage?: StorageLike;
  /** Defaults to `JSON.stringify`. */
  serialize?: (value: unknown) => string;
  /** Defaults to `JSON.parse`. Use it to revive e.g. `Date`s. */
  deserialize?: (text: string) => unknown;
}

interface Envelope {
  v: number;
  data: unknown;
}

/** @internal Safe, versioned access to one storage entry. */
export interface StoredValue<T> {
  read(): T | undefined;
  write(value: T): void;
  remove(): void;
}

function defaultStorage(): StorageLike | null {
  try {
    // Accessing `localStorage` itself can throw (sandboxed iframes, some private modes).
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** @internal */
export function storedValue<T>(key: string, options: StorageOptions = {}): StoredValue<T> {
  const storage = options.storage ?? defaultStorage();
  const version = options.version ?? 1;
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? JSON.parse;
  let warned = false;

  const remove = () => {
    try {
      storage?.removeItem(key);
    } catch {
      // Nothing useful to do.
    }
  };

  return {
    read() {
      if (!storage) return undefined;
      try {
        const text = storage.getItem(key);
        if (text === null) return undefined;
        const envelope = deserialize(text) as Envelope | null;
        if (envelope?.v === version) return envelope.data as T;
      } catch {
        // Corrupt or foreign data: fall through and discard it.
      }
      remove();
      return undefined;
    },
    write(value) {
      if (!storage) return;
      try {
        storage.setItem(key, serialize({ v: version, data: value } satisfies Envelope));
      } catch (error) {
        // Quota exceeded or unserializable value; log once so it doesn't flood the console.
        if (!warned) console.error(`[ALEventBus] Could not persist "${key}".`, error);
        warned = true;
      }
    },
    remove,
  };
}
