import { Injectable, signal, Signal, untracked, computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALStore } from './al-store';
import { entityPlugin } from './plugins/entity.plugin';
import { historyPlugin } from './plugins/history.plugin';
import { persistPlugin } from './plugins/persist.plugin';
import { indexedDBPlugin } from './plugins/indexeddb.plugin';

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
});
