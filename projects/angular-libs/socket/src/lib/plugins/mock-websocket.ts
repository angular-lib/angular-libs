import { WebSocketLike, WebSocketSendData } from '../socket.types';

export interface MockWebSocketFactoryOptions {
  autoOpen?: boolean;
  onSend?: (data: WebSocketSendData, socket: MockWebSocket) => void;
}

export interface MockWebSocket extends WebSocketLike {
  readonly url: string;
  readonly sent: readonly WebSocketSendData[];
  open(): void;
  receive(data: unknown): void;
  fail(error?: Event): void;
}

export interface MockWebSocketController {
  factory(url: string): WebSocketLike;
  readonly sockets: readonly MockWebSocket[];
  openAll(): void;
  receiveAll(data: unknown): void;
}

/**
 * Creates a transport-level WebSocket fake for deterministic unit tests.
 * Pass `controller.factory` as `webSocketFactory` and drive sockets explicitly.
 */
export function createMockWebSocketFactory(
  options: MockWebSocketFactoryOptions = {},
): MockWebSocketController {
  const sockets: MockWebSocket[] = [];

  const factory = (url: string): MockWebSocket => {
    let readyState = 0;
    const sent: WebSocketSendData[] = [];
    const socket: MockWebSocket = {
      url,
      get readyState() {
        return readyState;
      },
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      get sent() {
        return sent;
      },
      send(data) {
        if (readyState !== 1) throw new Error('Mock WebSocket is not open.');
        sent.push(data);
        options.onSend?.(data, socket);
      },
      close() {
        if (readyState === 3) return;
        readyState = 3;
        socket.onclose?.({} as CloseEvent);
      },
      open() {
        if (readyState !== 0) return;
        readyState = 1;
        socket.onopen?.({} as Event);
      },
      receive(data) {
        if (readyState === 1) socket.onmessage?.({ data } as MessageEvent);
      },
      fail(error = {} as Event) {
        socket.onerror?.(error);
      },
    };
    sockets.push(socket);
    if (options.autoOpen) queueMicrotask(() => socket.open());
    return socket;
  };

  return {
    factory,
    sockets,
    openAll: () => sockets.forEach((socket) => socket.open()),
    receiveAll: (data) => sockets.forEach((socket) => socket.receive(data)),
  };
}
