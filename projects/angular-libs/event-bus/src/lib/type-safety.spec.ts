// Compile-time checks. An unused `@ts-expect-error` fails the build, so every line is verified.
import { Injectable, ResourceRef, Signal } from '@angular/core';
import { ALEventBus } from './event-bus';
import { withCrossTabSync } from './plugins/cross-tab-sync';
import { definePlugin } from './plugins/define-plugin';
import { withDebounce } from './plugins/debounce';
import { withLogger } from './plugins/logger';
import { withPersistence } from './plugins/persistence';
import { TestEventBus, TestEventMap } from './testing/test-bus';

@Injectable()
class TypedBus extends ALEventBus<TestEventMap, { traceId?: string }> {
  counter = this.projection(0, { 'count:changed': (n, by) => n + by, 'user:logout': () => 0 });
  names = this.projection<string[]>([], { 'user:login': (names, u) => [...names, u.userId], 'user:logout': () => [] });

  constructor() {
    super();
    this.use(
      withLogger({ filter: (e) => e.key !== 'search:typed' }),
      withDebounce('search:typed', 300),
      withCrossTabSync({ channel: 'app', keys: ['user:logout'] }),
      definePlugin(() => ({
        handle(event, next) {
          // `key` narrows the payload.
          if (event.key === 'user:login') { const id: string = event.payload.userId; void id; }
          next(event);
        },
      })),
    );
    const api: { flush(): number } = this.use(definePlugin<TestEventMap, { traceId?: string }, { flush(): number }>(() => ({
      onAfterEmit: (event) => { if (event.key === 'count:changed') { const n: number = event.payload; void n; } },
      onSubscribe: (key) => { const k: keyof TestEventMap = key; void k; },
      api: { flush: () => 1 },
    })));
    void api;
    const nothing: void = this.use(withLogger(), withDebounce('search:typed', 1));
    void nothing;
    this.use(withPersistence({ key: 'app', keys: ['theme:changed'], version: 2, storage: sessionStorage }));
    // @ts-expect-error unknown key in persistence options
    this.use(withPersistence({ key: 'app', keys: ['theme:chnaged'] }));
    this.projection(0, { 'count:changed': (n, by) => n + by }, { persist: 'counter' });
    this.projection(0, { 'count:changed': (n, by) => n + by }, { persist: { key: 'counter', version: 2 } });
    // @ts-expect-error persist needs a key
    this.projection(0, {}, { persist: { version: 2 } });
    // @ts-expect-error unknown key in plugin options
    this.use(withDebounce('search:typo', 300));
    // @ts-expect-error unknown key in cross-tab keys
    this.use(withCrossTabSync({ channel: 'app', keys: ['user:logot'] }));
    this.projection(0, {
      // @ts-expect-error reducer payload comes from the event map
      'count:changed': (n, by) => n + by.length,
    });
    this.projection(0, {
      // @ts-expect-error reducer must return the state type
      'theme:changed': (_n, theme) => theme,
    });
    // @ts-expect-error unknown key in reducers
    this.projection(0, { 'nope': (n: number) => n });
  }
}

function emitting(bus: TestEventBus) {
  bus.emit('user:login', { userId: '1' });
  bus.emit('user:logout');
  bus.emit('user:login', { userId: '1' }, { headers: { traceId: 't' } });
  // @ts-expect-error unknown key
  bus.emit('user:lgoin', { userId: '1' });
  // @ts-expect-error wrong payload
  bus.emit('user:login', { id: '1' });
  // @ts-expect-error missing payload
  bus.emit('user:login');
  // @ts-expect-error headers are typed
  bus.emit('user:logout', undefined, { headers: { traceId: 1 } });
}

function listening(bus: TestEventBus) {
  bus.on('user:login', (user, event) => { const id: string = user.userId; const k: 'user:login' = event.key; return [id, k]; });
  // @ts-expect-error payload type comes from the map
  bus.on('search:typed', (q: number) => q);
  // @ts-expect-error unknown terminator key
  bus.on('search:typed', () => {}, { unsubscribeOn: 'user:lgout' });
  bus.on(['user:login', 'theme:changed'], (payload) => {
    // @ts-expect-error a union payload must be narrowed first
    payload.userId;
  });
}

function signals(bus: TestEventBus) {
  const a: Signal<'light' | 'dark' | undefined> = bus.onToSignal('theme:changed');
  const b: Signal<string> = bus.onToSignal('user:login', { transform: (u) => u.userId, defaultValue: 'guest' });
  // @ts-expect-error may be undefined without a default
  const c: Signal<string> = bus.onToSignal('search:typed');
  const d: Signal<[{ userId: string }, string] | undefined> = bus.combineLatestToSignal(['user:login', 'search:typed']);
  // @ts-expect-error tuple element types are precise
  const e: Signal<[string, string] | undefined> = bus.combineLatestToSignal(['user:login', 'search:typed']);
  // @ts-expect-error unknown key
  bus.combineLatestToSignal(['user:login', 'nope']);
  bus.combineLatest(['user:login', 'count:changed'], ([user, count]) => { const s: string = user.userId; const n: number = count; return [s, n]; });
  return [a, b, c, d, e];
}

function resources(bus: TestEventBus) {
  const a: ResourceRef<number | undefined> = bus.onToResource('search:typed', { loader: async ({ params }) => params.length });
  const b: ResourceRef<number> = bus.onToResource('search:typed', { loader: async ({ params }) => params.length, defaultValue: 0 });
  bus.onToResource('user:login', { transform: (u) => u.userId, loader: async ({ params }) => { const id: string = params; return id; } });
  return [a, b];
}

function projections(bus: TypedBus) {
  const n: Signal<number> = bus.counter.state;
  const names: Signal<string[]> = bus.names.state;
  return [n, names];
}

describe('type safety', () => {
  it('compiles', () => expect([TypedBus, emitting, listening, signals, resources, projections]).toHaveLength(6));
});
