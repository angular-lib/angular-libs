/*
 * Public API Surface of @angular-libs/event-bus
 */

export { ALEventBus } from './lib/event-bus';
export type { EventFor } from './lib/event-bus';
export type {
  BusEvent,
  EmitArgs,
  EmitOptions,
  EventBusPlugin,
  EventKey,
  EventOf,
  Next,
  OnOptions,
  PluginHooks,
  Projection,
  ProjectionOptions,
  ProjectionReducers,
  ResourceOptions,
  SignalOptions,
  UnsubscribeOn,
} from './lib/event-bus.models';

export { withLogger } from './lib/plugins/logger';
export type { LoggerOptions } from './lib/plugins/logger';
export { withDebounce } from './lib/plugins/debounce';
export { withCrossTabSync } from './lib/plugins/cross-tab-sync';
export type { CrossTabSyncOptions } from './lib/plugins/cross-tab-sync';
export { definePlugin, withBubbling } from './lib/plugins/define-plugin';
