import { Component, DestroyRef, EnvironmentInjector, Injectable, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from './event-bus';
import { PluginHooks } from './event-bus.models';
import { withBubbling, definePlugin } from './plugins/define-plugin';
import { TestEventBus, TestEventMap } from './testing/test-bus';

describe('ALEventBus', () => {
  let bus: TestEventBus;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(TestEventBus);
  });

  it('emits typed payloads and headers, and remembers the latest event', () => {
    const got: unknown[] = [];
    bus.on('user:login', (user, event) => got.push([user.userId, event.key, event.headers, event.origin]), { unsubscribeOn: 'manual' });
    expect(bus.latest('user:login')).toBeUndefined();

    bus.emit('user:login', { userId: '1' }, { headers: { traceId: 't' } });

    expect(got).toEqual([['1', 'user:login', { traceId: 't' }, 'local']]);
    expect(bus.latest('user:login')?.payload).toEqual({ userId: '1' });
  });

  it('emits void events without a payload, or with options after an explicit undefined', () => {
    const got: unknown[] = [];
    bus.on('user:logout', (_, e) => got.push(e.headers), { unsubscribeOn: 'manual' });
    bus.emit('user:logout');
    bus.emit('user:logout', undefined, { headers: { traceId: 'x' } });
    expect(got).toEqual([undefined, { traceId: 'x' }]);
  });

  it('never treats a payload shaped like options as options', () => {
    @Injectable()
    class Bus extends ALEventBus<{ response: { headers: Record<string, string> } }> {}
    const b = TestBed.runInInjectionContext(() => new Bus());
    b.emit('response', { headers: { a: 'b' } });
    expect(b.latest('response')?.payload).toEqual({ headers: { a: 'b' } });
    expect(b.latest('response')?.headers).toBeUndefined();
  });

  it('delivers emits from handlers after the current event, in order', () => {
    const log: string[] = [];
    bus.on('count:changed', (n) => { bus.emit('theme:changed', 'dark'); bus.emit('user:logout'); log.push(`count-a:${n}`); }, { unsubscribeOn: 'manual' });
    bus.on('count:changed', () => log.push('count-b'), { unsubscribeOn: 'manual' });
    bus.on('theme:changed', () => log.push('theme'), { unsubscribeOn: 'manual' });
    bus.on('user:logout', () => log.push('logout'), { unsubscribeOn: 'manual' });
    bus.emit('count:changed', 1);
    expect(log).toEqual(['count-a:1', 'count-b', 'theme', 'logout']);
  });

  it('isolates throwing and rejecting handlers', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const got: number[] = [];
    bus.on('count:changed', () => { throw new Error('sync'); }, { unsubscribeOn: 'manual' });
    bus.on('count:changed', async () => { throw new Error('async'); }, { unsubscribeOn: 'manual' });
    bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' });

    expect(() => bus.emit('count:changed', 1)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(got).toEqual([1]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('does not let an emitting effect track signals read by handlers', () => {
    const unrelated = signal(0);
    let deliveries = 0;
    bus.on('user:logout', () => { unrelated(); deliveries++; }, { unsubscribeOn: 'manual' });
    TestBed.runInInjectionContext(() => effect(() => bus.emit('user:logout')));
    TestBed.tick();
    unrelated.set(1);
    TestBed.tick();
    expect(deliveries).toBe(1);
  });

  it('once() stops after the first event', () => {
    const got: number[] = [];
    bus.once('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' });
    bus.emit('count:changed', 1);
    bus.emit('count:changed', 2);
    expect(got).toEqual([1]);
  });

  it('listens to several keys with a key-discriminated event', () => {
    const got: string[] = [];
    bus.on(['user:login', 'theme:changed'], (_, e) => got.push(e.key === 'user:login' ? e.payload.userId : e.payload), { unsubscribeOn: 'manual' });
    bus.emit('user:login', { userId: 'u' });
    bus.emit('theme:changed', 'dark');
    expect(got).toEqual(['u', 'dark']);
  });

  it('resetEvent / resetAllEvents forget latest payloads but keep handlers', () => {
    const got: number[] = [];
    bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' });
    bus.emit('count:changed', 1);
    bus.emit('theme:changed', 'dark');
    bus.resetEvent('count:changed');
    expect(bus.latest('count:changed')).toBeUndefined();
    expect(bus.latest('theme:changed')).toBeDefined();
    bus.resetAllEvents();
    expect(bus.latest('theme:changed')).toBeUndefined();
    bus.emit('count:changed', 2);
    expect(got).toEqual([1, 2]);
  });

  it('unsubscribe(key) and unsubscribeAll() stop handlers', () => {
    const got: string[] = [];
    bus.on('count:changed', () => got.push('count'), { unsubscribeOn: 'manual' });
    bus.on('user:logout', () => got.push('logout'), { unsubscribeOn: 'manual' });
    bus.unsubscribe('count:changed');
    bus.emit('count:changed', 1);
    bus.emit('user:logout');
    bus.unsubscribeAll();
    bus.emit('user:logout');
    expect(got).toEqual(['logout']);
  });
});

describe('ALEventBus.on cleanup', () => {
  let bus: TestEventBus;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    bus = TestBed.inject(TestEventBus);
  });

  @Component({ template: '' })
  class Host {
    destroyRef = inject(DestroyRef);
  }

  it('stops when the surrounding component is destroyed', () => {
    const got: number[] = [];
    const fixture = TestBed.createComponent(Host);
    runInInjectionContext(fixture.componentRef.injector, () => bus.on('count:changed', (n) => got.push(n)));
    bus.emit('count:changed', 1);
    fixture.destroy();
    bus.emit('count:changed', 2);
    expect(got).toEqual([1]);
  });

  it('stops on a terminator key, and still on component destroy', () => {
    const got: string[] = [];
    const a = TestBed.createComponent(Host);
    const b = TestBed.createComponent(Host);
    runInInjectionContext(a.componentRef.injector, () => bus.on('count:changed', (n) => got.push(`a${n}`), { unsubscribeOn: 'user:logout' }));
    runInInjectionContext(b.componentRef.injector, () => bus.on('count:changed', (n) => got.push(`b${n}`), { unsubscribeOn: ['user:logout'] }));

    bus.emit('count:changed', 1);
    a.destroy(); // destroyed before the terminator: must still stop
    bus.emit('count:changed', 2);
    bus.emit('user:logout');
    bus.emit('count:changed', 3);

    expect(got).toEqual(['a1', 'b1', 'b2']);
    b.destroy();
  });

  it('stops on an AbortSignal and ignores an already aborted one', () => {
    const got: string[] = [];
    const controller = new AbortController();
    const aborted = new AbortController();
    aborted.abort();
    bus.on('count:changed', (n) => got.push(`live${n}`), { unsubscribeOn: controller.signal });
    bus.on('count:changed', (n) => got.push(`dead${n}`), { unsubscribeOn: aborted.signal });
    bus.emit('count:changed', 1);
    controller.abort();
    bus.emit('count:changed', 2);
    expect(got).toEqual(['live1']);
  });

  it("keeps running past destroy with 'manual'", () => {
    const got: number[] = [];
    const fixture = TestBed.createComponent(Host);
    const stop = runInInjectionContext(fixture.componentRef.injector, () => bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' }));
    fixture.destroy();
    bus.emit('count:changed', 1);
    stop();
    bus.emit('count:changed', 2);
    expect(got).toEqual([1]);
  });

  it('throws before attaching when given an already destroyed DestroyRef', () => {
    const got: number[] = [];
    const fixture = TestBed.createComponent(Host);
    const destroyRef = fixture.componentInstance.destroyRef;
    fixture.destroy();
    expect(() => bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: destroyRef })).toThrow();
    bus.emit('count:changed', 1);
    expect(got).toEqual([]);
  });

  it('warns outside an injection context only without unsubscribeOn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bus.on('count:changed', () => {});
    expect(warn).toHaveBeenCalledOnce();
    bus.on('count:changed', () => {}, { unsubscribeOn: 'user:logout' });
    bus.on('count:changed', () => {}, { unsubscribeOn: 'manual' });
    TestBed.runInInjectionContext(() => bus.on('count:changed', () => {}));
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('ALEventBus plugin handle()', () => {
  function busWith(...hooks: PluginHooks<TestEventMap>[]) {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(...hooks.map((h) => definePlugin<TestEventMap>(() => h)));
      }
    }
    TestBed.configureTestingModule({ providers: [Bus] });
    const bus = TestBed.inject(Bus);
    const log: string[] = [];
    bus.on(['count:changed', 'user:logout'], (_, e) => log.push(`${e.key}:${String(e.payload)}`), { unsubscribeOn: 'manual' });
    return { bus, log };
  }

  it('runs plugins in order and lets them change or drop events', () => {
    const order: string[] = [];
    const { bus, log } = busWith(
      { handle: (e, next) => { order.push('first'); next(e); } },
      {
        handle: (e, next) => {
          order.push('second');
          if (e.key === 'count:changed') {
            if (e.payload < 0) return;
            return next({ ...e, payload: e.payload * 10 });
          }
          next(e);
        },
      },
    );
    bus.emit('count:changed', 1);
    bus.emit('count:changed', -1);
    expect(order).toEqual(['first', 'second', 'first', 'second']);
    expect(log).toEqual(['count:changed:10']);
  });

  it('lets a plugin defer an event; it continues from that point exactly once', () => {
    vi.useFakeTimers();
    try {
      let downstream = 0;
      const { bus, log } = busWith(
        { handle: (e, next) => void setTimeout(() => next(e), 100) },
        { handle: (e, next) => { downstream++; next(e); } },
      );
      bus.emit('count:changed', 1);
      expect(log).toEqual([]);
      vi.advanceTimersByTime(100);
      expect(log).toEqual(['count:changed:1']);
      expect(downstream).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails open when handle() throws, without delivering twice', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bus, log } = busWith(
      { handle: (e, next) => { if (e.key === 'user:logout') throw new Error('before'); next(e); } },
      { handle: (e, next) => { next(e); throw new Error('after'); } },
    );
    bus.emit('user:logout');
    bus.emit('count:changed', 1);
    expect(log).toEqual(['user:logout:undefined', 'count:changed:1']);
    error.mockRestore();
  });

  it('runs plugins in the bus injection context, notifies resets and destroys them with the bus', () => {
    @Injectable({ providedIn: 'root' })
    class Analytics { seen: string[] = []; }
    const destroy = vi.fn();
    const resets: unknown[] = [];
    @Injectable()
    class Tracked extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(definePlugin(() => {
          const analytics = inject(Analytics);
          return {
            handle: (e, next) => { analytics.seen.push(e.key); next(e); },
            onReset: (key, origin) => resets.push([key, origin]),
            destroy,
          };
        }));
      }
    }
    const injector = TestBed.inject(EnvironmentInjector);
    const tracked = runInInjectionContext(injector, () => new Tracked());
    tracked.emit('user:logout');
    tracked.resetEvent('user:logout');
    tracked.resetAllEvents();
    expect(TestBed.inject(Analytics).seen).toEqual(['user:logout']);
    expect(resets).toEqual([['user:logout', 'local'], [undefined, 'local']]);

    TestBed.resetTestingModule();
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe('ALEventBus plugin hooks', () => {
  function busWith<TApi>(hooks: PluginHooks<TestEventMap, Record<string, unknown>, TApi>) {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      api = this.use(definePlugin<TestEventMap, Record<string, unknown>, TApi>(() => hooks));
    }
    TestBed.configureTestingModule({ providers: [Bus] });
    return TestBed.inject(Bus);
  }

  it('use(plugin) returns the plugin api; several plugins return nothing', () => {
    const bus = busWith({ api: { answer: () => 42 } });
    expect(bus.api.answer()).toBe(42);

    @Injectable()
    class Many extends ALEventBus<TestEventMap> {
      result = this.use(definePlugin(() => ({})), definePlugin(() => {}));
    }
    expect(TestBed.runInInjectionContext(() => new Many()).result).toBeUndefined();
  });

  it('onAfterEmit runs after every handler, also for events emitted from handlers, and not for dropped ones', () => {
    const log: string[] = [];
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(
          definePlugin<TestEventMap>(() => ({ handle: (e, next) => (e.key === 'search:typed' ? undefined : next(e)) })),
          definePlugin<TestEventMap>(() => ({ onAfterEmit: (e) => log.push(`after:${e.key}`) })),
        );
      }
    }
    const bus = TestBed.runInInjectionContext(() => new Bus());
    bus.on('count:changed', () => { log.push('handler:count'); bus.emit('user:logout'); }, { unsubscribeOn: 'manual' });
    bus.on('user:logout', () => log.push('handler:logout'), { unsubscribeOn: 'manual' });

    bus.emit('count:changed', 1);
    bus.emit('search:typed', 'dropped');

    expect(log).toEqual(['handler:count', 'after:count:changed', 'handler:logout', 'after:user:logout']);
  });

  it('onSubscribe/onUnsubscribe track on(), once() and every way a subscription stops', () => {
    const log: string[] = [];
    const bus = busWith({
      onSubscribe: (key, id) => log.push(`+${id}`),
      onUnsubscribe: (key, id) => log.push(`-${id}`),
    });

    const stop = bus.on(['count:changed', 'user:logout'], () => {}, { unsubscribeOn: 'manual' });
    bus.once('theme:changed', () => {}, { unsubscribeOn: 'manual' });
    bus.on('search:typed', () => {}, { unsubscribeOn: 'user:login' }); // terminator is not reported
    expect(log).toEqual(['+count:changed#1', '+user:logout#2', '+theme:changed#3', '+search:typed#4']);

    log.length = 0;
    stop();
    stop(); // idempotent
    bus.emit('theme:changed', 'dark');
    bus.emit('user:login', { userId: '1' });
    expect(log).toEqual(['-count:changed#1', '-user:logout#2', '-theme:changed#3', '-search:typed#4']);

    log.length = 0;
    bus.on('count:changed', () => {}, { unsubscribeOn: 'manual' });
    const late = bus.on('user:logout', () => {}, { unsubscribeOn: 'manual' });
    bus.unsubscribe('count:changed');
    bus.unsubscribeAll();
    late(); // already removed: not reported twice
    expect(log).toEqual(['+count:changed#5', '+user:logout#6', '-count:changed#5', '-user:logout#6']);
  });

  it('reports unsubscribes when the subscribing component is destroyed', () => {
    const log: string[] = [];
    const bus = busWith({ onUnsubscribe: (key) => log.push(key) });
    @Component({ template: '' })
    class Host {
      constructor() {
        bus.on('count:changed', () => {});
      }
    }
    TestBed.createComponent(Host).destroy();
    expect(log).toEqual(['count:changed']);
  });

  it('isolates throwing hooks', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const got: number[] = [];
    const bus = busWith({
      onAfterEmit: () => { throw new Error('after'); },
      onSubscribe: () => { throw new Error('subscribe'); },
    });
    bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' });
    expect(() => bus.emit('count:changed', 1)).not.toThrow();
    expect(got).toEqual([1]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});

