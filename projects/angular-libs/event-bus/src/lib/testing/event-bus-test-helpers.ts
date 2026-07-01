import { Component, inject, DestroyRef, Injectable } from '@angular/core';
import { ALEventBus } from '../event-bus';
import { ALEventBusPlugin } from '../event-bus.models';

/**
 * @internal Shared test-only fixtures for the event-bus spec files. Not part of public-api.
 */

@Component({
  standalone: true,
  template: '',
})
export class MockComponent {
  destroyRef = inject(DestroyRef);
}

export interface TestEventMap {
  'user:login': { userId: string; username: string };
  'theme:changed': 'light' | 'dark';
  'simple:event': void;
  'request:completed': { headers: Record<string, string>; body: string };
}

@Injectable({ providedIn: 'root' })
export class TestEventBus extends ALEventBus<TestEventMap> {}

export interface TestPluginState {
  initializedBus: any;
  beforeEmitCalls: { key: any; payload: any; options?: any }[];
  afterEmitCalls: { key: any; payload: any; options?: any }[];
  subscribeCalls: { key: string; subId: string }[];
  unsubscribeCalls: { key: string; subId: string }[];
  destroyCalled: boolean;
  cancelEmit: boolean;
  overridePayload: any;
}

// A functional factory plugin used across multiple spec files to observe plugin lifecycle hooks.
export function createTestPlugin(
  options: { cancelEmit?: boolean; overridePayload?: any } = {},
): ALEventBusPlugin<TestEventMap> & TestPluginState {
  const beforeEmitCalls: { key: any; payload: any; options?: any }[] = [];
  const afterEmitCalls: { key: any; payload: any; options?: any }[] = [];
  const subscribeCalls: { key: string; subId: string }[] = [];
  const unsubscribeCalls: { key: string; subId: string }[] = [];
  let initializedBus: any = null;
  let destroyCalled = false;
  let cancelEmit = options.cancelEmit ?? false;
  let overridePayload = options.overridePayload;

  return {
    get initializedBus() { return initializedBus; },
    get beforeEmitCalls() { return beforeEmitCalls; },
    get afterEmitCalls() { return afterEmitCalls; },
    get subscribeCalls() { return subscribeCalls; },
    get unsubscribeCalls() { return unsubscribeCalls; },
    get destroyCalled() { return destroyCalled; },
    get cancelEmit() { return cancelEmit; },
    set cancelEmit(v) { cancelEmit = v; },
    get overridePayload() { return overridePayload; },
    set overridePayload(v) { overridePayload = v; },

    onInit(bus: any) {
      initializedBus = bus;
    },

    onBeforeEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K], options?: any): any {
      beforeEmitCalls.push({ key, payload, options });
      if (cancelEmit) {
        return false;
      }
      if (overridePayload !== undefined) {
        return overridePayload;
      }
    },

    onAfterEmit<K extends keyof TestEventMap>(key: K, payload: TestEventMap[K], options?: any) {
      afterEmitCalls.push({ key, payload, options });
    },

    onSubscribe(key: string, subId: string) {
      subscribeCalls.push({ key, subId });
    },

    onUnsubscribe(key: string, subId: string) {
      unsubscribeCalls.push({ key, subId });
    },

    onDestroy() {
      destroyCalled = true;
    },
  };
}
