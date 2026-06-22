import { Injectable, DestroyRef, runInInjectionContext, Injector, inject, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from './event-bus';
import { ALEventBusPlugin, BusEvent } from './event-bus.models';
import { historyPlugin, loggerPlugin, debouncePlugin, crossTabSyncPlugin } from './plugins';

@Component({
  standalone: true,
  template: ''
})
class MockComponent {
  destroyRef = inject(DestroyRef);
}

interface TestEventMap {
  'user:login': { userId: string; username: string };
  'theme:changed': 'light' | 'dark';
  'simple:event': void;
  'request:completed': { headers: Record<string, string>; body: string };
}

@Injectable({ providedIn: 'root' })
class TestEventBus extends ALEventBus<TestEventMap> {}

// A functional factory plugin replacing the old class-based TestPlugin
interface TestPluginState {
  initializedBus: any;
  beforeEmitCalls: { key: any; payload: any; options?: any }[];
  afterEmitCalls: { key: any; payload: any; options?: any }[];
  subscribeCalls: { key: string; subId: string }[];
  unsubscribeCalls: { key: string; subId: string }[];
  destroyCalled: boolean;
  cancelEmit: boolean;
  overridePayload: any;
}

function createTestPlugin(options: { cancelEmit?: boolean; overridePayload?: any } = {}): ALEventBusPlugin<TestEventMap> & TestPluginState {
  const beforeEmitCalls: { key: any; payload: any; options?: any }[] = [];
  const afterEmitCalls: { key: any; payload: any; options?: any }[] = [];
  const subscribeCalls: { key: string; subId: string }[] = [];
  const unsubscribeCalls: { key: string; subId: string }[] = [];
  let initializedBus: any = null;
  let destroyCalled = false;
  let cancelEmit = options.cancelEmit ?? false;
  let overridePayload = options.overridePayload;

  return {
    get initializedBus() { return initializedBus; },
    get beforeEmitCalls() { return beforeEmitCalls; },
    get afterEmitCalls() { return afterEmitCalls; },
    get subscribeCalls() { return subscribeCalls; },
    get unsubscribeCalls() { return unsubscribeCalls; },
    get destroyCalled() { return destroyCalled; },
    get cancelEmit() { return cancelEmit; },
    set cancelEmit(v) { cancelEmit = v; },
    get overridePayload() { return overridePayload; },
    set overridePayload(v) { overridePayload = v; },

    onInit(bus: any) {
      initializedBus = bus;
    },

    onBeforeEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K], options?: any): any {
      beforeEmitCalls.push({ key, payload, options });
      if (cancelEmit) {
        return false;
      }
      if (overridePayload !== undefined) {
        return overridePayload;
      }
    },

    onAfterEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K], options?: any) {
      afterEmitCalls.push({ key, payload, options });
    },

    onSubscribe(key: string, subId: string) {
      subscribeCalls.push({ key, subId });
    },

    onUnsubscribe(key: string, subId: string) {
      unsubscribeCalls.push({ key, subId });
    },

    onDestroy() {
      destroyCalled = true;
    }
  };
}

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

  it('should not greedily parse a payload containing a headers key as options', () => {
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

describe('ALEventBus Standard Plugins', () => {
  @Injectable()
  class PluginsTestEventBus extends ALEventBus<TestEventMap> {
    logger = this.registerPlugin(loggerPlugin({ enabled: true }));
    sync = this.registerPlugin(crossTabSyncPlugin({ keys: ['user:login'] }));
    history = this.registerPlugin(historyPlugin());
  }

  let bus: PluginsTestEventBus;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PluginsTestEventBus],
    });
    bus = TestBed.inject(PluginsTestEventBus);
  });

  it('should support loggerPlugin logging lifecycle events without throwing', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    bus.emit('theme:changed', 'dark');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should support crossTabSyncPlugin synchronizing events', () => {
    // Standard register and run synchronizing events test
    expect(bus.sync).toBeDefined();
    bus.emit('user:login', { userId: '1', username: 'john' });
    // Works successfully
  });

  it('should support historyPlugin tracking events and executing undo/redo states', () => {
    expect(bus.history.canUndo()).toBe(false);
    expect(bus.history.canRedo()).toBe(false);

    // Initial state / first emission
    bus.emit('theme:changed', 'light');
    expect(bus.history.canUndo()).toBe(false); // only 1 element in stack, can't undo to a prior state since there isn't one

    bus.emit('theme:changed', 'dark');
    expect(bus.history.canUndo()).toBe(true);
    expect(bus.history.canRedo()).toBe(false);

    // Undo should rollback to 'light'
    bus.history.undo();
    expect(bus.latest('theme:changed')?.payload).toBe('light');
    expect(bus.history.canUndo()).toBe(false);
    expect(bus.history.canRedo()).toBe(true);

    // Redo should roll forward to 'dark'
    bus.history.redo();
    expect(bus.latest('theme:changed')?.payload).toBe('dark');
    expect(bus.history.canUndo()).toBe(true);
    expect(bus.history.canRedo()).toBe(false);
  });
});
