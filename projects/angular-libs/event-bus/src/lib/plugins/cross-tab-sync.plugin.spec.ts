import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { crossTabSyncPlugin } from './cross-tab-sync.plugin';

interface TestEventMap {
  'user:login': { userId: string };
  'theme:changed': 'light' | 'dark';
}

/**
 * A minimal BroadcastChannel mock that simulates real cross-tab delivery semantics:
 * `postMessage` is delivered to every OTHER open instance sharing the same channel name
 * (never back to the sender itself), synchronously for deterministic test assertions.
 */
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: ((event: { data: any }) => void) | null = null;
  closed = false;
  postMessage = vi.fn((data: any) => {
    MockBroadcastChannel.instances
      .filter((i) => i !== this && i.name === this.name && !i.closed)
      .forEach((i) => i.onmessage?.({ data }));
  });
  constructor(public name: string) {
    MockBroadcastChannel.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe('crossTabSyncPlugin', () => {
  let originalBroadcastChannel: any;

  @Injectable()
  class SyncEventBus extends ALEventBus<TestEventMap> {
    sync = this.registerPlugin(crossTabSyncPlugin());
  }

  function createBus(): SyncEventBus {
    return TestBed.runInInjectionContext(() => new SyncEventBus());
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  beforeEach(() => {
    originalBroadcastChannel = (globalThis as any).BroadcastChannel;
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
    MockBroadcastChannel.instances = [];
  });

  afterEach(() => {
    (globalThis as any).BroadcastChannel = originalBroadcastChannel;
  });

  it('should broadcast emitted events to other tabs via postMessage', () => {
    const bus = createBus();
    bus.emit('user:login', { userId: '1' });

    const channel = MockBroadcastChannel.instances[0];
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'emit', key: 'user:login', payload: { userId: '1' } }),
    );
  });

  it('should re-emit incoming messages from other tabs locally and prevent broadcast echo loops', () => {
    const busA = createBus();
    const busB = createBus();

    const received: any[] = [];
    busB.on('user:login', { callback: (e) => { received.push(e); }, unsubscribeOn: 'manual' });

    busA.emit('user:login', { userId: '42' });

    expect(received.length).toBe(1);
    expect(received[0].payload).toEqual({ userId: '42' });

    // busB re-emitted locally (tagged with the sync header) but must NOT re-broadcast it back out
    const channelB = MockBroadcastChannel.instances[1];
    expect(channelB.postMessage).not.toHaveBeenCalled();
  });

  it('should broadcast a reset via onReset, and apply incoming remote resets without re-broadcasting (loop guard)', () => {
    const busA = createBus();
    const busB = createBus();

    busB.emit('user:login', { userId: '7' });
    expect(busB.latest('user:login')).toBeDefined();

    const channelB = MockBroadcastChannel.instances[1];
    channelB.postMessage.mockClear();

    busA.resetAllEvents();

    const channelA = MockBroadcastChannel.instances[0];
    expect(channelA.postMessage).toHaveBeenCalledWith({ type: 'reset', key: undefined });

    // busB applied the remote reset...
    expect(busB.latest('user:login')).toBeUndefined();

    // ...but must NOT re-broadcast it back out (the loop guard prevents an infinite ping-pong)
    expect(channelB.postMessage).not.toHaveBeenCalled();
  });

  it('should ignore inbound emits and resets for keys outside the `keys` filter', () => {
    @Injectable()
    class FilteredSyncBus extends ALEventBus<TestEventMap> {
      sync = this.registerPlugin(crossTabSyncPlugin({ keys: ['user:login'] }));
    }
    const bus = TestBed.runInInjectionContext(() => new FilteredSyncBus());

    bus.emit('user:login', { userId: 'keep' });
    bus.emit('theme:changed', 'light');

    const channel = MockBroadcastChannel.instances[0];
    channel.onmessage?.({
      data: { type: 'emit', key: 'theme:changed', payload: 'dark' },
    });
    expect(bus.latest('theme:changed')?.payload).toBe('light');

    channel.onmessage?.({
      data: { type: 'reset', key: undefined },
    });
    expect(bus.latest('user:login')).toBeUndefined();
    expect(bus.latest('theme:changed')?.payload).toBe('light');
  });

  it('should not broadcast for keys excluded by the `keys` filter option', () => {
    @Injectable()
    class FilteredSyncBus extends ALEventBus<TestEventMap> {
      sync = this.registerPlugin(crossTabSyncPlugin({ keys: ['user:login'] }));
    }
    const bus = TestBed.runInInjectionContext(() => new FilteredSyncBus());

    bus.emit('theme:changed', 'dark');

    const channel = MockBroadcastChannel.instances[0];
    expect(channel.postMessage).not.toHaveBeenCalled();
  });
});
