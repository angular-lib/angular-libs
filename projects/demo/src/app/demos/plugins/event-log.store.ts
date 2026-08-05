import { InjectionToken, signal } from '@angular/core';

export interface EventLogEntry {
  id: number;
  at: number;
  name: string;
  detail: string;
}

export const DEMO_EVENT_LOG = new InjectionToken<EventLogStore>('DEMO_EVENT_LOG');

const MAX_ENTRIES = 250;

/** Plain store — provided per panel via `registerSidebar({ providers })`. */
export class EventLogStore {
  private seq = 0;
  readonly entries = signal<readonly EventLogEntry[]>([]);

  log(name: string, payload?: unknown): void {
    const detail = formatPayload(payload);
    this.entries.update((list) => {
      const next: EventLogEntry = {
        id: ++this.seq,
        at: Date.now(),
        name,
        detail,
      };
      const merged = [next, ...list];
      return merged.length > MAX_ENTRIES ? merged.slice(0, MAX_ENTRIES) : merged;
    });
  }

  clear(): void {
    this.entries.set([]);
  }
}

function formatPayload(payload: unknown): string {
  if (payload === undefined) {
    return '';
  }
  if (payload === null) {
    return 'null';
  }
  if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload);
  }
  try {
    return JSON.stringify(payload, summarizeReplacer, 0);
  } catch {
    return String(payload);
  }
}

/** Keep log lines readable — drop huge nested row objects. */
function summarizeReplacer(key: string, value: unknown): unknown {
  if (key === 'row' || key === 'rows' || key === 'suggestedRows' || key === 'previousRow') {
    if (Array.isArray(value)) {
      return `[${value.length} rows]`;
    }
    if (value && typeof value === 'object' && 'id' in value) {
      return `{ id: ${(value as { id: unknown }).id} }`;
    }
    return '[row]';
  }
  if (key === 'api') {
    return '[DataGridApi]';
  }
  if (key === 'event' && value instanceof Event) {
    return value.type;
  }
  if (Array.isArray(value) && value.length > 20) {
    return `[${value.length} items]`;
  }
  return value;
}