describe('scoped ALEventBus', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('a component-provided bus is isolated and destroyed with the component', () => {
    const root = TestBed.inject(TestEventBus);
    const rootGot: number[] = [];
    root.on('count:changed', (n) => rootGot.push(n), { unsubscribeOn: 'manual' });

    @Component({ template: '', providers: [TestEventBus] })
    class Scoped {
      bus = inject(TestEventBus);
      got: number[] = [];
      constructor() {
        this.bus.on('count:changed', (n) => this.got.push(n));
      }
    }
    const fixture = TestBed.createComponent(Scoped);
    const scoped = fixture.componentInstance;
    scoped.bus.emit('count:changed', 1);
    root.emit('count:changed', 2);
    fixture.destroy();
    scoped.bus.emit('count:changed', 3);

    expect(scoped.bus).not.toBe(root);
    expect(scoped.got).toEqual([1]);
    expect(rootGot).toEqual([2]);
  });

  it('withBubbling() also delivers subtree events to the parent instance', () => {
    @Injectable({ providedIn: 'root' })
    class BubblingBus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(withBubbling());
      }
    }
    const root = TestBed.inject(BubblingBus);
    const rootGot: number[] = [];
    root.on('count:changed', (n) => rootGot.push(n), { unsubscribeOn: 'manual' });

    @Component({ template: '', providers: [BubblingBus] })
    class Scoped {
      bus = inject(BubblingBus);
    }
    TestBed.createComponent(Scoped).componentInstance.bus.emit('count:changed', 7);
    root.emit('count:changed', 8);
    expect(rootGot).toEqual([7, 8]);
  });
});
