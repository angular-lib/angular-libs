import { Signal, signal, WritableSignal } from '@angular/core';
import { SendResult, SocketClient, WebSocketPlugin, WebSocketStatus } from '../socket.types';

export interface MultiplexOptions<TSend = any, TReceive = any> {
  /** Function to extract topic/channel name from an incoming message. Defaults to msg.topic or msg.channel */
  getTopicFromMessage?: (message: TReceive) => string | null | undefined;

  /** Function to format outgoing payload for a specific topic/channel. Defaults to { topic, data: payload } */
  createTopicPayload?: (topic: string, payload: any) => TSend;

  /** Wire protocol hook: returns the message payload to send when subscribing to a topic over the network. */
  onSubscribeTopic?: (topic: string) => TSend | void;

  /** Wire protocol hook: returns the message payload to send when unsubscribing from a topic over the network. */
  onUnsubscribeTopic?: (topic: string) => TSend | void;
}

export interface MultiplexPlugin<TSend = any, TReceive = any> extends WebSocketPlugin<TSend, TReceive> {
  /** Subscribe to received messages for a specific topic/channel. Returns an unsubscribe function. */
  subscribe(topic: string, callback: (message: TReceive) => void): () => void;

  /** Send a message payload targeting a specific topic through the attached WebSocket client. */
  send(topic: string, payload: any): SendResult;

  /** Format a payload object with topic metadata for sending. */
  formatPayload(topic: string, payload: any): TSend;

  /** Get a readonly Signal containing the last received message for a specific topic/channel. */
  topicSignal(topic: string): Signal<TReceive | null>;

  /** Get a list of topics that currently have active subscribers. */
  getActiveTopics(): string[];
}

export function createWebSocketMultiplexPlugin<TSend = any, TReceive = any>(
  options: MultiplexOptions<TSend, TReceive> = {}
): MultiplexPlugin<TSend, TReceive> {
  const getTopic = options.getTopicFromMessage ?? ((msg: any) => msg?.topic ?? msg?.channel ?? null);
  const createPayload = options.createTopicPayload ?? ((topic: string, payload: any) => ({ topic, data: payload } as any));

  const subscribers = new Map<string, Set<(message: TReceive) => void>>();
  const topicSignals = new Map<string, WritableSignal<TReceive | null>>();
  let clientRef: SocketClient<TSend, TReceive> | null = null;

  const dispatchWireFrame = (
    frameFn: ((topic: string) => TSend | void) | undefined,
    topic: string
  ) => {
    if (!frameFn || !clientRef) return;
    try {
      const frame = frameFn(topic);
      if (frame !== undefined) {
        clientRef.send(frame);
      }
    } catch {
      // Wire framing errors must not throw
    }
  };

  return {
    onAttach(client: SocketClient<TSend, TReceive>): void {
      clientRef = client;
    },

    onMessageReceived(data: TReceive): TReceive {
      const topic = getTopic(data);
      if (topic) {
        let sig = topicSignals.get(topic);
        if (!sig) {
          sig = signal<TReceive | null>(null);
          topicSignals.set(topic, sig);
        }
        sig.set(data);

        const topicSubs = subscribers.get(topic);
        if (topicSubs) {
          for (const callback of topicSubs) {
            try {
              callback(data);
            } catch {
              // Subscriber errors must not destabilize transport
            }
          }
        }
      }
      return data;
    },

    onStatusChange(_prev: WebSocketStatus, current: WebSocketStatus): void {
      if (current === 'connected' && options.onSubscribeTopic) {
        // Re-send subscription frames for all active topics on connection/reconnection
        for (const [topic, set] of subscribers.entries()) {
          if (set.size > 0) {
            dispatchWireFrame(options.onSubscribeTopic, topic);
          }
        }
      }
    },

    subscribe(topic: string, callback: (message: TReceive) => void): () => void {
      let topicSubs = subscribers.get(topic);
      const isFirstSubscriber = !topicSubs || topicSubs.size === 0;

      if (!topicSubs) {
        topicSubs = new Set();
        subscribers.set(topic, topicSubs);
      }
      topicSubs.add(callback);

      if (isFirstSubscriber) {
        dispatchWireFrame(options.onSubscribeTopic, topic);
      }

      return () => {
        const subs = subscribers.get(topic);
        if (subs) {
          subs.delete(callback);
          if (subs.size === 0) {
            subscribers.delete(topic);
            dispatchWireFrame(options.onUnsubscribeTopic, topic);
            topicSignals.delete(topic);
          }
        }
      };
    },

    send(topic: string, payload: any): SendResult {
      if (!clientRef) return { accepted: false, reason: 'closed' };
      return clientRef.send(createPayload(topic, payload));
    },

    formatPayload(topic: string, payload: any): TSend {
      return createPayload(topic, payload);
    },

    topicSignal(topic: string): Signal<TReceive | null> {
      let sig = topicSignals.get(topic);
      if (!sig) {
        sig = signal<TReceive | null>(null);
        topicSignals.set(topic, sig);
      }
      return sig.asReadonly();
    },

    getActiveTopics(): string[] {
      return Array.from(subscribers.entries())
        .filter(([_topic, set]) => set.size > 0)
        .map(([topic]) => topic);
    }
  };
}
