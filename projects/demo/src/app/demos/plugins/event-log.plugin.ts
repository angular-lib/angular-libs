/**
 * Demo-only Events tool panel — subscribes via `api.events.onAny` (no host
 * template wiring). History lives on {@link EventLogStore} so it survives
 * panel tab switches.
 */

import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid';
import { EventLogPanel } from './event-log-panel';
import { DEMO_EVENT_LOG, EventLogStore } from './event-log.store';

/** Registers the Events sidebar panel and mirrors all grid events into a log. */
export function eventLogPlugin<T = unknown>(): DataGridPlugin<T> {
  const store = new EventLogStore();

  return {
    id: 'demo-event-log',
    setup(context: DataGridPluginContext<T>): () => void {
      const unsub = context.api.events.onAny((name, payload) => {
        store.log(name, payload);
      });

      const cleanSidebar = context.slots.registerSidebar({
        id: 'events',
        label: 'Events',
        order: 100,
        component: EventLogPanel,
        inputs: () => ({
          title: 'Events',
          hint: 'api.events · newest first',
        }),
        providers: [{ provide: DEMO_EVENT_LOG, useValue: store }],
      });

      return () => {
        unsub();
        cleanSidebar();
      };
    },
  };
}
