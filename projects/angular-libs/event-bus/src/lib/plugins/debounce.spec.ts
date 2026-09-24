import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { TestEventMap } from '../testing/test-bus';
import { withDebounce } from './debounce';

@Injectable()
class DebouncedBus extends ALEventBus<TestEventMap> {
  constructor() {
    super();
    this.use(withDebounce(['search:typed', 'count:changed'], 300));
  }
}

describe('withDebounce', () => {
  let bus: DebouncedBus;
  let log: string[];
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [DebouncedBus] });
    bus = TestBed.inject(DebouncedBus);
    log = [];
    bus.on(['search:typed', 'count:changed', 'user:logout'], (p, e) => log.push(`${e.key}:${String(p)}`), { unsubscribeOn: 'manual' });
  });
  afterEach(() => vi.useRealTimers());

  it('delivers only the latest event after the quiet period, per key', () => {
    bus.emit('search:typed', 'a');
    bus.emit('count:changed', 1);
    bus.emit('search:typed', 'ab');
    vi.advanceTimersByTime(299);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(log).toEqual(['count:changed:1', 'search:typed:ab']);
  });

  it('passes other events through immediately', () => {
    bus.emit('user:logout');
    expect(log).toEqual(['user:logout:undefined']);
  });

  it('drops pending events when the bus is destroyed', () => {
    bus.emit('search:typed', 'a');
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(1000);
    expect(log).toEqual([]);
  });
});
