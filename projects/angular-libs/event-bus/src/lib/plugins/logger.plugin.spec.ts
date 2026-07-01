import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { loggerPlugin } from './logger.plugin';

interface TestEventMap {
  'theme:changed': 'light' | 'dark';
}

describe('loggerPlugin', () => {
  @Injectable()
  class LoggedEventBus extends ALEventBus<TestEventMap> {
    logger = this.registerPlugin(loggerPlugin({ enabled: true }));
  }

  it('should log emitted events lifecycle to the console without throwing', () => {
    TestBed.configureTestingModule({ providers: [LoggedEventBus] });
    const bus = TestBed.inject(LoggedEventBus);

    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

    expect(() => bus.emit('theme:changed', 'dark')).not.toThrow();

    expect(groupSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Payload'), expect.any(String), 'dark');
    expect(groupEndSpy).toHaveBeenCalled();

    groupSpy.mockRestore();
    logSpy.mockRestore();
    groupEndSpy.mockRestore();
  });

  it('should log a headers line only when headers are present on the emission', () => {
    TestBed.configureTestingModule({ providers: [LoggedEventBus] });
    const bus = TestBed.inject(LoggedEventBus);

    vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    bus.emit('theme:changed', 'light', { headers: { source: 'test' } });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Headers'), expect.any(String), { source: 'test' });

    vi.restoreAllMocks();
  });

  it('should not log anything when disabled', () => {
    @Injectable()
    class DisabledLoggerBus extends ALEventBus<TestEventMap> {
      logger = this.registerPlugin(loggerPlugin({ enabled: false }));
    }
    TestBed.configureTestingModule({ providers: [DisabledLoggerBus] });
    const bus = TestBed.inject(DisabledLoggerBus);

    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});

    bus.emit('theme:changed', 'light');

    expect(groupSpy).not.toHaveBeenCalled();
    groupSpy.mockRestore();
  });
});
