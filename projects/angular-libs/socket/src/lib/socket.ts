import {
  createEnvironmentInjector,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  Injector,
  isDevMode,
  resource,
  ResourceRef,
  runInInjectionContext,
  signal,
  computed,
  untracked,
} from '@angular/core';
import {
  CreateWebSocketOptions,
  SendResult,
  SocketClient,
  WebSocketClient,
  WebSocketError,
  WebSocketLike,
  WebSocketOutboxStorage,
  WebSocketResourceOptions,
  WebSocketStatus,
} from './socket.types';

const OPEN = 1;

function createError(kind: WebSocketError['kind'], message: string, cause: unknown): WebSocketError {
  return { kind, message, cause, at: Date.now() };
}

function defaultSerializer(payload: unknown): string {
  return JSON.stringify(payload);
}

function defaultDeserializer<TReceive>(event: MessageEvent): TReceive {
  return JSON.parse(event.data) as TReceive;
}

/**
 * Creates a stable, signal-first WebSocket client. The client is automatically
 * closed when its owning Angular injection context is destroyed.
 */
export function createWebSocket<TSend = unknown, TReceive = unknown>(
  url: () => string | null | undefined,
  options: CreateWebSocketOptions<TSend, TReceive> = {},
): SocketClient<TSend, TReceive> {
  let destroyRef: DestroyRef | null = null;
  let effectInjector: Injector | undefined = options.injector;
  if (options.injector) {
    destroyRef = options.injector.get(DestroyRef, null);
  } else {
    try {
      destroyRef = inject(DestroyRef, { optional: true });
      effectInjector = inject(Injector);
    } catch {
      // Called outside an injection context without an explicit options.injector
    }
  }

  if (isDevMode() && !destroyRef) {
    console.warn(
      `[createWebSocket] Could not resolve DestroyRef. Automatic socket teardown will not occur.\n` +
      `To enable automatic teardown, call createWebSocket() within an active injection context ` +
      `(such as a constructor or field initializer) or pass an explicit 'injector' option.`
    );
  }
  const serializer = options.serializer ?? defaultSerializer;
  const deserializer = options.deserializer ?? defaultDeserializer<TReceive>;
  const reconnect = {
    maxAttempts: options.reconnect?.maxAttempts ?? options.maxReconnectAttempts ?? 5,
    initialDelayMs: options.reconnect?.initialDelayMs ?? options.initialReconnectDelay ?? 1_000,
    maxDelayMs: options.reconnect?.maxDelayMs ?? options.maxReconnectDelay ?? 15_000,
    backoffFactor: options.reconnect?.backoffFactor ?? options.backoffFactor ?? 2,
  };
  const outbox = {
    maxSize: options.outbox?.maxSize ?? Number.POSITIVE_INFINITY,
    overflow: options.outbox?.overflow ?? 'reject-newest',
    storage: options.outbox?.storage as WebSocketOutboxStorage<TSend> | undefined,
  };
  const heartbeat = options.heartbeat ?? (options.heartbeatInterval && options.heartbeatInterval > 0
    ? {
        intervalMs: options.heartbeatInterval,
        payload: options.heartbeatPayload ?? 'ping',
        isHeartbeat: (event: MessageEvent) => {
          try {
            return event.data === serializer(options.heartbeatPayload ?? 'ping');
          } catch {
            return false;
          }
        },
      }
    : undefined);
  const plugins = options.plugins ?? [];
  const canCreateTransport = Boolean(options.webSocketFactory) || typeof WebSocket !== 'undefined';

  const currentStatus = signal<WebSocketStatus>('disconnected');
  const latestMessage = signal<TReceive | null>(null);
  const currentError = signal<WebSocketError | null>(null);
  const queuedMessages = signal<TSend[]>([]);
  const retryDelay = signal<number | null>(null);
  const isConnected = computed(() => currentStatus() === 'connected');
  const bufferedCount = computed(() => queuedMessages().length);
  const subscribers = new Set<(message: TReceive) => void>();

  let socket: WebSocketLike | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let intentionallyClosed = false;
  let activeUrl: string | null = null;
  let generation = 0;

  const reportError = (kind: WebSocketError['kind'], message: string, cause: unknown) => {
    const socketError = createError(kind, message, cause);
    currentError.set(socketError);
    for (const plugin of plugins) {
      try {
        plugin.onError?.(socketError);
      } catch {
        // Error observers must not destabilize the transport.
      }
    }
  };

  const setStatus = (next: WebSocketStatus) => {
    const previous = currentStatus();
    if (previous === next) return;
    currentStatus.set(next);
    for (const plugin of plugins) {
      try {
        plugin.onStatusChange?.(previous, next);
      } catch (error) {
        reportError('plugin', 'A socket status plugin threw an error.', error);
      }
    }
  };

  const clearTimers = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    heartbeatTimer = null;
    reconnectTimer = null;
    retryDelay.set(null);
  };

  const detachAndCloseSocket = (code?: number, reason?: string) => {
    const previousSocket = socket;
    socket = null;
    if (!previousSocket) return;
    previousSocket.onopen = null;
    previousSocket.onmessage = null;
    previousSocket.onerror = null;
    previousSocket.onclose = null;
    try {
      previousSocket.close(code, reason);
    } catch {
      // Closing a failed native socket can itself throw.
    }
  };

  const shutdown = (code?: number, reason?: string, permanent = true) => {
    generation++;
    if (permanent) intentionallyClosed = true;
    clearTimers();
    detachAndCloseSocket(code, reason);
    setStatus('disconnected');
  };

  const runBeforeSend = (payload: TSend): TSend | null => {
    let processed = payload;
    for (const plugin of plugins) {
      try {
        const next = plugin.onBeforeSend?.(processed);
        if (next === null) return null;
        if (next !== undefined) processed = next;
      } catch (error) {
        reportError('plugin', 'A socket send plugin threw an error.', error);
        return null;
      }
    }
    return processed;
  };

  const sendPrepared = (payload: TSend): SendResult => {
    if (!socket || socket.readyState !== OPEN) return { accepted: false, reason: 'closed' };
    try {
      socket.send(serializer(payload));
      return { accepted: true, disposition: 'sent' };
    } catch (error) {
      reportError('send', 'Unable to send a WebSocket message.', error);
      return { accepted: false, reason: 'send-failed' };
    }
  };

  const syncOutboxStorage = (items: TSend[]) => {
    if (!outbox.storage) return;
    try {
      const res = items.length === 0 && outbox.storage.clear
        ? outbox.storage.clear()
        : outbox.storage.setItem(items);
      if (res instanceof Promise) {
        res.catch((err) => reportError('queue', 'Failed to persist WebSocket outbox storage.', err));
      }
    } catch (err) {
      reportError('queue', 'Failed to persist WebSocket outbox storage.', err);
    }
  };

  let outboxEpoch = 0;

  const updateQueue = (updater: (prev: TSend[]) => TSend[]) => {
    const previous = queuedMessages();
    const nextQueue = updater(previous);
    // Invalidate in-flight storage hydration only when the live outbox is cleared,
    // so a late getItem() cannot resurrect messages after flush/clear.
    if (nextQueue.length === 0 && previous.length > 0) {
      outboxEpoch++;
    }
    queuedMessages.set(nextQueue);
    syncOutboxStorage(nextQueue);
  };

  if (outbox.storage) {
    try {
      const epochAtLoad = outboxEpoch;
      const res = outbox.storage.getItem();
      const handleLoaded = (loadedItems: TSend[]) => {
        if (epochAtLoad !== outboxEpoch) return;
        if (!Array.isArray(loadedItems) || loadedItems.length === 0) return;
        updateQueue((currentQueued) => {
          const liveKeys = new Set(
            currentQueued.map((item) => {
              try {
                return JSON.stringify(item);
              } catch {
                return null;
              }
            }),
          );
          const prefix = loadedItems.filter((item) => {
            try {
              return !liveKeys.has(JSON.stringify(item));
            } catch {
              return true;
            }
          });
          const merged = [...prefix, ...currentQueued];
          if (merged.length > outbox.maxSize) {
            return outbox.overflow === 'drop-oldest'
              ? merged.slice(merged.length - outbox.maxSize)
              : merged.slice(0, outbox.maxSize);
          }
          return merged;
        });
        if (socket && socket.readyState === OPEN) {
          flushOutbox();
        }
      };
      if (res instanceof Promise) {
        res.then(handleLoaded).catch((err) => reportError('queue', 'Failed to load WebSocket outbox storage.', err));
      } else if (Array.isArray(res)) {
        handleLoaded(res);
      }
    } catch (err) {
      reportError('queue', 'Failed to load WebSocket outbox storage.', err);
    }
  }

  const enqueue = (payload: TSend): SendResult => {
    if (!canCreateTransport || !options.bufferWhileOffline) return { accepted: false, reason: 'closed' };
    const queued = queuedMessages();
    if (queued.length >= outbox.maxSize) {
      if (outbox.overflow === 'reject-newest') {
        reportError('queue', 'The WebSocket outbox is full.', payload);
        return { accepted: false, reason: 'queue-full' };
      }
      updateQueue((prev) => [...prev.slice(1), payload]);
      return { accepted: true, disposition: 'queued' };
    }
    updateQueue((prev) => [...prev, payload]);
    return { accepted: true, disposition: 'queued' };
  };

  const flushOutbox = () => {
    const queued = queuedMessages();
    if (queued.length === 0) return;
    updateQueue(() => []);
    for (let index = 0; index < queued.length; index++) {
      const result = sendPrepared(queued[index]);
      if (!result.accepted) {
        updateQueue((prev) => [...queued.slice(index), ...prev]);
        return;
      }
    }
  };

  const startHeartbeat = () => {
    if (!heartbeat || heartbeat.intervalMs <= 0) return;
    heartbeatTimer = setInterval(() => {
      if (!socket || socket.readyState !== OPEN) return;
      try {
        socket.send(serializer(heartbeat.payload as TSend));
      } catch (error) {
        reportError('send', 'Unable to send the WebSocket heartbeat.', error);
      }
    }, heartbeat.intervalMs);
  };

  const connect = async (nextUrl: string) => {
    generation++;
    const connectionGeneration = generation;
    intentionallyClosed = false;
    activeUrl = nextUrl;
    clearTimers();
    detachAndCloseSocket();

    if (!canCreateTransport) {
      setStatus('disconnected');
      return;
    }

    let connectionUrl = nextUrl;
    for (const plugin of plugins) {
      try {
        const res = plugin.onBeforeConnect?.(connectionUrl);
        const resolved = res instanceof Promise ? await res : res;
        if (connectionGeneration !== generation) return;
        if (resolved) {
          connectionUrl = resolved;
        }
      } catch (error) {
        if (connectionGeneration !== generation) return;
        reportError('plugin', 'A socket connection plugin threw an error.', error);
      }
    }

    try {
      setStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      const nextSocket = options.webSocketFactory
        ? options.webSocketFactory(connectionUrl)
        : new WebSocket(connectionUrl);
      socket = nextSocket;

      nextSocket.onopen = () => {
        if (connectionGeneration !== generation || socket !== nextSocket) return;
        reconnectAttempts = 0;
        currentError.set(null);
        setStatus('connected');
        startHeartbeat();
        flushOutbox();
      };

      nextSocket.onmessage = (event) => {
        if (connectionGeneration !== generation || socket !== nextSocket) return;
        if (heartbeat?.isHeartbeat?.(event)) return;
        try {
          let message = deserializer(event);
          for (const plugin of plugins) {
            const next = plugin.onMessageReceived?.(message);
            if (next === null) return;
            if (next !== undefined) message = next;
          }
          latestMessage.set(message);
          for (const subscriber of subscribers) subscriber(message);
        } catch (error) {
          reportError('deserialize', 'Unable to deserialize a WebSocket message.', error);
        }
      };

      nextSocket.onerror = (event) => {
        if (connectionGeneration === generation && socket === nextSocket) {
          reportError('connection', 'The WebSocket transport reported an error.', event);
        }
      };

      nextSocket.onclose = (event) => {
        if (connectionGeneration !== generation || socket !== nextSocket) return;
        clearTimers();
        socket = null;
        if (intentionallyClosed) {
          setStatus('disconnected');
          return;
        }
        if (reconnectAttempts >= reconnect.maxAttempts) {
          setStatus('disconnected');
          reportError('reconnect', 'WebSocket connection timed out: Max reconnection attempts reached.', event);
          return;
        }
        const delay = Math.min(
          reconnect.initialDelayMs * Math.pow(reconnect.backoffFactor, reconnectAttempts),
          reconnect.maxDelayMs,
        );
        reconnectAttempts++;
        retryDelay.set(delay);
        setStatus('reconnecting');
        reconnectTimer = setTimeout(() => void connect(nextUrl), delay);
      };
    } catch (error) {
      setStatus('error');
      reportError('connection', 'Unable to create the WebSocket transport.', error);
    }
  };

  const detectNetworkStatus = options.detectNetworkStatus ?? true;

  if (detectNetworkStatus && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const handleOnline = () => {
      if (!intentionallyClosed && activeUrl && currentStatus() !== 'connected') {
        reconnectAttempts = 0;
        void connect(activeUrl);
      }
    };

    const handleOffline = () => {
      if (currentStatus() === 'connected' || currentStatus() === 'connecting') {
        clearTimers();
        detachAndCloseSocket();
        setStatus('reconnecting');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    destroyRef?.onDestroy(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  const bindUrl = (onCleanup?: (fn: () => void) => void) => {
    const nextUrl = url();
    if (!nextUrl) {
      untracked(() => {
        activeUrl = null;
        shutdown(undefined, undefined, false);
      });
      return;
    }
    untracked(() => void connect(nextUrl));
    onCleanup?.(() => untracked(() => shutdown(undefined, undefined, false)));
  };

  if (effectInjector) {
    effect((onCleanup) => bindUrl(onCleanup), { injector: effectInjector });
  } else {
    try {
      effect((onCleanup) => bindUrl(onCleanup));
    } catch {
      if (isDevMode()) {
        console.warn(
          `[createWebSocket] effect() requires an injection context. Connecting once to the current URL.\n` +
            `Pass { injector } or call createWebSocket() from a constructor / field initializer for reactive URL updates.`,
        );
      }
      bindUrl();
    }
  }

  destroyRef?.onDestroy(() => shutdown());

  const client: SocketClient<TSend, TReceive> = {
    status: currentStatus.asReadonly(),
    message: latestMessage.asReadonly(),
    error: currentError.asReadonly(),
    bufferedCount,
    isConnected,
    nextReconnectDelay: retryDelay.asReadonly(),
    send(payload: TSend): SendResult {
      const prepared = runBeforeSend(payload);
      if (prepared === null) return { accepted: false, reason: 'dropped' };
      const sent = sendPrepared(prepared);
      return sent.accepted ? sent : enqueue(prepared);
    },
    reconnect() {
      if (!activeUrl) return;
      reconnectAttempts = 0;
      void connect(activeUrl);
    },
    close(code?: number, reason?: string) {
      shutdown(code, reason);
    },
    subscribe(next: (message: TReceive) => void) {
      subscribers.add(next);
      return () => subscribers.delete(next);
    },
  };

  for (const plugin of plugins) {
    try {
      plugin.onAttach?.(client as any);
    } catch (error) {
      reportError('plugin', 'A socket plugin threw an error during onAttach.', error);
    }
  }

  return client;
}

export function websocketResource<TSend = any, TReceive = any>(
  url: () => string | null | undefined,
  options: WebSocketResourceOptions<TSend, TReceive> = {}
): ResourceRef<WebSocketClient<TSend, TReceive> | undefined> {
  const parentInjector = inject(Injector);
  return resource({
    params: url,
    loader: async ({ params, abortSignal }) => {
      const childInjector = createEnvironmentInjector([], parentInjector as EnvironmentInjector);
      const client = runInInjectionContext(childInjector, () => createWebSocket<TSend, TReceive>(() => params, {
        ...options,
        heartbeatInterval: options.heartbeatInterval ?? 30_000,
        bufferWhileOffline: options.bufferWhileOffline ?? true,
      }));
      abortSignal.addEventListener('abort', () => childInjector.destroy(), { once: true });
      const legacyClient: WebSocketClient<TSend, TReceive> = {
        status: client.status,
        message: client.message,
        error: client.error,
        bufferedCount: client.bufferedCount,
        isConnected: client.isConnected,
        send: (payload) => client.send(payload).accepted,
        reconnect: () => client.reconnect(),
        close: () => client.close(),
      };
      return legacyClient;
    },
  });
}


