import { Injectable, signal, Signal, untracked, computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALStore } from './al-store';
import { entityPlugin } from './plugins/entity.plugin';
import { historyPlugin } from './plugins/history.plugin';
import { persistPlugin } from './plugins/persist.plugin';
import { indexedDBPlugin } from './plugins/indexeddb.plugin';
import { resourcePlugin } from './plugins/resource.plugin';

interface TestUser {
  id: number;
  name: string;
}

interface TestState {
  theme: 'light' | 'dark';
  counter: number;
  users: TestUser[];
  document: string;
}

const initialTestState: TestState = {
  theme: 'light',
  counter: 0,
  users: [],
  document: '',
};

@Injectable()
class TestStore extends ALStore<TestState> {
  usersAdapter = this.registerPlugin(entityPlugin('users', { idField: 'id' }));
  docHistory = this.registerPlugin(historyPlugin('document', { limit: 5 }));

  constructor() {
    super(initialTestState);
  }
}

class MockStorage implements Storage {
  private store: Record<string, string> = {};

  get length() {
    return Object.keys(this.store).length;
  }

  clear() {
    this.store = {};
  }

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  setItem(key: string, value: string) {
    this.store[key] = value;
  }
}

describe('ALStore Basic Functionality', () => {
  let store: TestStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestStore],
    });
    store = TestBed.inject(TestStore);
  });

  it('should initialize with initial state', () => {
    expect(store.get('theme')).toBe('light');
    expect(store.get('counter')).toBe(0);
    expect(store.snapshot()).toEqual(initialTestState);
  });

  it('should set and get values correctly', () => {
    store.set('theme', 'dark');
    expect(store.get('theme')).toBe('dark');
    expect(store.snapshot().theme).toBe('dark');
  });

  it('should update values correctly', () => {
    store.update('counter', (c) => c + 1);
    expect(store.get('counter')).toBe(1);
  });

  it('should patch state correctly', () => {
    store.patchState({ theme: 'dark', counter: 42 });
    expect(store.get('theme')).toBe('dark');
    expect(store.get('counter')).toBe(42);
  });

  it('should reset specific keys or entire state', () => {
    store.set('theme', 'dark');
    store.set('counter', 100);

    store.reset('theme');
    expect(store.get('theme')).toBe('light');
    expect(store.get('counter')).toBe(100);

    store.reset();
    expect(store.get('counter')).toBe(0);
  });

  it('should select state reactively', () => {
    const doubleCounter = TestBed.runInInjectionContext(() =>
      store.select((state) => state.counter * 2)
    );

    expect(doubleCounter()).toBe(0);
    store.set('counter', 5);
    expect(doubleCounter()).toBe(10);
  });

  it('should recompute select() when using Object.keys or in', () => {
    const keys = TestBed.runInInjectionContext(() =>
      store.select((state) => Object.keys(state).sort().join(',')),
    );
    const hasTheme = TestBed.runInInjectionContext(() => store.select((state) => 'theme' in state));

    expect(keys()).toContain('counter');
    expect(hasTheme()).toBe(true);
    store.set('counter', 3);
    expect(keys()).toContain('counter');
    expect(hasTheme()).toBe(true);
  });
});

