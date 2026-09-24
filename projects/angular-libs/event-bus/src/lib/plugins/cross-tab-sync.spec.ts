import { EnvironmentInjector, Injectable, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { EventBusPlugin } from '../event-bus.models';
import { MockBroadcastChannel } from '../testing/mock-broadcast-channel';
import { TestEventMap, TestHeaders } from '../testing/test-bus';
import { withCrossTabSync, ɵTAB_ID } from './cross-tab-sync';
import { withDebounce } from './debounce';

describe('withCrossTabSync', () => {
  let restore: () => void;
  const tabs: EnvironmentInjector[] = [];

  function openTab(...features: EventBusPlugin<TestEventMap, any>[]) {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap, TestHeaders> {
      constructor() {
        super();
        this.use(...features);
      }
    }
    const tab = createEnvironmentInjector([Bus], TestBed.inject(EnvironmentInjector));
    tabs.push(tab);
    return tab.get(Bus);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    restore = MockBroadcastChannel.install();
  });
  afterEach(() => {
    tabs.splice(0).forEach((tab) => tab.destroy());
    restore();
  });

  it('delivers events in other tabs with origin "remote" and never echoes them back', () => {
    const a = openTab(withCrossTabSync({ channel: 'app' }));
    const b = openTab(withCrossTabSync({ channel: 'app' }));
    const [channelA, channelB] = MockBroadcastChannel.instances;

    a.emit('user:login', { userId: '1' }, { headers: { traceId: 't' } });

    expect(b.latest('user:login')).toMatchObject({ payload: { userId: '1' }, headers: { traceId: 't' }, origin: 'remote' });
    expect(channelA.posted).toHaveLength(1);
    expect(channelB.posted).toEqual([]);
  });

  it('syncs resets without echo, respecting the keys filter', () => {
    const a = openTab(withCrossTabSync({ channel: 'app', keys: ['user:login'] }));
    const b = openTab(withCrossTabSync({ channel: 'app', keys: ['user:login'] }));
    b.emit('user:login', { userId: '1' });
    b.emit('theme:changed', 'dark');
    const [channelA, channelB] = MockBroadcastChannel.instances;
    channelB.posted.length = 0;

    a.resetAllEvents();
    expect(b.latest('user:login')).toBeUndefined();
    expect(b.latest('theme:changed')?.payload).toBe('dark'); // not a synced key
    a.resetEvent('theme:changed');
    expect(channelA.posted.filter((m) => m.key === 'theme:changed')).toEqual([]);
    expect(channelB.posted).toEqual([]);
  });

  it('syncs only the listed keys', () => {
    const a = openTab(withCrossTabSync({ channel: 'app', keys: ['user:logout'] }));
    const b = openTab(withCrossTabSync({ channel: 'app', keys: ['user:logout'] }));
    a.emit('count:changed', 1);
    expect(b.latest('count:changed')).toBeUndefined();
    a.emit('user:logout');
    expect(b.latest('user:logout')).toBeDefined();
  });

  it('ignores messages from the same tab, and foreign or malformed messages', () => {
    const b = openTab(withCrossTabSync({ channel: 'app' }));
    MockBroadcastChannel.sameTab = true;
    const sender = new MockBroadcastChannel('app');
    sender.postMessage({ kind: '@angular-libs/event-bus', sender: ɵTAB_ID, type: 'emit', key: 'user:logout' });
    MockBroadcastChannel.sameTab = false;
    sender.postMessage({ type: 'emit', key: 'user:logout' });
    sender.postMessage({ kind: '@angular-libs/event-bus', sender: 'x', type: 'emit', key: 42 });
    sender.postMessage(null);
    expect(b.latest('user:logout')).toBeUndefined();
  });

  it('never ping-pongs with debounce, whichever plugin comes first', () => {
    vi.useFakeTimers();
    try {
      const orders: EventBusPlugin<TestEventMap, any>[][] = [
        [withDebounce<TestEventMap>('search:typed', 100), withCrossTabSync({ channel: 'x' })],
        [withCrossTabSync({ channel: 'y' }), withDebounce<TestEventMap>('search:typed', 100)],
      ];
      for (const features of orders) {
        MockBroadcastChannel.instances = [];
        const a = openTab(...features);
        const b = openTab(...features);
        a.emit('search:typed', 'h');
        a.emit('search:typed', 'hi');
        vi.advanceTimersByTime(1000);
        expect(b.latest('search:typed')?.payload).toBe('hi');
        expect(MockBroadcastChannel.instances[1].posted).toEqual([]);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs payloads that cannot be cloned instead of throwing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = openTab(withCrossTabSync({ channel: 'app' }));
    MockBroadcastChannel.instances[0].postMessage = () => { throw new DOMException('no clone', 'DataCloneError'); };
    expect(() => a.emit('search:typed', 'x')).not.toThrow();
    expect(a.latest('search:typed')?.payload).toBe('x');
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('closes the channel with the bus, and is a no-op without BroadcastChannel', () => {
    openTab(withCrossTabSync({ channel: 'app' }));
    tabs.splice(0).forEach((tab) => tab.destroy());
    expect(MockBroadcastChannel.instances[0].closed).toBe(true);

    (globalThis as any).BroadcastChannel = undefined;
    const bus = openTab(withCrossTabSync({ channel: 'app' }));
    expect(() => bus.emit('search:typed', 'ssr')).not.toThrow();
  });
});
