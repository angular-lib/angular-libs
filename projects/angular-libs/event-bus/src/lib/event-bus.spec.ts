import { Injectable, runInInjectionContext, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus, createEventBusHooks } from './event-bus';
import { ALEventBusPlugin, BusEvent } from './event-bus.models';
import { MockComponent, TestEventMap, TestEventBus, createTestPlugin } from './testing/event-bus-test-helpers';

describe('ALEventBus Basic/Core Functionality', () => {
  let eventBus: TestEventBus;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestEventBus],
    });
    eventBus = TestBed.inject(TestEventBus);
  });

  afterEach(() => {
    eventBus.resetAllEvents();
    eventBus.unsubscribeAll();
  });

  it('should emit and read latest event synchronously', () => {
    expect(eventBus.latest('user:login')).toBeUndefined();

    eventBus.emit('user:login', { userId: '123', username: 'alice' });

    const latest = eventBus.latest('user:login');
    expect(latest).toBeDefined();
    expect(latest?.payload).toEqual({ userId: '123', username: 'alice' });
    expect(latest?.key).toBe('user:login');
  });

  it('should never confuse a payload for options, even when the payload is shaped like { headers }', () => {
    expect(eventBus.latest('request:completed')).toBeUndefined();

    const payloadData = {
      headers: { 'Content-Type': 'application/json' },
      body: '{"status":"ok"}'
    };
    eventBus.emit('request:completed', payloadData);

    const latest = eventBus.latest('request:completed');
    expect(latest).toBeDefined();
    expect(latest?.payload).toEqual(payloadData);
    expect(latest?.headers).toBeUndefined(); // Headers should be undefined since we did not supply options

    // Payloads shaped EXACTLY like `{ headers }` (no other keys) are also always treated as the
    // payload now - argument position is the only thing that determines payload vs. options.
    const headersOnlyPayload = { headers: { traceId: 'abc' } };
    eventBus.emit('request:completed', headersOnlyPayload as any);
    expect(eventBus.latest('request:completed')?.payload).toEqual(headersOnlyPayload);
    expect(eventBus.latest('request:completed')?.headers).toBeUndefined();
  });

  it('should support callback based subscriptions via on() and print warning but suppress if manual', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const received: BusEvent<{ userId: string; username: string }>[] = [];
    const unsubscribe = eventBus.on('user:login', {
      callback: (event) => { received.push(event); },
    });

    eventBus.emit('user:login', { userId: '456', username: 'bob' });

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual({ userId: '456', username: 'bob' });

    // Expect warning in devMode for outside-injection-context on()
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    unsubscribe();
  });

  it('should support automatic contextual unsubscription via DestroyRef inside an injection context', () => {
    const received: BusEvent<'light' | 'dark'>[] = [];
    
    const fixture = TestBed.createComponent(MockComponent);
    const componentInjector = fixture.debugElement.injector;

    runInInjectionContext(componentInjector, () => {
      eventBus.on('theme:changed', {
        callback: (event) => { received.push(event); }
      });
    });

    eventBus.emit('theme:changed', 'dark');
    expect(received.length).toBe(1);

    // Simulate destruction of the context natively through Component lifecycle!
    fixture.destroy();

    eventBus.emit('theme:changed', 'dark');
    expect(received.length).toBe(1); // Should not have increased since we auto-unsubscribed!
  });

  it('should bypass automatic unsubscription if unsubscribeOn is "manual"', () => {
    const received: BusEvent<'light' | 'dark'>[] = [];
    
    const fixture = TestBed.createComponent(MockComponent);
    const componentInjector = fixture.debugElement.injector;

    runInInjectionContext(componentInjector, () => {
      eventBus.on('theme:changed', {
        callback: (event) => { received.push(event); },
        unsubscribeOn: 'manual'
      });
    });

    eventBus.emit('theme:changed', 'dark');
    expect(received.length).toBe(1);

    // Simulate destruction of the context - should be ignored due to manual bypass
    fixture.destroy();

    eventBus.emit('theme:changed', 'dark');
    expect(received.length).toBe(2); // Should have increased because we bypassed contextual destruction!
  });

  it('should support customized typed headers globally', () => {
    interface CustomHeaders {
      traceId: string;
      tenant: string;
    }
    @Injectable()
    class CustomHeadersEventBus extends ALEventBus<TestEventMap, CustomHeaders> {}

    const customBus = TestBed.runInInjectionContext(() => new CustomHeadersEventBus());
    const received: BusEvent<'light' | 'dark', CustomHeaders>[] = [];

    customBus.on('theme:changed', {
      callback: (event) => {
        received.push(event);
      }
    });

    customBus.emit('theme:changed', 'dark', { headers: { traceId: '12345', tenant: 'org-a' } });

    expect(received.length).toBe(1);
    expect(received[0].headers?.traceId).toBe('12345');
    expect(received[0].headers?.tenant).toBe('org-a');
  });

  it('should support signal-based subscription via onToSignal()', () => {
    const signal = eventBus.onToSignal('theme:changed');
    expect(signal()).toBeUndefined();

    eventBus.emit('theme:changed', 'dark');
    expect(signal()).toBe('dark');
  });

  it('should support signal-based subscription via onToSignal() with a defaultValue', () => {
    const signal = eventBus.onToSignal('theme:changed', { defaultValue: 'light' });
    expect(signal()).toBe('light');

    eventBus.emit('theme:changed', 'dark');
    expect(signal()).toBe('dark');
  });

  it('should support async resource mapping via onToResource() with a defaultValue', async () => {
    const res = TestBed.runInInjectionContext(() => eventBus.onToResource('theme:changed', {
      defaultValue: 'light-default',
      loader: async ({ params }) => {
        return `fetched:${params}`;
      }
    }));

    expect(res.value()).toBe('light-default');

    eventBus.emit('theme:changed', 'dark');
    
    // Allow macro-task/promise resolution
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(res.value()).toBe('fetched:dark');
  });

  it('should support once() subscription', () => {
    const received: BusEvent<void>[] = [];
    eventBus.once('simple:event', {
      callback: (event) => { received.push(event); },
    });

    eventBus.emit('simple:event');

    expect(received.length).toBe(1);

    eventBus.emit('simple:event');

    // Secondary emit should not trigger subscription execution
    expect(received.length).toBe(1);
  });

  it('should support emitting a void event with options by passing an explicit undefined payload', () => {
    const received: BusEvent<void>[] = [];
    eventBus.on('simple:event', { callback: (event) => { received.push(event); } });

    eventBus.emit('simple:event', undefined, { headers: { source: 'test' } });

    expect(received.length).toBe(1);
    expect(received[0].headers).toEqual({ source: 'test' });
  });

  it('should support combineLatestToSignal() only once all sources have emitted', () => {
    const combined = eventBus.combineLatestToSignal([
      { key: 'user:login' },
      { key: 'theme:changed', transform: (theme: 'light' | 'dark') => theme.toUpperCase() },
    ]);

    expect(combined()).toBeUndefined();

    eventBus.emit('user:login', { userId: '1', username: 'ana' });
    expect(combined()).toBeUndefined(); // still waiting on 'theme:changed'

    eventBus.emit('theme:changed', 'dark');
    expect(combined()).toEqual([{ userId: '1', username: 'ana' }, 'DARK']);

    // Re-emitting only one of the sources should update the tuple with the latest values of both
    eventBus.emit('user:login', { userId: '2', username: 'bo' });
    expect(combined()).toEqual([{ userId: '2', username: 'bo' }, 'DARK']);
  });

  it('should support combineLatest() callback firing only after all sources have emitted', () => {
    const calls: unknown[] = [];
    const unsubscribe = eventBus.combineLatest({
      sources: [{ key: 'user:login' }, { key: 'theme:changed' }],
      callback: (events) => { calls.push(events.map((e) => e.payload)); },
    });

    eventBus.emit('user:login', { userId: '1', username: 'ana' });
    expect(calls.length).toBe(0); // 'theme:changed' hasn't emitted yet

    eventBus.emit('theme:changed', 'light');
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual([{ userId: '1', username: 'ana' }, 'light']);

    eventBus.emit('theme:changed', 'dark');
    expect(calls.length).toBe(2);
    expect(calls[1]).toEqual([{ userId: '1', username: 'ana' }, 'dark']);

    unsubscribe();

    eventBus.emit('theme:changed', 'light');
    expect(calls.length).toBe(2); // no longer subscribed
  });

  it('should support resetEvent(key) to clear a single event without affecting others', () => {
    eventBus.emit('user:login', { userId: '1', username: 'ana' });
    eventBus.emit('theme:changed', 'dark');

    eventBus.resetEvent('user:login');

    expect(eventBus.latest('user:login')).toBeUndefined();
    expect(eventBus.latest('theme:changed')?.payload).toBe('dark');
  });

  it('should support unsubscribe(key) to remove all listeners for a specific event only', () => {
    const loginReceived: unknown[] = [];
    const themeReceived: unknown[] = [];
    eventBus.on('user:login', { callback: (e) => { loginReceived.push(e.payload); } });
    eventBus.on('theme:changed', { callback: (e) => { themeReceived.push(e.payload); } });

    eventBus.unsubscribe('user:login');

    eventBus.emit('user:login', { userId: '1', username: 'ana' });
    eventBus.emit('theme:changed', 'dark');

    expect(loginReceived.length).toBe(0); // unsubscribed
    expect(themeReceived.length).toBe(1); // untouched
  });
});