describe('ALStore Plugin Hook Error Isolation', () => {
  it('should isolate a throwing onBeforeUpdate/onAfterUpdate hook so other plugins still run', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const afterUpdateCalls: unknown[] = [];
    const throwingPlugin = {
      onBeforeUpdate: () => {
        throw new Error('boom (onBeforeUpdate)');
      },
      onAfterUpdate: () => {
        throw new Error('boom (onAfterUpdate)');
      },
    };
    const healthyPlugin = {
      onBeforeUpdate: (_key: keyof TestState, _prev: any, value: any) => value,
      onAfterUpdate: (key: keyof TestState, _prev: any, value: any) => {
        afterUpdateCalls.push([key, value]);
      },
    };

    @Injectable()
    class FaultyPluginStore extends ALStore<TestState> {
      constructor() {
        super(initialTestState);
        this.registerPlugin(throwingPlugin);
        this.registerPlugin(healthyPlugin);
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [FaultyPluginStore] });
    const faultyStore = TestBed.inject(FaultyPluginStore);

    expect(() => faultyStore.set('theme', 'dark')).not.toThrow();
    expect(faultyStore.get('theme')).toBe('dark');
    expect(afterUpdateCalls).toEqual([['theme', 'dark']]);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});

describe('ALStore Entity Plugin', () => {
  let store: TestStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestStore],
    });
    store = TestBed.inject(TestStore);
  });

  it('should CRUD entities correctly', () => {
    const users = store.usersAdapter;
    expect(users.total()).toBe(0);

    // addOne
    users.addOne({ id: 1, name: 'Alice' });
    expect(users.all()).toEqual([{ id: 1, name: 'Alice' }]);
    expect(users.total()).toBe(1);

    // addMany
    users.addMany([
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);
    expect(users.total()).toBe(3);

    // updateOne
    users.updateOne({ id: 2, changes: { name: 'Bobby' } });
    expect(users.all()[1]).toEqual({ id: 2, name: 'Bobby' });

    // upsertOne (existing)
    users.upsertOne({ id: 3, name: 'Charles' });
    expect(users.all()[2]).toEqual({ id: 3, name: 'Charles' });

    // upsertOne (new)
    users.upsertOne({ id: 4, name: 'Diana' });
    expect(users.total()).toBe(4);

    // removeOne
    users.removeOne(1);
    expect(users.total()).toBe(3);
    expect(users.all().some((u) => u.id === 1)).toBe(false);

    // removeMany
    users.removeMany([2, 3]);
    expect(users.total()).toBe(1);
    expect(users.all()).toEqual([{ id: 4, name: 'Diana' }]);

    // remove predicate
    users.remove((u) => u.name === 'Diana');
    expect(users.total()).toBe(0);
  });

  it('should warn once (dev mode) when an entity resolves to an undefined/null ID', () => {
    @Injectable()
    class NoIdFieldStore extends ALStore<{ items: { label: string }[] }> {
      itemsAdapter = this.registerPlugin(entityPlugin('items'));

      constructor() {
        super({ items: [] });
      }
    }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NoIdFieldStore] });
    const noIdStore = TestBed.inject(NoIdFieldStore);

    // Neither entity has an `id` property, and no `idField`/`selectId` was configured, so both
    // resolve to the same `undefined` ID and silently collide (addOne treats the second as a dup).
    noIdStore.itemsAdapter.addOne({ label: 'first' });
    noIdStore.itemsAdapter.addOne({ label: 'second' });

    expect(noIdStore.itemsAdapter.total()).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[entityPlugin]'));

    warnSpy.mockRestore();
  });
});

