import { Component, inject, Injectable, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ALEventBus } from '@angular-libs/event-bus';
import { debouncePlugin, historyPlugin, loggerPlugin, syncPlugin } from '@angular-libs/event-bus';

interface DemoEventMap {
  'chat:message': { username: string; text: string };
  'system:notification': { priority: 'low' | 'high'; text: string };
  'action:clear': void;
  'input:keystroke': { text: string };
}

@Injectable({ providedIn: 'root' })
export class DemoEventBus extends ALEventBus<DemoEventMap> {
  // Register active undo/redo history plugin
  history = this.registerPlugin(historyPlugin({ keys: ['chat:message', 'system:notification'] }));

  constructor() {
    super();

    // Register passive plugins
    this.registerPlugin(loggerPlugin());
    this.registerPlugin(syncPlugin({ keys: ['chat:message'] }));
    this.registerPlugin(debouncePlugin([{ key: 'input:keystroke', delay: 400 }]));
  }
}

interface LogEntry {
  id: number;
  timestamp: string;
  key: string;
  payloadStr: string;
}

@Component({
  selector: 'app-event-bus-demo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="demo-container">
      <div class="header-section">
        <h2>Event Bus Playground ⇄</h2>
        <p class="description">Signal-driven, typesafe pub/sub messaging hub for Angular.</p>
      </div>

      <div class="layout-grid">
        <!-- CONTROLLER (DISPATCH CENTER) -->
        <div class="column">
          <!-- HISTORY UNDO/REDO PANEL -->
          <div class="widget-card history-controls">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>↩️ History Controls (historyPlugin)</h3>
              <div style="display: flex; gap: 8px;">
                <button
                  [disabled]="!hasUndo"
                  (click)="undo()"
                  class="btn btn-secondary-outline btn-xs"
                  style="padding: 6px 12px;"
                >
                  ⏪ Undo
                </button>
                <button
                  [disabled]="!hasRedo"
                  (click)="redo()"
                  class="btn btn-secondary-outline btn-xs"
                  style="padding: 6px 12px;"
                >
                  ⏩ Redo
                </button>
              </div>
            </div>
            <p class="sub-caption" style="margin-top: 4px; margin-bottom: 0;">
              Supports traveling backwards/forwards across chat and system notification alerts.
            </p>
          </div>

          <div class="widget-card">
            <h3>📢 Dispatch Center</h3>
            <p class="sub-caption">
              Fully custom and typesafe event streams dispatched instantly on the bus.
            </p>

            <!-- Chat Dispatch Sub-form -->
            <div class="form-sub-panel">
              <h4>💬 Dispatch Chat Event</h4>
              <div class="inputs-row">
                <input
                  type="text"
                  #chatUser
                  placeholder="Username..."
                  value="Ava"
                  class="input-inline user-input"
                />
                <input
                  type="text"
                  #chatMsg
                  placeholder="Type message..."
                  value="Hello World! 🚀"
                  class="input-inline msg-input"
                  (keydown.enter)="triggerChat(chatUser, chatMsg)"
                />
                <button class="btn btn-primary" (click)="triggerChat(chatUser, chatMsg)">
                  Emit
                </button>
              </div>
            </div>

            <!-- Debounced Keystroke sub-form -->
            <div class="form-sub-panel">
              <h4>⏱️ Debounced Input Event (debouncePlugin)</h4>
              <div class="inputs-row">
                <input
                  type="text"
                  [value]="keystrokeInput()"
                  (input)="onKeystroke($event)"
                  placeholder="Type fast here..."
                  class="input-inline msg-input"
                />
              </div>
              <div style="margin-top: 8px; font-size: 0.8rem; color: #475569;">
                <strong>Debounced Value (400ms delay):</strong>
                @if (debouncedKeystroke()) {
                  <span style="color: #0284c7; font-family: monospace;"
                    >"{{ debouncedKeystroke()?.text }}"</span
                  >
                } @else {
                  <span style="color: #94a3b8; font-style: italic;">No keystrokes emitted yet</span>
                }
              </div>
            </div>

            <!-- Notification Dispatch Sub-form -->
            <div class="form-sub-panel">
              <h4>🔔 Dispatch System Alert</h4>
              <div class="inputs-row">
                <select #notifyPriority class="input-inline priority-select">
                  <option value="high">🔴 High</option>
                  <option value="low">🟡 Low</option>
                </select>
                <input
                  type="text"
                  #notifyText
                  placeholder="Notification text..."
                  value="Database backup complete."
                  class="input-inline msg-input"
                  (keydown.enter)="triggerNotify(notifyPriority, notifyText)"
                />
                <button class="btn btn-warning" (click)="triggerNotify(notifyPriority, notifyText)">
                  Emit
                </button>
              </div>
            </div>

            <!-- Clear Action -->
            <button class="btn btn-danger btn-block" (click)="emitClear()">
              🧹 Flush System State ( action:clear )
            </button>
          </div>

          <div class="widget-card">
            <h3>🧩 Event Combinator</h3>
            <p class="sub-caption">
              Signal updates only when both sources have emitted at least once.
            </p>
            <div class="combined-preview" style="margin-bottom: 20px;">
              @if (combinedState()) {
                <div class="success-banner">
                  <div><strong>Chat:</strong> {{ combinedState()?.[0] }}</div>
                  <div class="divider"></div>
                  <div><strong>Alert:</strong> {{ combinedState()?.[1] }}</div>
                </div>
              } @else {
                <div class="placeholder-alert">⚠️ Waiting for both sources to emit...</div>
              }
            </div>
          </div>

          <!-- ASYNC LOADER VIA EVENT EMIT -->
          <div class="widget-card">
            <h3>🌩️ Async Loader (onToResource)</h3>
            <p class="sub-caption">
              Trigger async fetching reacting reactively to event emissions with automatic
              cancellation status.
            </p>

            @if (avatarLoader.isLoading()) {
              <div class="async-card loading">
                <span class="pulse-ring"></span> Querying mock server for {{ lastChatUser() }}...
              </div>
            } @else if (avatarLoader.value()) {
              <div class="async-card success">
                <div class="avatar-circle">👤</div>
                <div class="avatar-details">
                  <strong>{{ avatarLoader.value()?.user }}</strong>
                  <span
                    >Level {{ avatarLoader.value()?.score }} • Rated
                    {{ avatarLoader.value()?.rank }}</span
                  >
                </div>
              </div>
            } @else {
              <div class="async-card empty">
                💡 Speak in Chat to fetch user profile asynchronously.
              </div>
            }
          </div>
        </div>

        <!-- CONSOLE FEED & BINDINGS -->
        <div class="column">
          <div class="widget-card">
            <div class="console-header">
              <h3>🖥️ Live Subscribers Feed</h3>
              <button class="btn btn-secondary-outline btn-xs" (click)="clearLogs()">Clear</button>
            </div>
            <div class="console-body">
              @if (logs().length === 0) {
                <div class="console-empty">No events captured yet.</div>
              } @else {
                <div class="log-item" *ngFor="let log of logs()">
                  <span class="log-time">[{{ log.timestamp }}]</span>
                  <span class="log-key" [class.chat]="log.key.includes('chat')">{{ log.key }}</span>
                  <div class="log-payload">{{ log.payloadStr }}</div>
                </div>
              }
            </div>
          </div>

          <div class="widget-card">
            <h3>🔗 State Bindings (onToSignal)</h3>
            <div class="grid-2" style="margin-bottom: 20px;">
              <div class="binding-item">
                <span class="label">Chat</span>
                @if (chatSignal()) {
                  <strong>{{ chatSignal()?.username }}</strong
                  >: {{ chatSignal()?.text }}
                } @else {
                  <span class="placeholder">No emission</span>
                }
              </div>
              <div class="binding-item">
                <span class="label">Alert</span>
                @if (notifySignal()) {
                  <strong>[{{ notifySignal()?.priority | uppercase }}]</strong>:
                  {{ notifySignal()?.text }}
                } @else {
                  <span class="placeholder">No emission</span>
                }
              </div>
            </div>
            <div class="binding-item" style="margin-top: 12px;">
              <span class="label">Transformed Array Default (NoInfer Proof)</span>
              <strong>Values:</strong>
              @for (text of chatHistorySignal(); track $index) {
                <span
                  class="badge"
                  style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.8rem; margin-right: 4px; color: #0284c7;"
                  >"{{ text }}"</span
                >
              } @empty {
                <span class="placeholder">Empty array literal default works!</span>
              }
            </div>
          </div>

          <div class="widget-card">
            <h3>✨ Key Features</h3>
            <p class="sub-caption">RxJS-free design powered entirely by Angular Signals.</p>
            <ul class="feature-bullets">
              <li>
                🛡️ <strong>Strongly Typed:</strong> Fully typesafe payloads mapped on definitions
                interface.
              </li>
              <li>
                ⚡ <strong>Signal-Based:</strong> Reactive signals via
                <code>onToSignal('key')</code> out of the box.
              </li>
              <li>
                🌀 <strong>Async Resource Hook:</strong> Map events to async loaders with
                <code>onToResource()</code>.
              </li>
              <li>
                🔄 <strong>Transformations:</strong> Pipe and map payloads during subscription
                setups.
              </li>
              <li>
                🧹 <strong>Auto-Cleanup:</strong> Automated lifecycle disposal tracking via
                <code>DestroyRef</code> context.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .demo-container {
        padding: 24px;
        font-family: system-ui, sans-serif;
        max-width: 1000px;
        margin: 0 auto;
      }
      .header-section {
        background: linear-gradient(135deg, #0284c7, #06b6d4);
        color: white;
        padding: 24px;
        border-radius: 8px;
        margin-bottom: 30px;
      }
      .header-section h2 {
        margin: 0;
        font-size: 1.8rem;
        font-weight: 800;
      }
      .header-section .description {
        margin: 4px 0 0 0;
        color: rgba(255, 255, 255, 0.9);
        font-size: 1rem;
      }
      .layout-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      @media (max-width: 768px) {
        .layout-grid {
          grid-template-columns: 1fr;
        }
      }
      .widget-card {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        border: 1px solid #e2e8f0;
        margin-bottom: 24px;
      }
      .widget-card h3 {
        margin: 0 0 4px 0;
        color: #0f172a;
        font-size: 1.1rem;
      }
      .sub-caption {
        margin: 0 0 16px 0;
        color: #64748b;
        font-size: 0.85rem;
      }
      .form-sub-panel {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
      }
      .form-sub-panel h4 {
        margin: 0 0 8px 0;
        font-size: 0.85rem;
        text-transform: uppercase;
        color: #334155;
      }
      .inputs-row {
        display: flex;
        gap: 8px;
      }
      .input-inline {
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.85rem;
        outline: none;
      }
      .input-inline:focus {
        border-color: #0284c7;
      }
      .user-input {
        width: 100px;
      }
      .msg-input {
        flex-grow: 1;
      }
      .priority-select {
        cursor: pointer;
        background: white;
      }
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background 0.2s;
        text-align: center;
      }
      .btn-xs {
        padding: 4px 8px;
        font-size: 0.75rem;
      }
      .btn-block {
        width: 100%;
        display: block;
        margin-top: 10px;
      }
      .btn-primary {
        background: #0284c7;
        color: white;
      }
      .btn-primary:hover {
        background: #0369a1;
      }
      .btn-warning {
        background: #f59e0b;
        color: white;
      }
      .btn-warning:hover {
        background: #d97706;
      }
      .btn-danger {
        background: #ef4444;
        color: white;
      }
      .btn-danger:hover {
        background: #dc2626;
      }
      .btn-secondary-outline {
        background: transparent;
        border: 1px solid #cbd5e1;
        color: #64748b;
      }
      .btn-secondary-outline:hover {
        background: #f1f5f9;
      }
      .combined-preview {
        background: #f8fafc;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        font-size: 0.85rem;
      }
      .placeholder-alert {
        color: #64748b;
        font-style: italic;
        text-align: center;
      }
      .success-banner {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
        padding: 8px 12px;
        border-radius: 6px;
      }
      .divider {
        margin: 6px 0;
        border-top: 1px solid #a7f3d0;
      }
      .console-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .console-body {
        background: #0f172a;
        color: #f8fafc;
        border-radius: 6px;
        padding: 12px;
        font-family: monospace;
        font-size: 0.8rem;
        height: 180px;
        overflow-y: auto;
        border: 1px solid #334155;
      }
      .console-empty {
        color: #64748b;
        text-align: center;
        padding: 60px 0;
        font-style: italic;
      }
      .log-item {
        padding: 4px 0;
        border-bottom: 1px dashed #1e293b;
      }
      .log-item:last-child {
        border-bottom: none;
      }
      .log-time {
        color: #64748b;
        margin-right: 6px;
      }
      .log-key {
        font-weight: bold;
        text-transform: uppercase;
        font-size: 0.7rem;
        color: #38bdf8;
      }
      .log-key.chat {
        color: #f59e0b;
      }
      .log-payload {
        color: #cbd5e1;
        margin-top: 2px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .binding-item {
        background: #f8fafc;
        padding: 10px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        font-size: 0.85rem;
        min-height: 52px;
      }
      .binding-item .label {
        display: block;
        color: #64748b;
        font-size: 0.7rem;
        font-weight: bold;
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .placeholder {
        color: #94a3b8;
        font-style: italic;
      }
      .feature-bullets {
        margin: 0;
        padding: 0 0 0 16px;
        font-size: 0.85rem;
        line-height: 1.6;
        color: #475569;
      }
      .feature-bullets li {
        margin-bottom: 8px;
      }
      .feature-bullets li:last-child {
        margin-bottom: 0;
      }

      /* ASYNC LOADER CARD STYLES */
      .async-card {
        padding: 12px;
        border-radius: 6px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #cbd5e1;
        height: 50px;
        box-sizing: border-box;
      }
      .async-card.empty {
        background: #f8fafc;
        color: #64748b;
        font-style: italic;
        border-style: dashed;
      }
      .async-card.loading {
        background: #f0f9ff;
        border-color: #bee3f8;
        color: #0369a1;
      }
      .async-card.success {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
      }
      .avatar-circle {
        font-size: 1.15rem;
        background: #34d399;
        color: white;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avatar-details {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }
      .avatar-details span {
        font-size: 0.75rem;
        color: #047857;
      }

      .pulse-ring {
        width: 10px;
        height: 10px;
        border: 2px solid #0284c7;
        border-top-color: transparent;
        border-radius: 50%;
        display: inline-block;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class EventBusDemoComponent {
  private eventBus = inject(DemoEventBus);

  logs = signal<LogEntry[]>([]);
  private logId = 0;

  // Track debounced keystrokes
  keystrokeInput = signal('');
  debouncedKeystroke = this.eventBus.onToSignal('input:keystroke');

  chatSignal = this.eventBus.onToSignal('chat:message');
  notifySignal = this.eventBus.onToSignal('system:notification');
  chatHistorySignal = this.eventBus.onToSignal('chat:message', {
    transform: (p) => [p.text],
    defaultValue: [],
  });

  combinedState = this.eventBus.combineLatestToSignal([
    {
      key: 'chat:message',
      transform: (p: { username: string; text: string }) => `${p.username}: ${p.text}`,
    },
    {
      key: 'system:notification',
      transform: (p: { priority: 'low' | 'high'; text: string }) =>
        `[${p.priority.toUpperCase()}] ${p.text}`,
    },
  ]);

  // Extract the username of the last chat message reactively to show the load status
  lastChatUser = computed(() => this.chatSignal()?.username || 'user');

  // Trigger an asynchronous resource loading whenever 'chat:message' is emitted!
  // Maps perfectly via ALEventBus `.onToResource()` which utilizes Angular's native Resource API
  avatarLoader = this.eventBus.onToResource('chat:message', {
    defaultValue: { user: '', score: 0, rank: '' },
    transform: (payload) => payload.username,
    loader: async (event) => {
      const { params, abortSignal } = event;
      const user = params;
      // Simulate remote API loading delay
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (abortSignal.aborted) {
        throw new Error('Aborted');
      }

      // Return synthetic user scores and rankings mock resolved values
      const scores: Record<string, number> = { Ava: 2500, Leo: 1800, Max: 1200 };
      const score = scores[user] || Math.floor(Math.random() * 2000 + 400);
      const ranks = ['Grandmaster 🏆', 'Diamond 💎', 'Platinum 🌟', 'Gold 🪙'];
      const rank =
        score > 2200 ? ranks[0] : score > 1600 ? ranks[1] : score > 1000 ? ranks[2] : ranks[3];

      return { user, score, rank };
    },
  });

  constructor() {
    this.eventBus.on('chat:message', {
      callback: (e) => this.pushLog(e.key, `@${e.payload.username}: ${e.payload.text}`),
    });

    this.eventBus.on('system:notification', {
      callback: (e) =>
        this.pushLog(e.key, `[${e.payload.priority.toUpperCase()}] ${e.payload.text}`),
    });

    this.eventBus.on('input:keystroke', {
      callback: (e) => this.pushLog(e.key, `Keystroke captured: "${e.payload.text}"`),
    });

    this.eventBus.on('action:clear', {
      callback: () => {
        this.pushLog('action:clear', 'SYSTEM STATE FLUSHED');
        this.eventBus.resetAllEvents();
      },
    });
  }

  // Undo/Redo trigger helpers
  get hasUndo() {
    return this.eventBus.history.canUndo();
  }

  get hasRedo() {
    return this.eventBus.history.canRedo();
  }

  undo() {
    this.eventBus.history.undo();
    this.pushLog('system:history', 'History Action: UNDO executed');
  }

  redo() {
    this.eventBus.history.redo();
    this.pushLog('system:history', 'History Action: REDO executed');
  }

  onKeystroke(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.keystrokeInput.set(text);
    this.eventBus.emit('input:keystroke', { text });
  }

  triggerChat(userEl: HTMLInputElement, msgEl: HTMLInputElement) {
    const username = userEl.value.trim();
    const text = msgEl.value.trim();
    if (!username || !text) return;

    this.eventBus.emit('chat:message', { username, text });
    msgEl.value = '';
  }

  triggerNotify(priorityEl: HTMLSelectElement, textEl: HTMLInputElement) {
    const priority = priorityEl.value as 'low' | 'high';
    const text = textEl.value.trim();
    if (!text) return;

    this.eventBus.emit('system:notification', { priority, text });
    textEl.value = '';
  }

  emitClear() {
    this.eventBus.emit('action:clear');
  }

  private pushLog(key: string, message: string) {
    const time = new Date().toLocaleTimeString();
    this.logs.update((current) => [
      ...current,
      {
        id: ++this.logId,
        timestamp: time,
        key,
        payloadStr: message,
      },
    ]);
  }

  clearLogs() {
    this.logs.set([]);
  }
}
