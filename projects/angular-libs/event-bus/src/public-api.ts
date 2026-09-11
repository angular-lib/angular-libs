/*
 * Public API Surface of event-bus
 */

export * from './lib/event-bus';
export * from './lib/plugins';
export type {
  TransformOptions,
  SubscriptionOptions,
  CombineLatestSource,
  CombineLatestOptions,
  BusEvent,
  EmitOptions,
  IALEventBus,
  ALEventBusPlugin,
} from './lib/event-bus.models';
export type {
  IsEventPattern,
  WildcardPattern,
  MatchingEventKeys,
  PatternPayload,
} from './lib/event-bus.patterns';
