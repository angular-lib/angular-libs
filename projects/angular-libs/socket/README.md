# Socket

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.0.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the library, run:

```bash
ng build @angular-libs/socket
```

This command will compile your project, and the build artifacts will be placed in the `dist/` directory.

### Publishing the Library

Once the project is built, you can publish your library by following these steps:

1. Navigate to the `dist` directory:

   ```bash
   cd dist/angular-libs/socket
   ```

2. Run the `npm publish` command to publish your library to the npm registry:
   ```bash
   npm publish
   ```

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

Signal-first WebSocket clients for Angular. The primary API returns one stable
client object whose signals update as the URL, connection, and messages change.

## Create a client

Call `createWebSocket()` from an Angular injection context, such as a component
field initializer, constructor, provider factory, or service. Its connection is
closed automatically with that context.

```ts
import { Component, computed, signal } from '@angular/core';
import { createWebSocket } from '@angular-libs/socket';

interface ChatCommand {
   text: string;
}

interface ChatEvent {
   sender: string;
   text: string;
}

@Component({ standalone: true, template: '' })
export class ChatComponent {
   private readonly room = signal('general');

   readonly socket = createWebSocket<ChatCommand, ChatEvent>(
      () => `wss://example.test/rooms/${this.room()}`,
      {
         bufferWhileOffline: true,
         reconnect: {
            maxAttempts: 10,
            initialDelayMs: 1_000,
            maxDelayMs: 15_000,
            backoffFactor: 2,
         },
         outbox: { maxSize: 500, overflow: 'reject-newest' },
      },
   );

   readonly connected = computed(() => this.socket.isConnected());
}
```

`socket.status`, `socket.message`, `socket.error`, `socket.bufferedCount`, and
`socket.nextReconnectDelay` are Angular signals. Use `socket.subscribe()` when
every received message must be consumed; `message()` intentionally contains only
the most recent one.

## Plugins & Auth Refresh

Intercept connection URLs or refresh auth tokens asynchronously right before connecting or reconnecting:

```ts
const socket = createWebSocket(() => url(), {
   detectNetworkStatus: true, // Instant reconnects on window 'online' events (default: true)
   plugins: [
      {
         async onBeforeConnect(currentUrl) {
            const token = await authService.getFreshToken();
            return `${currentUrl}?token=${token}`;
         }
      }
   ]
});
```

## Outbox Storage & Topic Multiplexing

Persist offline buffered messages across browser restarts (IndexedDB, LocalStorage, OPFS):

```ts
const socket = createWebSocket(() => url(), {
   bufferWhileOffline: true,
   outbox: {
      maxSize: 100,
      storage: {
         async getItem() { return JSON.parse(localStorage.getItem('ws_outbox') || '[]'); },
         async setItem(items) { localStorage.setItem('ws_outbox', JSON.stringify(items)); },
         async clear() { localStorage.removeItem('ws_outbox'); }
      }
   }
});
```

Subscribe to specific channels or topics over a single connection using the multiplex plugin with optional network wire protocol framing:

```ts
import { createWebSocketMultiplexPlugin } from '@angular-libs/socket';

const multiplex = createWebSocketMultiplexPlugin({
   // Automatically send wire framing on topic subscribe/unsubscribe & reconnects
   onSubscribeTopic: (topic) => ({ action: 'subscribe', topic }),
   onUnsubscribeTopic: (topic) => ({ action: 'unsubscribe', topic })
});

const socket = createWebSocket(() => url(), { plugins: [multiplex] });

// Subscribe to a topic (triggers wire subscribe frame on 1st subscriber):
const unsubscribe = multiplex.subscribe('work-order:101', (message) => {
   console.log('Work order updated:', message);
});

// Send message targeting a specific topic (uses attached socket automatically):
multiplex.send('work-order:101', { action: 'UPDATE' });

// Access a Signal for a specific topic:
const trackingSignal = multiplex.topicSignal('work-order:101');
```

Call `socket.close(code?, reason?)` for a permanent local close, or
`socket.reconnect()` to replace the active transport immediately. Reconnects
invalidate old transport callbacks, preventing delayed events from a closed
socket from changing the current connection state.

## Protocol configuration

JSON serialization and deserialization are defaults. Supply a codec for another
wire format. Application heartbeats are disabled by default because heartbeat
formats are server-specific; configure both the payload and the receive filter.

```ts
const socket = createWebSocket<Command, Event>(() => url(), {
   serializer: (command) => JSON.stringify(command),
   deserializer: (event) => JSON.parse(event.data) as Event,
   heartbeat: {
      intervalMs: 30_000,
      payload: { type: 'ping' },
      isHeartbeat: (event) => event.data === JSON.stringify({ type: 'ping' }),
   },
});
```

`error()` returns a typed `WebSocketError` with a `kind` such as `connection`,
`send`, `deserialize`, `reconnect`, or `queue`.

## Testing

Provide a transport factory instead of replacing global browser state. The
package includes a deterministic fake for this purpose.

```ts
import { createMockWebSocketFactory, createWebSocket } from '@angular-libs/socket';

const mock = createMockWebSocketFactory();
const socket = createWebSocket(() => 'ws://example.test', {
   webSocketFactory: mock.factory,
});

mock.openAll();
mock.receiveAll(JSON.stringify({ type: 'ready' }));
```

## SSR and legacy API

When no native `WebSocket` and no `webSocketFactory` are available, the client
stays disconnected and rejects sends. This makes SSR safe without creating an
outbox that cannot be delivered.

`websocketResource()` remains available for existing callers. It keeps its
resource-shaped return value and legacy 30-second heartbeat default, but new
code should prefer `createWebSocket()` to avoid a second resource state machine
and optional `resource.value()` access.

## Build and test

```bash
ng build socket
ng test socket --watch=false
```
