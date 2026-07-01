import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { debouncePlugin } from './debounce.plugin';

interface TestEventMap {
  'search:typed': string;
}

describe('debouncePlugin', () => {
  @Injectable()
  class DebouncedEventBus extends ALEventBus<TestEventMap> {
    debounce = this.registerPlugin(debouncePlugin([{ key: 'search:typed', delay: 300 }]));
  }

  let bus: DebouncedEventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [DebouncedEventBus] });
    bus = TestBed.inject(DebouncedEventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay emission until the debounce window elapses, keeping only the latest payload', () => {
    const received: string[] = [];
    bus.on('search:typed', { callback: (e) => { received.push(e.payload); }, unsubscribeOn: 'manual' });

    bus.emit('search:typed', 'a');
    bus.emit('search:typed', 'ab');
    bus.emit('search:typed', 'abc');

    expect(received.length).toBe(0); // nothing emitted synchronously - all cancelled/rescheduled

    vi.advanceTimersByTime(299);
    expect(received.length).toBe(0);

    vi.advanceTimersByTime(1);
    expect(received.length).toBe(1);
    expect(received[0]).toBe('abc'); // only the latest payload survives the debounce window
  });

  it('should preserve custom headers through the internal bypass re-emit without leaking the internal bypass flag', () => {
    const received: { payload: string; headers?: any }[] = [];
    bus.on('search:typed', {
      callback: (e) => { received.push({ payload: e.payload, headers: e.headers }); },
      unsubscribeOn: 'manual',
    });

    bus.emit('search:typed', 'hello', { headers: { foo: 'bar' } });
    vi.advanceTimersByTime(300);

    expect(received.length).toBe(1);
    expect(received[0].headers).toEqual({ foo: 'bar' });
  });

  it('should clear pending timers on destroy so no delayed emission fires afterward', () => {
    const received: string[] = [];
    bus.on('search:typed', { callback: (e) => { received.push(e.payload); }, unsubscribeOn: 'manual' });

    bus.emit('search:typed', 'a');
    bus.ngOnDestroy();

    vi.advanceTimersByTime(1000);
    expect(received.length).toBe(0);
  });
});
