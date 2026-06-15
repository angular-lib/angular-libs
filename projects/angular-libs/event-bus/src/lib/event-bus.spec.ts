import { Injectable, DestroyRef, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from './event-bus';
import { ALEventBusPlugin, BusEvent } from './event-bus.models';

interface TestEventMap {
  'user:login': { userId: string; username: string };
  'theme:changed': 'light' | 'dark';
  'simple:event': void;
}

@Injectable({ providedIn: 'root' })
class TestEventBus extends ALEventBus<TestEventMap> {}

// A mock logging/interceptor plugin
class TestPlugin implements ALEventBusPlugin<TestEventMap> {
  initializedBus: any = null;
  beforeEmitCalls: { key: any; payload: any }[] = [];
  afterEmitCalls: { key: any; payload: any }[] = [];
  destroyCalled = false;
  cancelEmit = false;
  overridePayload: any = undefined;

  onInit(bus: any) {
    this.initializedBus = bus;
  }

  onBeforeEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K]): any {
    this.beforeEmitCalls.push({ key, payload });
    if (this.cancelEmit) {
      return false;
    }
    if (this.overridePayload !== undefined) {
      return this.overridePayload;
    }
  }

  onAfterEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K]) {
    this.afterEmitCalls.push({ key, payload });
  }

  onDestroy() {
    this.destroyCalled = true;
  }
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

  it('should support callback based subscriptions via on()', async () => {
    const received: BusEvent<{ userId: string; username: string }>[] = [];
    const unsubscribe = eventBus.on('user:login', {
      callback: (event) => { received.push(event); },
    });

    await Promise.resolve(); // wait for internal async microtask to create effect

    eventBus.emit('user:login', { userId: '456', username: 'bob' });

    // Wait for the Microtask/Promise execution in on()'s internal setup
    // Since ALEventBus uses set() inside Promise.resolve().then() to initialize the effect
    TestBed.flushEffects();

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual({ userId: '456', username: 'bob' });

    unsubscribe();
  });

  it('should support signal-based subscription via onToSignal()', () => {
    const signal = eventBus.onToSignal('theme:changed');
    expect(signal()).toBeUndefined();

    eventBus.emit('theme:changed', 'dark');
    expect(signal()).toBe('dark');
  });

  it('should support once() subscription', async () => {
    const received: BusEvent<void>[] = [];
    eventBus.once('simple:event', {
      callback: (event) => { received.push(event); },
    });

    await Promise.resolve(); // wait for internal async microtask to create effect

    eventBus.emit('simple:event');
    TestBed.flushEffects();

    expect(received.length).toBe(1);

    eventBus.emit('simple:event');
    TestBed.flushEffects();

    // Secondary emit should not trigger subscription execution
    expect(received.length).toBe(1);
  });
});

describe('ALEventBus Plugin Support', () => {
  @Injectable()
  class PluginEnabledEventBus extends ALEventBus<TestEventMap> {
    testPlugin = this.registerPlugin(new TestPlugin());
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
    eventBus.emit('theme:changed', 'light');

    expect(eventBus.testPlugin.beforeEmitCalls).toEqual([
      { key: 'theme:changed', payload: 'light' },
    ]);
    expect(eventBus.testPlugin.afterEmitCalls).toEqual([
      { key: 'theme:changed', payload: 'light' },
    ]);
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
});
