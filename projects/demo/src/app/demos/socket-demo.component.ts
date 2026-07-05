import { Component, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  createWebSocket,
  createWebSocketLoggerPlugin,
  createWebSocketMultiplexPlugin,
  WebSocketOutboxStorage
} from '@angular-libs/socket';

interface TopicMessage {
  topic: string;
  sender: string;
  text: string;
  time: string;
}

// LocalStorage Outbox Implementation for demo persistence
const localStorageOutbox: WebSocketOutboxStorage<any> = {
  getItem() {
    try {
      return JSON.parse(localStorage.getItem('demo_socket_outbox') || '[]');
    } catch {
      return [];
    }
  },
  setItem(items) {
    try {
      localStorage.setItem('demo_socket_outbox', JSON.stringify(items));
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem('demo_socket_outbox');
    } catch {
      // ignore
    }
  }
};

@Component({
  selector: 'app-socket-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="demo-container" style="padding: 1.5rem; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
      
      <!-- HEADER -->
      <div class="header" style="margin-bottom: 2rem; border-bottom: 1px solid #eee; padding-bottom: 1rem;">
        <h2 style="margin: 0; color: #111; display: flex; align-items: center; gap: 0.5rem;">
          WebSocket Engine & Topic Multiplexer 📡
        </h2>
        <p style="margin: 0.4rem 0 0; color: #666; font-size: 0.95rem;">
          Reactive WebSocket client with persistent offline outbox storage, channel/topic multiplexing signals, and automatic reconnects.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        
        <!-- COLUMN 1: CONTROLS & MULTIPLEX CHANNELS -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- CONNECTION CARD -->
          <div class="card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <h3 style="margin-top: 0; color: #333; font-size: 1.1rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.5rem;">
              🔌 Connection Status
            </h3>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div [style.background]="socket.isConnected() ? '#28a745' : '#dc3545'"
                     style="width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.2);"></div>
                <strong style="text-transform: uppercase; font-size: 0.9rem; color: #444;">
                  {{ socket.status() }}
                </strong>
              </div>

              @if (socket.bufferedCount() > 0) {
                <span style="font-size: 0.8rem; background: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600;">
                  💾 {{ socket.bufferedCount() }} Queued in Outbox
                </span>
              }
            </div>

            <!-- CONTROLS -->
            <div style="display: flex; gap: 0.5rem;">
              <button (click)="socket.reconnect()" 
                      style="flex: 1; padding: 0.5rem 0.8rem; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; font-weight: 500; cursor: pointer;">
                Reconnect
              </button>
              <button (click)="socket.close()" 
                      style="flex: 1; padding: 0.5rem 0.8rem; border: 1px solid #dc3545; background: #fff; color: #dc3545; border-radius: 4px; font-weight: 500; cursor: pointer;">
                Disconnect
              </button>
            </div>
          </div>

          <!-- MULTIPLEX TOPIC SUBSCRIPTIONS -->
          <div class="card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <h3 style="margin-top: 0; color: #333; font-size: 1.1rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 0.5rem;">
              🔀 Channel / Topic Subscriptions
            </h3>
            <p style="margin: 0 0 1rem; font-size: 0.85rem; color: #666;">
              Subscribe to specific topics over a single connection. The plugin handles wire-level subscribe/unsubscribe frames and creates reactive Signals per topic.
            </p>

            <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem;">
              @for (topic of availableTopics; track topic.id) {
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: #f8f9fa; border-radius: 6px; border: 1px solid #eee;">
                  <div>
                    <strong style="font-size: 0.9rem; color: #333; display: block;">{{ topic.name }}</strong>
                    <code style="font-size: 0.75rem; color: #666;">{{ topic.id }}</code>
                  </div>
                  <div style="display: flex; gap: 0.4rem;">
                    @if (isSubscribed(topic.id)) {
                      <span style="font-size: 0.75rem; background: #e2e3e5; color: #383d41; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: bold;">
                        Subscribed
                      </span>
                      <button (click)="unsubscribeTopic(topic.id)" 
                              style="padding: 0.25rem 0.5rem; border: 1px solid #ccc; background: #fff; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                        Unsub
                      </button>
                    } @else {
                      <button (click)="subscribeTopic(topic.id)" 
                              style="padding: 0.25rem 0.6rem; border: 1px solid #28a745; background: #28a745; color: white; border-radius: 4px; font-size: 0.75rem; font-weight: 500; cursor: pointer;">
                        Subscribe
                      </button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- ACTIVE TOPICS BADGES -->
            <div style="font-size: 0.85rem; color: #555;">
              <strong>Active Topics on Wire:</strong>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem;">
                @if (activeTopicsList().length === 0) {
                  <em style="color: #999;">No active topic subscriptions</em>
                }
                @for (t of activeTopicsList(); track t) {
                  <span style="background: #e7f1ff; color: #004085; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500; font-size: 0.8rem;">
                    #{{ t }}
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- OFFLINE OUTBOX PERSISTENCE TEST -->
          <div class="card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem; background: #f8f9fa; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            <h3 style="margin-top: 0; color: #333; font-size: 1.05rem;">
              💾 Offline Outbox Storage Test
            </h3>
            <p style="margin: 0.25rem 0 0.8rem; font-size: 0.85rem; color: #666;">
              Disconnect the stream, send queued payloads to store them in <code>localStorage</code>, then reconnect to flush them automatically!
            </p>

            <div style="display: flex; gap: 0.5rem;">
              <input #queuedText type="text" placeholder="Queue message while offline..." 
                     (keyup.enter)="queueMessage(queuedText.value); queuedText.value=''"
                     style="flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;" />
              <button (click)="queueMessage(queuedText.value); queuedText.value=''"
                      style="padding: 0.5rem 0.8rem; border: none; background: #ffc107; color: #212529; font-weight: 600; border-radius: 4px; font-size: 0.85rem; cursor: pointer;">
                Queue
              </button>
            </div>
          </div>

        </div>

        <!-- COLUMN 2: LIVE TOPIC CONSOLE -->
        <div style="display: flex; flex-direction: column;">
          <div class="card" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.25rem; background: #fff; height: 100%; display: flex; flex-direction: column; box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f4f4f4; padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <h3 style="margin: 0; color: #333; font-size: 1.1rem;">
                💬 Topic Message Stream
              </h3>
              <button (click)="clearMessages()" 
                      style="padding: 0.25rem 0.6rem; border: 1px solid #ccc; background: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                Clear
              </button>
            </div>

            <!-- TOPIC SELECTOR FOR SENDING -->
            <div style="margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
              <label style="font-size: 0.85rem; font-weight: bold; color: #555;">Target Topic:</label>
              <select [ngModel]="selectedSendTopic()" (ngModelChange)="selectedSendTopic.set($event)" 
                      style="padding: 0.35rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem; background: #fafafa;">
                @for (topic of availableTopics; track topic.id) {
                  <option [value]="topic.id">{{ topic.name }} ({{ topic.id }})</option>
                }
              </select>
            </div>

            <!-- RECENT TOPIC SIGNAL BANNER -->
            @if (currentTopicSignalValue(); as lastMsg) {
              <div style="background: #e6f4ea; border: 1px solid #ceead6; padding: 0.5rem 0.8rem; border-radius: 6px; margin-bottom: 0.8rem; font-size: 0.85rem; color: #137333;">
                <strong>⚡ Topic Signal Emit [{{ lastMsg.topic }}]:</strong> {{ lastMsg.text }}
              </div>
            }

            <!-- MESSAGE FEED -->
            <div style="flex: 1; min-height: 320px; max-height: 420px; border: 1px solid #eee; border-radius: 6px; background: #fafafa; padding: 1rem; overflow-y: auto;">
              @if (messageLog().length === 0) {
                <div style="color: #aaa; text-align: center; margin-top: 5rem; font-size: 0.9rem;">
                  🔌 Socket ready. Subscribe to topics and send messages to see live streaming events.
                </div>
              } @else {
                @for (msg of messageLog(); track $index) {
                  <div style="margin-bottom: 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: #888; margin-bottom: 0.15rem;">
                      <span style="font-weight: bold; color: #007bff;">#{{ msg.topic }} • {{ msg.sender }}</span>
                      <span>{{ msg.time }}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #222;">{{ msg.text }}</div>
                  </div>
                }
              }
            </div>

            <!-- SEND MESSAGE INPUT -->
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <input #sendInput type="text" placeholder="Send message to targeted topic..." 
                     (keyup.enter)="sendTopicMessage(sendInput.value); sendInput.value=''"
                     style="flex: 1; padding: 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem;" />
              <button (click)="sendTopicMessage(sendInput.value); sendInput.value=''" 
                      style="padding: 0.6rem 1.2rem; border: none; background: #007bff; color: white; font-weight: bold; border-radius: 4px; font-size: 0.9rem; cursor: pointer;">
                Send
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  `
})
export class SocketDemoComponent {
  protected availableTopics = [
    { id: 'work-order:101', name: 'Work Order #101' },
    { id: 'chat:general', name: 'General Announcements' },
    { id: 'system:alerts', name: 'System Alerts' }
  ];

  protected selectedSendTopic = signal<string>('work-order:101');
  protected activeSubscriptions = new Map<string, () => void>();

  protected activeTopicsList = signal<string[]>([]);
  protected messageLog = signal<TopicMessage[]>([]);

  // Create Multiplex Plugin with wire framing hooks
  protected multiplex = createWebSocketMultiplexPlugin<any, TopicMessage>({
    onSubscribeTopic: (topic) => ({ action: 'subscribe', topic }),
    onUnsubscribeTopic: (topic) => ({ action: 'unsubscribe', topic }),
    getTopicFromMessage: (msg) => msg.topic
  });

  private consoleLogger = createWebSocketLoggerPlugin('SocketDemo');

  // Primary Socket Client with Outbox Storage and Multiplex Plugin
  protected socket = createWebSocket<any, TopicMessage>(
    () => 'ws://localhost:8080/ws',
    {
      heartbeatInterval: 10_000,
      heartbeatPayload: { type: 'ping' },
      bufferWhileOffline: true,
      outbox: {
        maxSize: 50,
        storage: localStorageOutbox
      },
      plugins: [this.multiplex, this.consoleLogger]
    }
  );

  // Readonly Topic Signal for selected send topic
  protected currentTopicSignalValue = computed(() => {
    const topic = this.selectedSendTopic();
    return this.multiplex.topicSignal(topic)();
  });

  constructor() {
    // Default subscription to general chat
    this.subscribeTopic('work-order:101');
    this.subscribeTopic('chat:general');

    // Simulate local echo for demo purposes when server is not available
    effect(() => {
      const msg = this.socket.message();
      if (msg) {
        this.messageLog.update((prev) => [msg, ...prev]);
      }
    });
  }

  protected isSubscribed(topicId: string): boolean {
    return this.activeSubscriptions.has(topicId);
  }

  protected subscribeTopic(topicId: string) {
    if (this.activeSubscriptions.has(topicId)) return;

    const unsub = this.multiplex.subscribe(topicId, (msg) => {
      this.messageLog.update((prev) => [msg, ...prev]);
    });

    this.activeSubscriptions.set(topicId, unsub);
    this.activeTopicsList.set(this.multiplex.getActiveTopics());
  }

  protected unsubscribeTopic(topicId: string) {
    const unsub = this.activeSubscriptions.get(topicId);
    if (unsub) {
      unsub();
      this.activeSubscriptions.delete(topicId);
      this.activeTopicsList.set(this.multiplex.getActiveTopics());
    }
  }

  protected sendTopicMessage(text: string) {
    if (!text.trim()) return;
    const topic = this.selectedSendTopic();
    const payload: TopicMessage = {
      topic,
      sender: 'User (You)',
      text,
      time: new Date().toLocaleTimeString()
    };

    const res = this.multiplex.send(topic, payload);

    // Local optimistic append for demo UI
    if (res.accepted) {
      this.messageLog.update((prev) => [payload, ...prev]);
    }
  }

  protected queueMessage(text: string) {
    if (!text.trim()) return;
    const topic = this.selectedSendTopic();
    const payload: TopicMessage = {
      topic,
      sender: 'User (Queued Offline)',
      text,
      time: new Date().toLocaleTimeString()
    };

    this.socket.send(payload);
  }

  protected clearMessages() {
    this.messageLog.set([]);
  }
}
