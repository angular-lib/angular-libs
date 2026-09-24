import { Injectable } from '@angular/core';
import { ALEventBus } from '../event-bus';

/** @internal Shared test fixtures. Not part of the public API. */
export interface TestEventMap {
  'user:login': { userId: string };
  'user:logout': void;
  'theme:changed': 'light' | 'dark';
  'search:typed': string;
  'count:changed': number;
}

export interface TestHeaders {
  traceId?: string;
}

@Injectable({ providedIn: 'root' })
export class TestEventBus extends ALEventBus<TestEventMap, TestHeaders> {}
