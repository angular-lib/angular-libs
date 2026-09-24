import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { TestEventMap } from '../testing/test-bus';
import { LoggerOptions, withLogger } from './logger';

describe('withLogger', () => {
  let group: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function busWith(options?: LoggerOptions<TestEventMap>) {
    @Injectable()
    class Bus extends ALEventBus<TestEventMap> {
      constructor() {
        super();
        this.use(withLogger(options));
      }
    }
    TestBed.configureTestingModule({ providers: [Bus] });
    return TestBed.inject(Bus);
  }

  it('logs in development by default and passes events on', () => {
    const bus = busWith();
    const got: number[] = [];
    bus.on('count:changed', (n) => got.push(n), { unsubscribeOn: 'manual' });
    bus.emit('count:changed', 1);
    expect(group).toHaveBeenCalledWith(expect.stringContaining('count:changed'), expect.any(String), expect.any(String));
    expect(got).toEqual([1]);
  });

  it('logs nothing when disabled', () => {
    busWith({ enabled: false }).emit('count:changed', 1);
    expect(group).not.toHaveBeenCalled();
  });

  it('logs only what the filter accepts', () => {
    const bus = busWith({ filter: (e) => e.key !== 'search:typed' });
    bus.emit('search:typed', 'a');
    bus.emit('count:changed', 1);
    expect(group).toHaveBeenCalledOnce();
  });
});
