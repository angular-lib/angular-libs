/*
 * Public API Surface of @angular-libs/event-bus
 */

export { ALEventBus } from './lib/event-bus';
export type { EventFor } from './lib/event-bus';
export type {
  BusEvent,
  EmitArgs,
  EmitOptions,
  EventBusFeature,
  EventKey,
  EventOf,
  Middleware,
  Next,
  OnOptions,
  Projection,
  ProjectionOptions,
  ProjectionReducers,
  ResourceOptions,
  SignalOptions,
  UnsubscribeOn,
} from './lib/event-bus.models';

export { withLogger } from './lib/middleware/logger';
export type { LoggerOptions } from './lib/middleware/logger';
export { withDebounce } from './lib/middleware/debounce';
export { withCrossTabSync } from './lib/middleware/cross-tab-sync';
export type { CrossTabSyncOptions } from './lib/middleware/cross-tab-sync';
export { withBubbling, withMiddleware } from './lib/middleware/custom';
