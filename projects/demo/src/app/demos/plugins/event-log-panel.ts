import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DEMO_EVENT_LOG } from './event-log.store';

@Component({
  selector: 'app-event-log-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="event-log" data-testid="al-dg-event-log-panel">
      <div class="event-log__header">
        <div class="event-log__title">{{ title() }}</div>
        <button type="button" class="event-log__clear" (click)="store.clear()" data-testid="al-dg-event-log-clear">
          Clear
        </button>
      </div>
      <p class="event-log__hint">{{ hint() }}</p>
      @if (store.entries().length === 0) {
        <p class="event-log__empty">Interact with the grid to see events.</p>
      } @else {
        <ul class="event-log__list" role="list">
          @for (entry of store.entries(); track entry.id) {
            <li class="event-log__item">
              <div class="event-log__meta">
                <span class="event-log__name">{{ entry.name }}</span>
                <time class="event-log__time">{{ formatTime(entry.at) }}</time>
              </div>
              @if (entry.detail) {
                <pre class="event-log__detail">{{ entry.detail }}</pre>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .event-log {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
      padding: 12px;
      box-sizing: border-box;
      min-height: 0;
    }
    .event-log__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .event-log__title {
      font-weight: 650;
      font-size: 13px;
    }
    .event-log__clear {
      border: 1px solid var(--al-dg-border, #e5e7eb);
      background: var(--al-dg-header-bg, #f9fafb);
      border-radius: 6px;
      padding: 4px 8px;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .event-log__hint,
    .event-log__empty {
      margin: 0;
      color: var(--al-dg-muted, #6b7280);
      font-size: 12px;
    }
    .event-log__list {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .event-log__item {
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 6px;
      padding: 6px 8px;
      background: var(--al-dg-bg, #fff);
    }
    .event-log__meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .event-log__name {
      font-size: 12px;
      font-weight: 650;
      color: var(--al-dg-accent, #0f766e);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .event-log__time {
      font-size: 10px;
      color: var(--al-dg-muted, #6b7280);
      white-space: nowrap;
    }
    .event-log__detail {
      margin: 4px 0 0;
      font-size: 10px;
      line-height: 1.35;
      color: var(--al-dg-fg, #111827);
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
  `,
})
export class EventLogPanel {
  /** Bound via `registerSidebar({ inputs })`. */
  readonly title = input('Events');
  readonly hint = input('api.events · newest first');

  readonly store = inject(DEMO_EVENT_LOG);

  formatTime(at: number): string {
    const d = new Date(at);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }
}