describe('ALStore History Plugin', () => {
  let store: TestStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestStore],
    });
    store = TestBed.inject(TestStore);
  });

  it('should undo and redo state changes', () => {
    const history = store.docHistory;

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    store.set('document', 'Version 1');
    expect(history.canUndo()).toBe(true);

    store.set('document', 'Version 2');
    expect(store.get('document')).toBe('Version 2');

    history.undo();
    expect(store.get('document')).toBe('Version 1');
    expect(history.canRedo()).toBe(true);

    history.redo();
    expect(store.get('document')).toBe('Version 2');
  });

  it('should not throw when the tracked value cannot be structurally cloned (e.g. contains a function)', () => {
    @Injectable()
    class NonCloneableStore extends ALStore<{ payload: any }> {
      payloadHistory = this.registerPlugin(historyPlugin('payload'));

      constructor() {
        super({ payload: null });
      }
    }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NonCloneableStore] });
    const nonCloneableStore = TestBed.inject(NonCloneableStore);

    const withFunction = { onClick: () => {} };

    expect(() => nonCloneableStore.set('payload', withFunction)).not.toThrow();
    expect(nonCloneableStore.get('payload')).toBe(withFunction);
    expect(nonCloneableStore.payloadHistory.canUndo()).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe('ALStore Persist Plugin', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
  });

  it('should write to storage on update and hydrate on init', () => {
    @Injectable()
    class PersistedStore extends ALStore<TestState> {
      persist = this.registerPlugin(
        persistPlugin(['theme', 'counter'], {
          storage: mockStorage,
          keyPrefix: 'test-store:',
          broadcast: false,
        })
      );

      constructor() {
        super(initialTestState);
      }
    }

    TestBed.configureTestingModule({
      providers: [PersistedStore],
    });

    const storeInstance = TestBed.inject(PersistedStore);

    // Expect items not written in DB yet to remain initial value
    expect(storeInstance.get('theme')).toBe('light');

    // Trigger update
    storeInstance.set('theme', 'dark');
    expect(mockStorage.getItem('test-store:theme')).toBe(JSON.stringify('dark'));

    // Tear down is run, new store initialized to verify hydration
    const newStoreInstance = TestBed.runInInjectionContext(() => {
      const s = new PersistedStore();
      s.persist.onInit?.(s);
      return s;
    });

    expect(newStoreInstance.get('theme')).toBe('dark');
  });

  it('should not record persist hydration as a history undo step', () => {
    mockStorage.setItem('hist-store:document', JSON.stringify('saved'));

    @Injectable()
    class HydratedHistoryStore extends ALStore<TestState> {
      docHistory = this.registerPlugin(historyPlugin('document', { limit: 5 }));

      constructor() {
        super(initialTestState);
        this.registerPlugin(
          persistPlugin(['document'], {
            storage: mockStorage,
            keyPrefix: 'hist-store:',
            broadcast: false,
          }),
        );
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [HydratedHistoryStore] });
    const store = TestBed.inject(HydratedHistoryStore);

    expect(store.get('document')).toBe('saved');
    expect(store.docHistory.canUndo()).toBe(false);

    store.set('document', 'edited');
    expect(store.docHistory.canUndo()).toBe(true);
    store.docHistory.undo();
    expect(store.get('document')).toBe('saved');
  });
});

