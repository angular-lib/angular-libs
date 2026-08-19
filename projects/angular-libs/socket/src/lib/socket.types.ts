import { Signal, Injector } from '@angular/core';

export type WebSocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export type WebSocketSendData = string | ArrayBufferLike | Blob | ArrayBufferView;

export interface WebSocketLike {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: WebSocketSendData): void;
  close(code?: number, reason?: string): void;
}

export interface WebSocketError {
  kind: 'connection' | 'send' | 'receive' | 'serialize' | 'deserialize' | 'reconnect' | 'plugin' | 'queue';
  message: string;
  cause: unknown;
  at: number;
}

export type SendResult =
  | { accepted: true; disposition: 'sent' | 'queued' }
  | { accepted: false; reason: 'closed' | 'dropped' | 'queue-full' | 'send-failed' | 'serialization-failed' };

export interface WebSocketReconnectOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

export interface WebSocketOutboxStorage<TSend = unknown> {
  getItem(): TSend[] | Promise<TSend[]>;
  setItem(items: TSend[]): void | Promise<void>;
  clear?(): void | Promise<void>;
}

export interface WebSocketOutboxOptions<TSend = unknown> {
  maxSize?: number;
  overflow?: 'reject-newest' | 'drop-oldest';
  storage?: WebSocketOutboxStorage<TSend>;
}

export interface WebSocketHeartbeatOptions {
  intervalMs: number;
  payload: unknown;
  isHeartbeat?: (event: MessageEvent) => boolean;
}

export interface WebSocketPlugin<TSend = any, TReceive = any> {
  /** Called when the plugin is attached to a SocketClient instance. Gives plugin access to send/status. */
  onAttach?(client: SocketClient<TSend, TReceive>): void;

  /** Intercept or modify the WebSocket URL right before connection. Allows async token refresh or URL resolution. */
  onBeforeConnect?(url: string): string | Promise<string>;

  /** Intercept, modify, or log payload data before sending. Return null to drop the transmission. */
  onBeforeSend?(payload: TSend): TSend | null;

  /** Intercept, modify, or log deserialized messages received from the server. */
  onMessageReceived?(data: TReceive): TReceive | null;

  /** React to any connection status transitions. */
  onStatusChange?(prev: WebSocketStatus, current: WebSocketStatus): void;

  /** Handle errors propagated from transport interfaces or message parsers. */
  onError?(error: WebSocketError): void;
}

export interface WebSocketResourceOptions<TSend = any, TReceive = any> {
  deserializer?: (event: MessageEvent) => TReceive;
  serializer?: (payload: TSend) => WebSocketSendData;

  /** Optional Angular `Injector` when calling outside an injection context.
   *  Used for `DestroyRef` teardown **and** the reactive URL `effect`. */
  injector?: Injector;

  /** Heartbeat interval in milliseconds. Set to 0 to disable. Defaults to 30000. */
  heartbeatInterval?: number;
  heartbeatPayload?: any;

  /** Max reconnect retry attempts before giving up. Defaults to 5. */
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  backoffFactor?: number;

  /** Buffer outgoing messages while disconnected and flush them when connected.
   *  Defaults to `true` for `websocketResource()`, and **off** for `createWebSocket()`
   *  unless you set it explicitly. */
  bufferWhileOffline?: boolean;

  /** Automatically listen to browser online/offline network events to trigger instant reconnects or status updates. Defaults to true. */
  detectNetworkStatus?: boolean;

  /** Optional custom socket factory, perfect for mock server routing and unit test stubs. */
  webSocketFactory?: (url: string) => WebSocketLike;

  /** List of middleware plugins to extend connection behavior. */
  plugins?: WebSocketPlugin<TSend, TReceive>[];
}

export interface CreateWebSocketOptions<TSend = unknown, TReceive = unknown>
  extends WebSocketResourceOptions<TSend, TReceive> {
  /** New clients default to no heartbeat. Configure it explicitly for the server protocol. */
  heartbeat?: WebSocketHeartbeatOptions;
  reconnect?: WebSocketReconnectOptions;
  outbox?: WebSocketOutboxOptions<TSend>;
}

export interface SocketClient<TSend = unknown, TReceive = unknown> {
  status: Signal<WebSocketStatus>;
  message: Signal<TReceive | null>;
  error: Signal<WebSocketError | null>;
  bufferedCount: Signal<number>;
  isConnected: Signal<boolean>;
  nextReconnectDelay: Signal<number | null>;
  send(payload: TSend): SendResult;
  reconnect(): void;
  close(code?: number, reason?: string): void;
  subscribe(next: (message: TReceive) => void): () => void;
}

export interface WebSocketClient<TSend = any, TReceive = any> {
  /** Reactive status of this connection. */
  status: Signal<WebSocketStatus>;

  /** The last received deserialized message signal. */
  message: Signal<TReceive | null>;

  /** The last encountered connection or transaction error signal. */
  error: Signal<WebSocketError | null>;

  /** Reactive count of offline buffered messages. */
  bufferedCount: Signal<number>;

  /** True when status is 'connected'. */
  isConnected: Signal<boolean>;

  /** Safely send a message, buffering if offline and bufferWhileOffline is active. */
  send: (payload: TSend) => boolean;

  /** Manually hook a connection. */
  reconnect: () => void;

  /** Cleanly disconnect the socket. */
  close: () => void;
}
