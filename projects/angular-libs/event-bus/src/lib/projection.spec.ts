import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ALEventBus } from './event-bus';

interface CanvasEvents {
  'shape:moved': number;
  'shape:colored': string;
  'shortcut:undo': void;
  'clicked': void;
  'reset': void;
}

@Injectable()
class CanvasBus extends ALEventBus<CanvasEvents> {
  shape = this.projection(
    { x: 0, color: 'red' },
    {
      'shape:moved': (s, x) => ({ ...s, x }),
      'shape:colored': (s, color) => (color === s.color ? s : { ...s, color }),
    },
    { undo: { limit: 3 } },
  );
  clicks = this.projection(0, { clicked: (n) => n + 1, reset: () => 0 });
  log = this.projection<string[]>([], { 'shape:colored': (lines, c) => [...lines, c], reset: () => [] });

  constructor() {
    super();
    this.on('shortcut:undo', () => this.shape.undo());
  }
}

describe('ALEventBus.projection', () => {
  let bus: CanvasBus;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CanvasBus] });
    bus = TestBed.inject(CanvasBus);
  });

  it('counts every occurrence, including identical payloads', () => {
    bus.emit('clicked');
    bus.emit('clicked');
    bus.emit('clicked');
    expect(bus.clicks.state()).toBe(3);
    bus.emit('reset');
    expect(bus.clicks.state()).toBe(0);
  });

  it('types reducers from the state, including empty literals', () => {
    bus.emit('shape:colored', 'blue');
    expect(bus.log.state()).toEqual(['blue']);
  });

  it('undo/redo restore whole states across event keys', () => {
    bus.emit('shape:moved', 10);
    bus.emit('shape:colored', 'blue');
    bus.shape.undo();
    expect(bus.shape.state()).toEqual({ x: 10, color: 'red' });
    bus.shape.undo();
    expect(bus.shape.state()).toEqual({ x: 0, color: 'red' });
    expect(bus.shape.canUndo()).toBe(false);
    expect(bus.shape.undo()).toBe(false);

    bus.shape.redo();
    expect(bus.shape.state().x).toBe(10);
    expect(bus.shape.canRedo()).toBe(true);
    bus.emit('shape:moved', 20);
    expect(bus.shape.canRedo()).toBe(false);
  });

  it('does not record history when a reducer returns the same state', () => {
    bus.emit('shape:colored', 'red');
    expect(bus.shape.canUndo()).toBe(false);
  });

  it('respects the undo limit; clearHistory and reset work', () => {
    for (const x of [1, 2, 3, 4, 5]) bus.emit('shape:moved', x);
    while (bus.shape.undo());
    expect(bus.shape.state().x).toBe(2);

    bus.shape.clearHistory();
    expect([bus.shape.canUndo(), bus.shape.canRedo()]).toEqual([false, false]);
    bus.shape.reset();
    expect(bus.shape.state()).toEqual({ x: 0, color: 'red' });
  });

  it('undo triggered from a handler behaves like a direct call', () => {
    bus.emit('shape:moved', 5);
    bus.emit('shortcut:undo');
    expect(bus.shape.state().x).toBe(0);
    expect(bus.shape.canRedo()).toBe(true);
  });

  it('undo is a no-op without the undo option', () => {
    bus.emit('clicked');
    expect(bus.clicks.canUndo()).toBe(false);
    expect(bus.clicks.undo()).toBe(false);
    expect(bus.clicks.state()).toBe(1);
  });
});