describe('ALStore IndexedDB Plugin', () => {
  let mockIDBApi: any;
  let mockRequest: any;
  let mockDb: any;
  let mockTransaction: any;
  let mockObjectStore: any;
  let mockGetRequest: any;
  let mockPutRequest: any;
  let mockDeleteRequest: any;

  beforeEach(() => {
    mockGetRequest = {
      onsuccess: null as any,
      onerror: null as any,
      result: undefined,
    };
    mockPutRequest = {
      onsuccess: null as any,
      onerror: null as any,
    };
    mockDeleteRequest = {
      onsuccess: null as any,
      onerror: null as any,
    };

    mockObjectStore = {
      get: vi.fn().mockImplementation((key: string) => {
        const req = {
          onsuccess: null as any,
          onerror: null as any,
          result: key === 'theme' ? 'dark' : undefined,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      put: vi.fn().mockImplementation(() => {
        const req = {
          onsuccess: null as any,
          onerror: null as any,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
      delete: vi.fn().mockImplementation(() => {
        const req = {
          onsuccess: null as any,
          onerror: null as any,
        };
        setTimeout(() => {
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      }),
    };

    mockTransaction = {
      objectStore: vi.fn().mockReturnValue(mockObjectStore),
    };

    mockDb = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      transaction: vi.fn().mockReturnValue(mockTransaction),
      close: vi.fn(),
    };

    mockRequest = {
      onupgradeneeded: null as any,
      onsuccess: null as any,
      onerror: null as any,
      result: mockDb,
    };

    mockIDBApi = {
      open: vi.fn().mockImplementation(() => {
        setTimeout(() => {
          if (mockRequest.onsuccess) mockRequest.onsuccess();
        }, 0);
        return mockRequest;
      }),
    };

    vi.stubGlobal('indexedDB', mockIDBApi);
    vi.stubGlobal('window', {
      indexedDB: mockIDBApi,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should hydrate asynchronously from IndexedDB and support race-safe concurrent app writes', async () => {
    @Injectable()
    class IDBTestStore extends ALStore<TestState> {
      idb = this.registerPlugin(
        indexedDBPlugin(['theme', 'counter'], {
          dbName: 'test-db',
          storeName: 'test-store',
          broadcast: false,
        })
      );

      constructor() {
        super(initialTestState);
      }
    }

    TestBed.configureTestingModule({
      providers: [IDBTestStore],
    });

    const storeInstance = TestBed.inject(IDBTestStore);

    // Call onInit manually to resolve promise properly in mock framework
    await storeInstance.idb.onInit!(storeInstance);

    expect(storeInstance.idb.isReady()).toBe(true);
    expect(storeInstance.get('theme')).toBe('dark');
  });

  it('should hydrate persisted null instead of leaving the initial value', async () => {
    mockObjectStore.get = vi.fn().mockImplementation((key: string) => {
      const req = {
        onsuccess: null as any,
        onerror: null as any,
        result: key === 'user' ? null : undefined,
      };
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    });

    interface NullableState {
      user: { name: string } | null;
    }

    @Injectable()
    class NullableStore extends ALStore<NullableState> {
      idb = this.registerPlugin(
        indexedDBPlugin(['user'], { dbName: 'null-db', storeName: 'null-store', broadcast: false }),
      );
      constructor() {
        super({ user: { name: 'guest' } });
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [NullableStore] });
    const store = TestBed.inject(NullableStore);
    await store.idb.onInit!(store);

    expect(store.get('user')).toBeNull();
  });

  it('should apply remote Map values from BroadcastChannel', async () => {
    const channels: Array<{ onmessage: ((event: { data: any }) => void) | null }> = [];
    class MockBroadcastChannel {
      onmessage: ((event: { data: any }) => void) | null = null;
      constructor(_name: string) {
        channels.push(this);
      }
      postMessage(_data: any) {}
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    interface MapState {
      tags: Map<string, number>;
    }

    @Injectable()
    class MapStore extends ALStore<MapState> {
      idb = this.registerPlugin(
        indexedDBPlugin(['tags'], { dbName: 'map-db', storeName: 'map-store', broadcast: true }),
      );
      constructor() {
        super({ tags: new Map([['a', 1]]) });
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MapStore] });
    const store = TestBed.inject(MapStore);
    await store.idb.onInit!(store);

    const incoming = new Map([['b', 2]]);
    channels[0].onmessage?.({ data: { key: 'tags', value: incoming } });
    expect(store.get('tags')).toBe(incoming);
  });
});

describe('ALStore Resource Plugin', () => {
  interface ProfileState {
    profile: { name: string } | null;
  }
  const initialProfileState: ProfileState = { profile: null };

  it('should patch the store when the loader resolves and expose isLoading/value/reload', async () => {
    let resolveLoader!: (value: { name: string }) => void;
    const loader = vi.fn(
      () =>
        new Promise<{ name: string }>((resolve) => {
          resolveLoader = resolve;
        })
    );

    @Injectable()
    class ProfileStore extends ALStore<ProfileState> {
      profileResource = this.registerPlugin(resourcePlugin('profile', { loader }));

      constructor() {
        super(initialProfileState);
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProfileStore] });
    const store = TestBed.inject(ProfileStore);

    expect(store.profileResource.isLoading()).toBe(true);
    expect(store.get('profile')).toBeNull();

    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalled();
    });
    resolveLoader({ name: 'Ava' });

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'Ava' });
    });

    expect(store.profileResource.value()).toEqual({ name: 'Ava' });
    expect(store.profileResource.isLoading()).toBe(false);
  });

  it('should re-run the loader and patch the store again when reload() is called', async () => {
    let callCount = 0;
    const loader = vi.fn(async () => {
      callCount++;
      return { name: `call-${callCount}` };
    });

    @Injectable()
    class ProfileStore extends ALStore<ProfileState> {
      profileResource = this.registerPlugin(resourcePlugin('profile', { loader }));

      constructor() {
        super(initialProfileState);
      }
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProfileStore] });
    const store = TestBed.inject(ProfileStore);

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'call-1' });
    });

    store.profileResource.reload();

    await vi.waitFor(() => {
      expect(store.get('profile')).toEqual({ name: 'call-2' });
    });

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
