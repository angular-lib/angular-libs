import { ApplicationRef, Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { StorageLike } from '../storage';
import { MemoryStorage } from '../testing/memory-storage';
import { TestEventMap, TestHeaders } from '../testing/test-bus';
import { definePlugin } from './define-plugin';
import { PersistenceOptions, withPersistence } from './persistence';

describe('withPersistence', () => {
  let storage: MemoryStorage;
  let afterEmits: string[];

  function openBus(options: Partial<PersistenceOptions<TestEventMap>> = {}) {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap, TestHeaders> {
      constructor() {
        super();
        this.use(
          withPersistence({ key: 'app', keys: ['theme:changed', 'user:login'], storage, ...options }),
          definePlugin<TestEventMap, TestHeaders>(() => ({ onAfterEmit: (e) => afterEmits.push(e.key) })),
        );
      }
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [Bus] });
    return TestBed.inject(Bus);
  }

  beforeEach(() => {
    storage = new MemoryStorage();
    afterEmits = [];
  });

  it('restores saved events after a reload, without running handlers or other plugins', () => {
    const first = openBus();
    first.emit('theme:changed', 'dark', { headers: { traceId: 't' } });
    first.emit('count:changed', 1); // not a persisted key
    const savedAt = first.latest('theme:changed')!.timestamp;

    afterEmits = [];
    const handled: string[] = [];
    const reloaded = openBus();
    reloaded.on('theme:changed', (t) => handled.push(t), { unsubscribeOn: 'manual' });

    expect(reloaded.onToSignal('theme:changed', { defaultValue: 'light' })()).toBe('dark');
    expect(reloaded.latest('theme:changed')).toMatchObject({ origin: 'storage', headers: { traceId: 't' }, timestamp: savedAt });
    expect(reloaded.latest('count:changed')).toBeUndefined();
    expect(handled).toEqual([]);
    expect(afterEmits).toEqual([]);
  });

  it('stores one versioned entry with only the listed keys', () => {
    const bus = openBus();
    bus.emit('user:login', { userId: '1' });
    bus.emit('search:typed', 'x');
    expect(storage.json('app')).toEqual({
      v: 1,
      data: { 'user:login': { payload: { userId: '1' }, timestamp: expect.any(Number) } },
    });
  });

  it('resetEvent removes one saved value; resetAllEvents removes the entry', () => {
    const bus = openBus();
    bus.emit('theme:changed', 'dark');
    bus.emit('user:login', { userId: '1' });
    bus.resetEvent('theme:changed');
    expect(Object.keys(storage.json('app').data)).toEqual(['user:login']);
    bus.resetEvent('count:changed'); // not persisted: no write
    bus.resetAllEvents();
    expect(storage.items.has('app')).toBe(false);
    expect(openBus().latest('user:login')).toBeUndefined();
  });

  it('discards data from another version, corrupt data, and keys no longer listed', () => {
    openBus().emit('theme:changed', 'dark');
    expect(openBus({ version: 2 }).latest('theme:changed')).toBeUndefined();
    expect(storage.items.has('app')).toBe(false);

    storage.setItem('app', '{not json');
    expect(openBus().latest('theme:changed')).toBeUndefined();
    expect(storage.items.has('app')).toBe(false);

    openBus().emit('theme:changed', 'dark');
    const narrowed = openBus({ keys: ['user:login'] });
    expect(narrowed.latest('theme:changed')).toBeUndefined();
    narrowed.emit('user:login', { userId: '1' });
    expect(Object.keys(storage.json('app').data)).toEqual(['user:login']);
  });

  it('supports custom storage and serialization, e.g. reviving dates', () => {
    @Injectable()
    class DateBus extends ALEventBus<{ 'saved:at': Date }> {
      constructor() {
        super();
        this.use(
          withPersistence({
            key: 'dates',
            keys: ['saved:at'],
            storage,
            deserialize: (text) => JSON.parse(text, (k, v) => (k === 'payload' ? new Date(v) : v)),
          }),
        );
      }
    }
    const open = () => TestBed.runInInjectionContext(() => new DateBus());
    open().emit('saved:at', new Date('2026-01-02T03:04:05Z'));
    const restored = open().latest('saved:at')!.payload;
    expect(restored).toBeInstanceOf(Date);
    expect(restored.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('turns itself off when storage is unavailable, and logs write failures once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: StorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    const bus = openBus({ storage: broken });
    expect(() => {
      bus.emit('theme:changed', 'dark');
      bus.emit('theme:changed', 'light');
      bus.resetAllEvents();
    }).not.toThrow();
    expect(bus.latest('theme:changed')).toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('uses localStorage by default', () => {
    localStorage.clear();
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(withPersistence({ key: 'default-storage-spec', keys: ['theme:changed'] }));
      }
    }
    TestBed.runInInjectionContext(() => new Bus()).emit('theme:changed', 'dark');
    expect(JSON.parse(localStorage.getItem('default-storage-spec')!).data['theme:changed'].payload).toBe('dark');
    expect(TestBed.runInInjectionContext(() => new Bus()).latest('theme:changed')?.payload).toBe('dark');
    localStorage.clear();
  });

  it('hydrated values feed onToResource at startup', async () => {
    openBus().emit('user:login', { userId: '42' });
    const bus = openBus();
    const profile = TestBed.runInInjectionContext(() =>
      bus.onToResource('user:login', { loader: async ({ params, event }) => `${params.userId}@${event.origin}` }),
    );
    await TestBed.inject(ApplicationRef).whenStable();
    expect(profile.value()).toBe('42@storage');
  });

  it('hydrate never overwrites an event that already happened', () => {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.emit('theme:changed', 'light');
        this.use(definePlugin<TestEventMap>((_bus, context) => context.hydrate('theme:changed', 'dark')));
      }
    }
    expect(TestBed.runInInjectionContext(() => new Bus()).latest('theme:changed')?.payload).toBe('light');
  });
});
