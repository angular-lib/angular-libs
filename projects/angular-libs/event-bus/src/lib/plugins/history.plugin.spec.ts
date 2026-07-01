import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from '../event-bus';
import { historyPlugin } from './history.plugin';

interface TestEventMap {
  'theme:changed': 'light' | 'dark';
  'user:login': { userId: string };
}

describe('historyPlugin', () => {
  @Injectable()
  class HistoryEventBus extends ALEventBus<TestEventMap> {
    history = this.registerPlugin(historyPlugin());
  }

  let bus: HistoryEventBus;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HistoryEventBus] });
    bus = TestBed.inject(HistoryEventBus);
  });

  it('should track emitted events and support undo/redo', () => {
    expect(bus.history.canUndo()).toBe(false);
    expect(bus.history.canRedo()).toBe(false);

    bus.emit('theme:changed', 'light');
    expect(bus.history.canUndo()).toBe(false); // only 1 element in stack, can't undo to a prior state

    bus.emit('theme:changed', 'dark');
    expect(bus.history.canUndo()).toBe(true);
    expect(bus.history.canRedo()).toBe(false);

    bus.history.undo();
    expect(bus.latest('theme:changed')?.payload).toBe('light');
    expect(bus.history.canUndo()).toBe(false);
    expect(bus.history.canRedo()).toBe(true);

    bus.history.redo();
    expect(bus.latest('theme:changed')?.payload).toBe('dark');
    expect(bus.history.canUndo()).toBe(true);
    expect(bus.history.canRedo()).toBe(false);
  });

  it('should clear stale undo/redo stack entries for a single key when resetEvent(key) is called', () => {
    bus.emit('theme:changed', 'light');
    bus.emit('theme:changed', 'dark');
    expect(bus.history.canUndo()).toBe(true);

    bus.resetEvent('theme:changed');

    expect(bus.history.canUndo()).toBe(false);
    expect(bus.history.canRedo()).toBe(false);
    // Undo should be a no-op now - no stale entries left to resurrect the pre-reset state
    expect(bus.history.undo()).toBe(false);
  });

  it('should leave other keys untouched when resetEvent(key) targets only one key', () => {
    bus.emit('theme:changed', 'light');
    bus.emit('theme:changed', 'dark');
    bus.emit('user:login', { userId: '1' });
    bus.emit('user:login', { userId: '2' });

    bus.resetEvent('theme:changed');

    // 'user:login' history should be untouched
    expect(bus.history.getUndoStack().some((item) => item.key === 'user:login')).toBe(true);
    expect(bus.history.getUndoStack().some((item) => item.key === 'theme:changed')).toBe(false);
  });

  it('should clear ALL history stacks when resetAllEvents() is called', () => {
    bus.emit('theme:changed', 'light');
    bus.emit('theme:changed', 'dark');
    bus.emit('user:login', { userId: '1' });

    bus.resetAllEvents();

    expect(bus.history.getUndoStack().length).toBe(0);
    expect(bus.history.getRedoStack().length).toBe(0);
  });
});
