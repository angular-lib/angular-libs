import { TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWebSocket, websocketResource } from './socket';
import { createWebSocketLoggerPlugin } from './plugins/logger.plugin';
import { createWebSocketMultiplexPlugin } from './plugins/multiplex.plugin';
import { WebSocketStatus, WebSocketPlugin, WebSocketOutboxStorage } from './socket.types';

// Mock Web Socket Implementation
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onclose: (() => void) | null = null;
  sentPayloads: any[] = [];
  closed = false;
  failNextSend = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: any) {
    if (this.failNextSend) {
      this.failNextSend = false;
      throw new Error('Simulated send failure');
    }
    this.sentPayloads.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  triggerOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) this.onopen();
  }

  triggerMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }

  triggerError(err: any) {
    if (this.onerror) this.onerror(err);
  }

  triggerClose() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
}

describe('websocketResource', () => {
  let originalWebSocket: any;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as any;
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('should establish a WebSocket connection and update status and message', async () => {
    const urlSignal = signal('ws://test.com/socket-1');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, { heartbeatInterval: 0 })
    );

    // Initial state
    expect(socketRes.value()).toBeUndefined();

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    expect(mockSocket.url).toBe('ws://test.com/socket-1');

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const client = socketRes.value();
    expect(client).toBeTruthy();
    expect(client!.status()).toBe('connecting');
    expect(client!.isConnected()).toBe(false);

    // Open connection
    mockSocket.triggerOpen();
    expect(client!.status()).toBe('connected');
    expect(client!.isConnected()).toBe(true);

    // Receive message
    mockSocket.triggerMessage(JSON.stringify({ greeting: 'Hello' }));
    expect(client!.message()).toEqual({ greeting: 'Hello' });
    expect(client!.error()).toBeNull();
  });

  it('should cleanly abort previous connection and start a new connection when request URL changes', async () => {
    const urlSignal = signal('ws://test.com/socket-1');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, { heartbeatInterval: 0 })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket1 = MockWebSocket.instances[0];
    mockSocket1.triggerOpen();

    // Trigger URL change
    urlSignal.set('ws://test.com/socket-2');

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(2);
    });

    expect(mockSocket1.closed).toBe(true);

    const mockSocket2 = MockWebSocket.instances[1];
    expect(mockSocket2.url).toBe('ws://test.com/socket-2');
  });

  it('should trigger heartbeats on interval', async () => {
    vi.useFakeTimers();

    const urlSignal = signal('ws://test.com/heartbeat');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, {
        heartbeatInterval: 5000,
        heartbeatPayload: 'ping-test'
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    // Fast-forward timers
    vi.advanceTimersByTime(5000);
    expect(mockSocket.sentPayloads).toContain(JSON.stringify('ping-test'));

    vi.advanceTimersByTime(5000);
    expect(mockSocket.sentPayloads.length).toBe(2);

    socketRes.value()?.close();
    vi.useRealTimers();
  });

  it('should buffer payloads while offline and auto-flush on reconnecting', async () => {
    const urlSignal = signal('ws://test.com/buffer');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, { heartbeatInterval: 0, bufferWhileOffline: true })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const mockSocket = MockWebSocket.instances[0];
    const client = socketRes.value()!;

    // Send payload before opening connection (should buffer)
    const sent = client.send({ text: 'Hello Offline' });
    expect(sent).toBe(true);
    expect(client.bufferedCount()).toBe(1);
    expect(mockSocket.sentPayloads.length).toBe(0);

    // Open connection (should flush)
    mockSocket.triggerOpen();
    expect(client.bufferedCount()).toBe(0);
    expect(mockSocket.sentPayloads).toEqual([JSON.stringify({ text: 'Hello Offline' })]);
  });

  it('should handle custom serialization and deserialization', async () => {
    const customSerializer = vi.fn((val: any) => `CUSTOM-${val}`);
    const customDeserializer = vi.fn((ev: MessageEvent) => `DESERIALIZE-${ev.data}`);

    const urlSignal = signal('ws://test.com/custom');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, {
        heartbeatInterval: 0,
        serializer: customSerializer,
        deserializer: customDeserializer
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    const client = socketRes.value()!;
    client.send('hi');

    expect(customSerializer).toHaveBeenCalledWith('hi');
    expect(mockSocket.sentPayloads).toContain('CUSTOM-hi');

    mockSocket.triggerMessage('incoming');
    expect(customDeserializer).toHaveBeenCalled();
    expect(client.message()).toBe('DESERIALIZE-incoming');
  });

  it('should invoke plugin hooks correctly', async () => {
    const beforeConnectMock = vi.fn((url: string) => `${url}?auth=key`);
    const beforeSendMock = vi.fn((val: any) => ({ ...val, processed: true }));
    const messageReceivedMock = vi.fn((val: any) => ({ ...val, received: true }));
    const statusChangeMock = vi.fn();
    const errorMock = vi.fn();

    const testPlugin: WebSocketPlugin = {
      onBeforeConnect: beforeConnectMock,
      onBeforeSend: beforeSendMock,
      onMessageReceived: messageReceivedMock,
      onStatusChange: statusChangeMock,
      onError: errorMock
    };

    const urlSignal = signal('ws://test.com/plugins');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, {
        heartbeatInterval: 0,
        plugins: [testPlugin]
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const mockSocket = MockWebSocket.instances[0];
    expect(mockSocket.url).toBe('ws://test.com/plugins?auth=key');
    expect(beforeConnectMock).toHaveBeenCalledWith('ws://test.com/plugins');

    expect(statusChangeMock).toHaveBeenCalledWith('disconnected', 'connecting');

    mockSocket.triggerOpen();
    expect(statusChangeMock).toHaveBeenCalledWith('connecting', 'connected');

    const client = socketRes.value()!;
    client.send({ data: 'hello' });

    expect(beforeSendMock).toHaveBeenCalledWith({ data: 'hello' });
    expect(mockSocket.sentPayloads).toContain(JSON.stringify({ data: 'hello', processed: true }));

    mockSocket.triggerMessage(JSON.stringify({ msg: 'test' }));
    expect(messageReceivedMock).toHaveBeenCalledWith({ msg: 'test' });
    expect(client.message()).toEqual({ msg: 'test', received: true });

    mockSocket.triggerError(new Error('Ooops'));
    expect(errorMock).toHaveBeenCalled();
    expect(client.error()).toBeDefined();
  });

  it('should try reconnecting automatically with exponential backoff', async () => {
    vi.useFakeTimers();

    const urlSignal = signal('ws://test.com/reconnect');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, {
        heartbeatInterval: 0,
        maxReconnectAttempts: 3,
        initialReconnectDelay: 1000,
        backoffFactor: 2
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const mockSocket1 = MockWebSocket.instances[0];
    const client = socketRes.value()!;
    mockSocket1.triggerOpen();

    // Trigger unexpected close
    mockSocket1.triggerClose();
    expect(client.status()).toBe('reconnecting');

    // First reconnect attempt after 1000ms
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances.length).toBe(2);
    const mockSocket2 = MockWebSocket.instances[1];
    expect(client.status()).toBe('reconnecting');

    // Close second attempt too
    mockSocket2.triggerClose();

    // Second reconnect attempt after 2000ms
    vi.advanceTimersByTime(2000);
    expect(MockWebSocket.instances.length).toBe(3);
    const mockSocket3 = MockWebSocket.instances[2];

    mockSocket3.triggerClose();

    // Third reconnect attempt after 4000ms
    vi.advanceTimersByTime(4000);
    expect(MockWebSocket.instances.length).toBe(4);
    const mockSocket4 = MockWebSocket.instances[3];

    // Trigger final timeout close
    mockSocket4.triggerClose();
    expect(client.status()).toBe('disconnected');
    expect(client.error()?.message).toContain('Max reconnection attempts reached');

    vi.useRealTimers();
  });

  it('should fallback to safe dummy state if WebSocket is undefined (SSR mode)', async () => {
    const originalWS = globalThis.WebSocket;
    delete (globalThis as any).WebSocket;

    const urlSignal = signal('ws://test.com/ssr');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal)
    );

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const client = socketRes.value();
    expect(client).toBeTruthy();
    expect(client!.status()).toBe('disconnected');
    expect(client!.isConnected()).toBe(false);
    expect(client!.send({ text: 'any' })).toBe(false);

    globalThis.WebSocket = originalWS;
  });

  it('should support custom webSocketFactory options for offline testing bypasses', async () => {
    const customSocketInstance = {
      readyState: 1, // OPEN
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      send: vi.fn(),
      close: vi.fn()
    };
    const customFactory = vi.fn(() => customSocketInstance as any);

    const urlSignal = signal('ws://test.com/factory');
    const socketRes = TestBed.runInInjectionContext(() =>
      websocketResource(urlSignal, {
        heartbeatInterval: 0,
        webSocketFactory: customFactory
      })
    );

    await vi.waitFor(() => {
      expect(socketRes.value()).toBeDefined();
    });

    const client = socketRes.value()!;
    expect(customFactory).toHaveBeenCalledWith('ws://test.com/factory');
  });

  it('should expose an immediately stable client with explicit queued send results', async () => {
    const urlSignal = signal('ws://test.com/stable-client');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket<{ text: string }, { text: string }>(urlSignal, {
        bufferWhileOffline: true,
      })
    );

    expect(client.status()).toBe('disconnected');
    expect(client.send({ text: 'queued' })).toEqual({ accepted: true, disposition: 'queued' });
    expect(client.bufferedCount()).toBe(1);

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    MockWebSocket.instances[0].triggerOpen();
    expect(client.status()).toBe('connected');
    expect(MockWebSocket.instances[0].sentPayloads).toEqual([JSON.stringify({ text: 'queued' })]);
    client.close();
  });

  it('should filter heartbeats with the explicit protocol predicate', async () => {
    const urlSignal = signal('ws://test.com/heartbeats');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        heartbeat: {
          intervalMs: 5_000,
          payload: 'ping',
          isHeartbeat: (event) => event.data === JSON.stringify('ping'),
        },
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    MockWebSocket.instances[0].triggerOpen();
    MockWebSocket.instances[0].triggerMessage(JSON.stringify('ping'));
    expect(client.message()).toBeNull();
    client.close();
  });

  it('should preserve the failed and remaining outbox messages in order', async () => {
    const urlSignal = signal('ws://test.com/outbox');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket<string, string>(urlSignal, { bufferWhileOffline: true })
    );

    client.send('first');
    client.send('second');

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const socket = MockWebSocket.instances[0];
    socket.failNextSend = true;
    socket.triggerOpen();

    expect(client.bufferedCount()).toBe(2);
    expect(socket.sentPayloads).toEqual([]);
    client.close();
  });

  it('should close the previous transport before manually reconnecting', async () => {
    const urlSignal = signal('ws://test.com/manual-reconnect');
    const client = TestBed.runInInjectionContext(() => createWebSocket(urlSignal));

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const firstSocket = MockWebSocket.instances[0];
    firstSocket.triggerOpen();
    client.reconnect();

    expect(firstSocket.closed).toBe(true);
    expect(MockWebSocket.instances.length).toBe(2);
    expect(client.status()).toBe('connecting');
    client.close();
  });

  it('should support async onBeforeConnect plugin hook for token resolution', async () => {
    const asyncConnectMock = vi.fn(async (url: string) => {
      await new Promise((r) => setTimeout(r, 10));
      return `${url}?token=async-bearer-123`;
    });

    const urlSignal = signal('ws://test.com/async-auth');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        plugins: [{ onBeforeConnect: asyncConnectMock }]
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    expect(mockSocket.url).toBe('ws://test.com/async-auth?token=async-bearer-123');
    client.close();
  });

  it('should respond to online and offline window events when detectNetworkStatus is true', async () => {
    const urlSignal = signal('ws://test.com/network-events');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, { detectNetworkStatus: true })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();
    expect(client.status()).toBe('connected');

    // Simulate going offline
    window.dispatchEvent(new Event('offline'));
    expect(client.status()).toBe('reconnecting');
    expect(mockSocket.closed).toBe(true);

    // Simulate coming back online -> triggers instant reconnection
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(2);
    });

    const mockSocket2 = MockWebSocket.instances[1];
    expect(client.status()).toBe('connecting');
    mockSocket2.triggerOpen();
    expect(client.status()).toBe('connected');

    client.close();
  });

  it('should persist offline queued messages using persistent outbox storage', async () => {
    const memoryStorage: any[] = [];
    const mockStorage: WebSocketOutboxStorage<string> = {
      getItem: vi.fn(async () => [...memoryStorage]),
      setItem: vi.fn(async (items) => {
        memoryStorage.length = 0;
        memoryStorage.push(...items);
      })
    };

    const urlSignal = signal('ws://test.com/outbox-storage');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        bufferWhileOffline: true,
        outbox: { storage: mockStorage }
      })
    );

    // Enqueue message while offline
    client.send('offline-msg-1');
    client.send('offline-msg-2');

    expect(client.bufferedCount()).toBe(2);
    expect(mockStorage.setItem).toHaveBeenCalledWith(['offline-msg-1', 'offline-msg-2']);
    expect(memoryStorage).toEqual(['offline-msg-1', 'offline-msg-2']);

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    expect(mockSocket.sentPayloads).toContain(JSON.stringify('offline-msg-1'));
    expect(mockSocket.sentPayloads).toContain(JSON.stringify('offline-msg-2'));
    expect(client.bufferedCount()).toBe(0);

    client.close();
  });

  it('should route and filter messages per channel/topic using multiplex plugin', async () => {
    const multiplexPlugin = createWebSocketMultiplexPlugin<{ topic: string; data: any }, { topic: string; payload: any }>();

    const urlSignal = signal('ws://test.com/multiplex');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        plugins: [multiplexPlugin]
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    const topicCallback = vi.fn();
    const unsubscribe = multiplexPlugin.subscribe('work-order:101', topicCallback);
    const trackingSignal = multiplexPlugin.topicSignal('work-order:101');

    expect(trackingSignal()).toBeNull();

    // Trigger message for another topic
    mockSocket.triggerMessage(JSON.stringify({ topic: 'chat:general', payload: { text: 'hello' } }));
    expect(topicCallback).not.toHaveBeenCalled();
    expect(trackingSignal()).toBeNull();

    // Trigger message for subscribed topic
    mockSocket.triggerMessage(JSON.stringify({ topic: 'work-order:101', payload: { status: 'IN_PROGRESS' } }));

    expect(topicCallback).toHaveBeenCalledWith({ topic: 'work-order:101', payload: { status: 'IN_PROGRESS' } });
    expect(trackingSignal()).toEqual({ topic: 'work-order:101', payload: { status: 'IN_PROGRESS' } });

    // Format payload test
    const formatted = multiplexPlugin.formatPayload('work-order:101', { action: 'UPDATE' });
    expect(formatted).toEqual({ topic: 'work-order:101', data: { action: 'UPDATE' } });

    unsubscribe();
    client.close();
  });

  it('should call clear() on storage when outbox empties and respect maxSize on async load', async () => {
    const memoryStorage: string[] = ['persisted-1', 'persisted-2', 'persisted-3'];
    const mockStorage: WebSocketOutboxStorage<string> = {
      getItem: vi.fn(async () => [...memoryStorage]),
      setItem: vi.fn(async (items) => {
        memoryStorage.length = 0;
        memoryStorage.push(...items);
      }),
      clear: vi.fn(async () => {
        memoryStorage.length = 0;
      })
    };

    const urlSignal = signal('ws://test.com/outbox-clear');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        bufferWhileOffline: true,
        outbox: { storage: mockStorage, maxSize: 2, overflow: 'drop-oldest' }
      })
    );

    client.send('new-msg');

    await vi.waitFor(() => {
      expect(client.bufferedCount()).toBe(2);
    });

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    expect(client.bufferedCount()).toBe(0);
    expect(mockStorage.clear).toHaveBeenCalled();
    expect(memoryStorage).toEqual([]);

    client.close();
  });

  it('should handle multiplex wire framing, client sending, reconnect resubscribing and active topics', async () => {
    const multiplexPlugin = createWebSocketMultiplexPlugin<
      { action: string; topic: string; data?: any },
      { topic: string; payload: any }
    >({
      onSubscribeTopic: (topic) => ({ action: 'subscribe', topic }),
      onUnsubscribeTopic: (topic) => ({ action: 'unsubscribe', topic })
    });

    const urlSignal = signal('ws://test.com/multiplex-wire');
    const client = TestBed.runInInjectionContext(() =>
      createWebSocket(urlSignal, {
        plugins: [multiplexPlugin]
      })
    );

    await vi.waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.triggerOpen();

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const unsub1 = multiplexPlugin.subscribe('orders:5', cb1);
    expect(mockSocket.sentPayloads).toContain(JSON.stringify({ action: 'subscribe', topic: 'orders:5' }));
    expect(multiplexPlugin.getActiveTopics()).toEqual(['orders:5']);

    mockSocket.sentPayloads.length = 0;
    const unsub2 = multiplexPlugin.subscribe('orders:5', cb2);
    expect(mockSocket.sentPayloads.length).toBe(0);

    multiplexPlugin.send('orders:5', { item: 'book' });
    expect(mockSocket.sentPayloads).toContain(JSON.stringify({ topic: 'orders:5', data: { item: 'book' } }));

    mockSocket.sentPayloads.length = 0;
    multiplexPlugin.onStatusChange?.('reconnecting', 'connected');
    expect(mockSocket.sentPayloads).toContain(JSON.stringify({ action: 'subscribe', topic: 'orders:5' }));

    mockSocket.sentPayloads.length = 0;
    unsub1();
    expect(mockSocket.sentPayloads.length).toBe(0);

    unsub2();
    expect(mockSocket.sentPayloads).toContain(JSON.stringify({ action: 'unsubscribe', topic: 'orders:5' }));
    expect(multiplexPlugin.getActiveTopics()).toEqual([]);

    client.close();
  });
});