describe('ALEventBus Plugin Support', () => {
  @Injectable()
  class PluginEnabledEventBus extends ALEventBus<TestEventMap> {
    testPlugin = this.registerPlugin(createTestPlugin());
  }

  let eventBus: PluginEnabledEventBus;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PluginEnabledEventBus],
    });
    eventBus = TestBed.inject(PluginEnabledEventBus);
  });

  it('should initialize the plugin with the bus instance', () => {
    expect(eventBus.testPlugin.initializedBus).toBe(eventBus);
  });

  it('should call beforeEmit and afterEmit triggers on emission', () => {
    eventBus.emit('theme:changed', 'light', { headers: { origin: 'test' } });

    expect(eventBus.testPlugin.beforeEmitCalls).toEqual([
      { key: 'theme:changed', payload: 'light', options: { headers: { origin: 'test' } } },
    ]);
    expect(eventBus.testPlugin.afterEmitCalls).toEqual([
      { key: 'theme:changed', payload: 'light', options: { headers: { origin: 'test' } } },
    ]);
    expect(eventBus.latest('theme:changed')?.headers).toEqual({ origin: 'test' });
  });

  it('should allow a plugin to override payload in onBeforeEmit', () => {
    eventBus.testPlugin.overridePayload = { userId: '999', username: 'overridden_user' };

    eventBus.emit('user:login', { userId: '123', username: 'original' });

    const latest = eventBus.latest('user:login');
    expect(latest?.payload).toEqual({ userId: '999', username: 'overridden_user' });
  });

  it('should prevent emission when onBeforeEmit returns false', () => {
    eventBus.testPlugin.cancelEmit = true;

    eventBus.emit('theme:changed', 'dark');

    expect(eventBus.latest('theme:changed')).toBeUndefined();
    expect(eventBus.testPlugin.beforeEmitCalls.length).toBe(1);
    // afterEmit should not have been called
    expect(eventBus.testPlugin.afterEmitCalls.length).toBe(0);
  });

  it('should notify plugin onDestroy on bus ngOnDestroy', () => {
    expect(eventBus.testPlugin.destroyCalled).toBe(false);
    eventBus.ngOnDestroy();
    expect(eventBus.testPlugin.destroyCalled).toBe(true);
  });

  it('should notify onSubscribe and onUnsubscribe lifecycle hooks', () => {
    expect(eventBus.testPlugin.subscribeCalls.length).toBe(0);

    const unsubscribe = eventBus.on('simple:event', { callback: () => {} });

    expect(eventBus.testPlugin.subscribeCalls.length).toBe(1);
    expect(eventBus.testPlugin.subscribeCalls[0].key).toBe('simple:event');

    const subId = eventBus.testPlugin.subscribeCalls[0].subId;
    expect(subId).toBeDefined();

    expect(eventBus.testPlugin.unsubscribeCalls.length).toBe(0);

    // Call the unsubscriber directly (or triggers cleanup)
    unsubscribe();

    expect(eventBus.testPlugin.unsubscribeCalls.length).toBe(1);
    expect(eventBus.testPlugin.unsubscribeCalls[0]).toEqual({ key: 'simple:event', subId });
  });
});

describe('ALEventBus Plugin Hook Error Isolation', () => {
  function createThrowingPlugin(): ALEventBusPlugin<TestEventMap> {
    return {
      onBeforeEmit() { throw new Error('boom: onBeforeEmit'); },
      onAfterEmit() { throw new Error('boom: onAfterEmit'); },
      onSubscribe() { throw new Error('boom: onSubscribe'); },
      onUnsubscribe() { throw new Error('boom: onUnsubscribe'); },
      onReset() { throw new Error('boom: onReset'); },
      onDestroy() { throw new Error('boom: onDestroy'); },
    };
  }

  @Injectable()
  class MixedPluginEventBus extends ALEventBus<TestEventMap> {
    healthyPlugin = this.registerPlugin(createTestPlugin());
    throwingPlugin = this.registerPlugin(createThrowingPlugin());
  }

  let eventBus: MixedPluginEventBus;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MixedPluginEventBus] });
    eventBus = TestBed.inject(MixedPluginEventBus);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('should still emit and notify the healthy plugin when another plugin throws in onBeforeEmit/onAfterEmit', () => {
    eventBus.emit('theme:changed', 'dark');

    expect(eventBus.latest('theme:changed')?.payload).toBe('dark');
    expect(eventBus.healthyPlugin.beforeEmitCalls.length).toBe(1);
    expect(eventBus.healthyPlugin.afterEmitCalls.length).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('onBeforeEmit'),
      expect.any(Error),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('onAfterEmit'),
      expect.any(Error),
    );
  });

  it('should still notify the healthy plugin when another plugin throws in onSubscribe/onUnsubscribe', () => {
    const unsubscribe = eventBus.on('simple:event', { callback: () => {} });

    expect(eventBus.healthyPlugin.subscribeCalls.length).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('onSubscribe'), expect.any(Error));

    unsubscribe();

    expect(eventBus.healthyPlugin.unsubscribeCalls.length).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('onUnsubscribe'), expect.any(Error));
  });

  it('should still destroy the healthy plugin when another plugin throws in onDestroy', () => {
    eventBus.ngOnDestroy();

    expect(eventBus.healthyPlugin.destroyCalled).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('onDestroy'), expect.any(Error));
  });

  it('should still reset without throwing when another plugin throws in onReset', () => {
    expect(() => eventBus.resetAllEvents()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('onReset'), expect.any(Error));
  });
});

describe('createEventBusHooks() DX Functional Hooks', () => {
  const { onEvent, onceEvent, emitEvent, useEventSignal } = createEventBusHooks<TestEventMap>(TestEventBus);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestEventBus],
    });
  });

  it('should support declarative hook onEvent and emitEvent under injection context', () => {
    const received: BusEvent<{ userId: string; username: string }>[] = [];
    const injector = TestBed.inject(EnvironmentInjector);

    // run in injection context for injecting TestBed config
    runInInjectionContext(injector, () => {
      onEvent('user:login', (event) => {
        received.push(event);
      }, { unsubscribeOn: 'manual' });

      emitEvent('user:login', { userId: '789', username: 'charlie' });
    });

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual({ userId: '789', username: 'charlie' });
  });

  it('should support onceEvent which triggers once and unsubscribes', () => {
    const received: string[] = [];
    const injector = TestBed.inject(EnvironmentInjector);

    runInInjectionContext(injector, () => {
      onceEvent('theme:changed', (event) => {
        received.push(event.payload);
      }, { unsubscribeOn: 'manual' });

      emitEvent('theme:changed', 'light');
      emitEvent('theme:changed', 'dark');
    });

    expect(received).toEqual(['light']);
  });

  it('should support useEventSignal for component signal binding', () => {
    const injector = TestBed.inject(EnvironmentInjector);

    runInInjectionContext(injector, () => {
      const sig = useEventSignal('theme:changed', { defaultValue: 'light' as const });
      expect(sig()).toBe('light');

      emitEvent('theme:changed', 'dark');
      expect(sig()).toBe('dark');
    });
  });

  it('should support combineEvents to react when multiple events emit', () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const received: any[] = [];

    runInInjectionContext(injector, () => {
      const { combineEvents } = createEventBusHooks<TestEventMap>(TestEventBus);

      combineEvents({
        sources: [
          { key: 'theme:changed' },
          { key: 'user:login' }
        ],
        callback: ([themeEvent, loginEvent]) => {
          received.push({
            theme: themeEvent.payload,
            user: loginEvent.payload.username
          });
        },
        unsubscribeOn: 'manual'
      });

      emitEvent('theme:changed', 'dark');
      emitEvent('user:login', { userId: '111', username: 'David' });
    });

    expect(received).toEqual([{ theme: 'dark', user: 'David' }]);
  });
});
